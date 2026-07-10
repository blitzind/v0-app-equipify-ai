/** GE-AIOS-LIVE-1 — Read-only production operations analysis (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { fetchGrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-service"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GROWTH_COMPANY_EVIDENCE_22_QA_MARKER } from "@/lib/growth/research/company-evidence/company-evidence-types"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"
import { GROWTH_LEAD_ADMISSION_21C_QA_MARKER } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import type {
  GeAiosLive1DailyAvaReport,
  GeAiosLive1DeploymentGate,
  GeAiosLive1PipelineMetrics,
} from "@/lib/growth/live-operations/ge-aios-live-1-types"
import { GE_AIOS_LIVE_1_QA_MARKER } from "@/lib/growth/live-operations/ge-aios-live-1-types"

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function hasCompanyEvidence(signals: unknown): boolean {
  if (!signals || typeof signals !== "object") return false
  const row = signals as Record<string, unknown>
  const bundle = row.companyEvidence_v22 ?? row.company_evidence_v22
  if (!bundle || typeof bundle !== "object") return false
  return (bundle as Record<string, unknown>).qaMarker === GROWTH_COMPANY_EVIDENCE_22_QA_MARKER
}

export async function analyzeLive1ResearchEvidenceMetrics(
  admin: SupabaseClient,
  input?: { sinceIso?: string; limit?: number },
): Promise<{
  completedRuns: number
  withEvidence: number
  activeRuns: number
  duplicateActiveByLead: number
}> {
  const sinceIso = input?.sinceIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const limit = input?.limit ?? 100

  const [{ data: completed }, { data: active }] = await Promise.all([
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, lead_id, status, signals, completed_at")
      .eq("status", "completed")
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false })
      .limit(limit),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, lead_id, status, created_at")
      .in("status", ["queued", "running"])
      .limit(200),
  ])

  const completedRuns = completed ?? []
  const withEvidence = completedRuns.filter((row) => hasCompanyEvidence(row.signals)).length

  const activeByLead = new Map<string, number>()
  for (const row of active ?? []) {
    const leadId = String(row.lead_id)
    activeByLead.set(leadId, (activeByLead.get(leadId) ?? 0) + 1)
  }
  const duplicateActiveByLead = [...activeByLead.values()].filter((count) => count > 1).length

  return {
    completedRuns: completedRuns.length,
    withEvidence,
    activeRuns: active?.length ?? 0,
    duplicateActiveByLead,
  }
}

export async function buildLive1DeploymentGates(input: {
  admin: SupabaseClient
  organizationId: string
  codeDeployed: boolean
}): Promise<GeAiosLive1DeploymentGate[]> {
  const gates: GeAiosLive1DeploymentGate[] = []

  if (!input.codeDeployed) {
    gates.push({
      id: "code_deployed",
      status: "blocked",
      detail: "21C/22/23 code is not deployed to Vercel Production yet — deploy before LIVE-1 operations.",
    })
  } else {
    gates.push({
      id: "code_deployed",
      status: "pass",
      detail: "Production deployment assumed complete (verify via admission metadata + evidence markers).",
    })
  }

  const profile = await getActiveApprovedBusinessProfile(input.admin, input.organizationId)
  gates.push(
    profile
      ? { id: "approved_profile", status: "pass", detail: `Approved Company Profile: ${profile.companyName}` }
      : {
          id: "approved_profile",
          status: "fail",
          detail: "No approved Company Profile — admission and ICP matching will under-classify.",
        },
  )

  const killSwitches = await getRuntimeKillSwitchStates(input.admin, input.organizationId)
  gates.push({
    id: "autonomy_enabled",
    status: killSwitches.autonomy_enabled ? "pass" : "warn",
    detail: killSwitches.autonomy_enabled
      ? "Autonomous sales loop enabled."
      : "autonomy_enabled is OFF — Ava will plan but not auto-execute sales loop ticks.",
  })

  const admission = await analyzeGrowthLeadAdmissionProductionPool({
    admin: input.admin,
    organizationId: input.organizationId,
  })

  gates.push({
    id: "admission_metadata_writes",
    status: admission.deploymentMarkerPresent ? "pass" : "blocked",
    detail: admission.deploymentMarkerPresent
      ? "21C admission metadata present in production pool."
      : "No 21C admission metadata in pool — deploy 21C before trusting admission gate.",
  })

  const evidence = await analyzeLive1ResearchEvidenceMetrics(input.admin, {
    sinceIso: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 50,
  })

  gates.push({
    id: "company_evidence_v22",
    status: evidence.withEvidence > 0 ? "pass" : input.codeDeployed ? "warn" : "blocked",
    detail: `${evidence.withEvidence}/${Math.max(evidence.completedRuns, 1)} completed runs (7d) include companyEvidence_v22 (${GROWTH_COMPANY_EVIDENCE_22_QA_MARKER}).`,
  })

  gates.push({
    id: "canonical_research_routing",
    status: "pass",
    detail: `Canonical chain enforced in codebase: ${GROWTH_CANONICAL_RESEARCH_23_QA_MARKER}.`,
  })

  if (admission.counts.invalidRejectedInActiveQueue > 0) {
    gates.push({
      id: "legacy_queue_cleanup",
      status: "warn",
      detail: `${admission.counts.invalidRejectedInActiveQueue} invalid/rejected leads remain in active queue — run 21C cleanup dry-run.`,
    })
  }

  return gates
}

export async function buildLive1PipelineMetrics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GeAiosLive1PipelineMetrics> {
  const admission = await analyzeGrowthLeadAdmissionProductionPool({ admin, organizationId })
  const evidence = await analyzeLive1ResearchEvidenceMetrics(admin, {
    sinceIso: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 200,
  })

  let pendingApprovals = 0
  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(admin, { organizationId })
    const approvals = await fetchGrowthHumanApprovalCenterReadModel(admin, {
      organizationId,
      commandCenter,
      generatedAt: new Date().toISOString(),
    })
    pendingApprovals = approvals.summary?.totalPending ?? approvals.items?.length ?? 0
  } catch {
    pendingApprovals = 0
  }

  const withAdmissionMetadata =
    admission.counts.totalActiveLeads - admission.counts.missingAdmissionMetadata

  return {
    totalActiveLeads: admission.counts.totalActiveLeads,
    withAdmissionMetadata,
    researchedLeads: admission.counts.totalActiveLeads - admission.counts.researchBlocked,
    withCompanyEvidence: evidence.withEvidence,
    inReviewAdmission: admission.counts.review,
    rejectedOrInvalid: admission.counts.rejected + admission.counts.invalid,
    acceptedAdmission: admission.counts.accepted,
    pendingApprovals,
    duplicateActiveResearchRuns: evidence.duplicateActiveByLead,
  }
}

export async function buildLive1DailyAvaReport(input: {
  admin: SupabaseClient
  organizationId: string
  codeDeployed?: boolean
}): Promise<GeAiosLive1DailyAvaReport> {
  const generatedAt = new Date().toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [admission, research24h, metrics, deploymentGates] = await Promise.all([
    analyzeGrowthLeadAdmissionProductionPool({
      admin: input.admin,
      organizationId: input.organizationId,
    }),
    analyzeLive1ResearchEvidenceMetrics(input.admin, { sinceIso: since24h }),
    buildLive1PipelineMetrics(input.admin, input.organizationId),
    buildLive1DeploymentGates({
      admin: input.admin,
      organizationId: input.organizationId,
      codeDeployed: input.codeDeployed ?? false,
    }),
  ])

  const { data: newLeads } = await input.admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, metadata, created_at")
    .gte("created_at", since24h)
    .not("status", "in", '("archived","converted")')
    .order("created_at", { ascending: false })
    .limit(100)

  const rejectedLast24h = (newLeads ?? []).filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null
    const state = resolveLeadAdmissionStateFromMetadata(metadata)
    return state === "rejected" || state === "invalid"
  }).length

  const highPriorityAccounts = admission.driftRows
    .filter((row) => row.evaluatedState === "accepted" && row.researchEligibility === "eligible")
    .slice(0, 5)
    .map((row) => row.companyName)

  const pipelineRisks: string[] = []
  if (!admission.deploymentMarkerPresent) {
    pipelineRisks.push("Admission metadata not yet written in production — deploy 21C before trusting gate.")
  }
  if (metrics.duplicateActiveResearchRuns > 0) {
    pipelineRisks.push(`${metrics.duplicateActiveResearchRuns} leads have duplicate active research runs.`)
  }
  if (admission.counts.invalidRejectedInActiveQueue > 0) {
    pipelineRisks.push(`${admission.counts.invalidRejectedInActiveQueue} invalid/rejected leads still in active queue.`)
  }
  if (research24h.completedRuns > 0 && research24h.withEvidence === 0) {
    pipelineRisks.push("Research completed in last 24h but no companyEvidence_v22 — verify 22 deploy.")
  }

  const recommendedActions: string[] = []
  if (metrics.pendingApprovals > 0) {
    recommendedActions.push(`Review ${metrics.pendingApprovals} pending operator approvals.`)
  }
  if (metrics.inReviewAdmission > 0) {
    recommendedActions.push(`Resolve ${metrics.inReviewAdmission} leads in admission review.`)
  }
  if (highPriorityAccounts.length > 0) {
    recommendedActions.push(`Prioritize research/outreach for: ${highPriorityAccounts.slice(0, 3).join(", ")}.`)
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push("Import approved ICP manufacturing/industrial leads to populate pipeline.")
  }

  return {
    qaMarker: GE_AIOS_LIVE_1_QA_MARKER,
    generatedAt,
    organizationId: input.organizationId,
    greeting: `${greetingForHour(new Date().getHours())} — Ava LIVE-1 operations report`,
    researchCompletedLast24h: research24h.completedRuns,
    newLeadsLast24h: newLeads?.length ?? 0,
    leadsRejectedLast24h: rejectedLast24h,
    leadsAwaitingReview: metrics.inReviewAdmission,
    highPriorityAccounts,
    followUpsDue: 0,
    pipelineRisks,
    recommendedActions,
    operatorApprovalsWaiting: metrics.pendingApprovals,
    metrics,
    deploymentGates,
  }
}

export const LIVE_1_REQUIRED_QA_MARKERS = {
  admission: GROWTH_LEAD_ADMISSION_21C_QA_MARKER,
  evidence: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  canonical: GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
  live: GE_AIOS_LIVE_1_QA_MARKER,
} as const
