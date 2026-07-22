/**
 * GE-AIOS-REVENUE-FLOW-RECOVERY-1A — Canonical revenue pipeline recovery validation (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import { deriveOutreachPreparationPilotControlFromPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  getAutonomousOutreachPreparationPilotOrgState,
  setAutonomousOutreachPreparationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { runAutonomousOutreachPreparationManualRequest } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { resolveCanonicalApprovalQueueCount } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import {
  getRuntimeKillSwitchStates,
  setRuntimeKillSwitch,
} from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  applyOperatorPackageAutonomyRepair,
} from "@/lib/growth/training/operator-package-production-validation-1a"
import { isGoodEnoughForEarlyOutreachFromRun } from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"
import { isLeadInPortfolioOrganizationScope } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER =
  "ge-aios-revenue-flow-recovery-1a-v1" as const

export const CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A =
  "CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A" as const

export type RevenueFlowStageAccounting = {
  researchCompleted: number
  admissionAccepted: number
  admissionReview: number
  admissionRejected: number
  decisionMakerInvoked: number
  decisionMakerStatusNone: number
  draftFactoryWaitingForDm: number
  draftFactoryWaitingForGeneration: number
  draftFactoryWaitingForApproval: number
  draftFactoryPausedStopInvestment: number
  outreachPreparationRuns: number
  approvalPackages: number
  awaitingApproval: number
}

export type RevenueFlowRecoveryRootCauses = {
  admissionRejection: string
  decisionMakerNotExecuting: string
  draftFactoryStopInvestment: string
  outreachPreparationZeroRuns: string
}

export type RevenueFlowRecoveryReport = {
  qaMarker: typeof GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER
  organizationId: string
  generatedAt: string
  before: RevenueFlowStageAccounting
  after: RevenueFlowStageAccounting
  rootCauses: RevenueFlowRecoveryRootCauses
  correctionsApplied: string[]
  admissionReconciledLeadIds: string[]
  outreachPrepTriggeredLeadIds: string[]
  newApprovalPackages: number
  companiesReachingApproval: number
  outboundEnabled: boolean
  outreachPilotControlState: string
  outreachAutonomyEnabled: boolean
  executiveVerdict:
    | "Revenue pipeline restored"
    | "Restored with remaining constraints"
    | "Additional bottlenecks remain"
  verdictReasons: string[]
  recommendedNextAction: string
}

const RESEARCH_LOOKBACK_DAYS = 30

type ResearchedLeadRow = {
  id: string
  company_name: string | null
  metadata: Record<string, unknown> | null
  decision_maker_status: string | null
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
}

function readAdmissionReasons(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = metadata?.admission_reasons
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === "string")
}

function researchLookbackIso(): string {
  return new Date(Date.now() - RESEARCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export async function loadResearchedLeadCohort(
  admin: SupabaseClient,
  organizationId: string,
): Promise<ResearchedLeadRow[]> {
  const sinceIso = researchLookbackIso()
  const { data: leadsFromRuns } = await admin
    .schema("growth")
    .from("research_runs")
    .select("lead_id, completed_at, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(250)

  const recentLeadIds = [
    ...new Set(
      (leadsFromRuns ?? [])
        .filter((row) => {
          const marker = row.completed_at ?? row.created_at
          return typeof marker === "string" ? marker >= sinceIso : true
        })
        .map((row) => row.lead_id)
        .filter(Boolean),
    ),
  ]

  const { data: leadsFromPointer } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, metadata, decision_maker_status, latest_prospect_research_run_id, last_prospect_researched_at, promoted_organization_id, status",
    )
    .not("latest_prospect_research_run_id", "is", null)
    .order("last_prospect_researched_at", { ascending: false, nullsFirst: false })
    .limit(250)

  const pointerLeadIds = (leadsFromPointer ?? [])
    .filter((row) =>
      isLeadInPortfolioOrganizationScope(
        {
          id: row.id,
          promotedOrganizationId:
            typeof row.promoted_organization_id === "string" ? row.promoted_organization_id : null,
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
          status: typeof row.status === "string" ? row.status : null,
        },
        organizationId,
      ),
    )
    .map((row) => row.id)

  const leadIds = [...new Set([...recentLeadIds, ...pointerLeadIds])]
  if (leadIds.length === 0) return []

  const leads: ResearchedLeadRow[] = []
  for (let index = 0; index < leadIds.length; index += 50) {
    const chunk = leadIds.slice(index, index + 50)
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select(
        "id, company_name, metadata, decision_maker_status, latest_prospect_research_run_id, last_prospect_researched_at, promoted_organization_id, status",
      )
      .in("id", chunk)
    for (const row of data ?? []) {
      if (
        !isLeadInPortfolioOrganizationScope(
          {
            id: row.id,
            promotedOrganizationId:
              typeof row.promoted_organization_id === "string" ? row.promoted_organization_id : null,
            metadata: (row.metadata as Record<string, unknown> | null) ?? null,
            status: typeof row.status === "string" ? row.status : null,
          },
          organizationId,
        )
      ) {
        continue
      }
      leads.push({
        id: row.id,
        company_name: row.company_name,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        decision_maker_status: row.decision_maker_status,
        latest_prospect_research_run_id: row.latest_prospect_research_run_id,
        last_prospect_researched_at: row.last_prospect_researched_at,
      })
    }
  }

  return leads
}

function summarizeAdmissionRejections(leads: ResearchedLeadRow[]): string {
  const counts = new Map<string, number>()
  for (const lead of leads) {
    const state = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (state !== "rejected") continue
    for (const reason of readAdmissionReasons(lead.metadata)) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (top.length === 0) {
    return "No dominant rejection reason recorded in lead metadata."
  }
  return top.map(([reason, count]) => `${reason} (${count})`).join("; ")
}

export async function collectRevenueFlowStageAccounting(
  admin: SupabaseClient,
  organizationId: string,
): Promise<RevenueFlowStageAccounting> {
  const sinceIso = researchLookbackIso()

  const generatedAt = new Date().toISOString()
  const approvalSnapshot = await loadCanonicalOperatorApprovalSnapshotForHome(admin, {
    organizationId,
    generatedAt,
  })
  const awaitingApproval = resolveCanonicalApprovalQueueCount(approvalSnapshot, 0)

  const [leads, draftFactoryRows, outreachRunCount, approvalPackages] = await Promise.all([
    loadResearchedLeadCohort(admin, organizationId),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("state, paused_reason, lead_id")
      .eq("organization_id", organizationId),
    admin
      .schema("growth")
      .from("autonomous_outreach_preparation_runs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("completed_at", sinceIso),
    admin
      .schema("growth")
      .from("autonomous_outreach_preparation_runs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("approval_package", "is", null)
      .gte("completed_at", sinceIso),
  ])
  let admissionAccepted = 0
  let admissionReview = 0
  let admissionRejected = 0
  let decisionMakerInvoked = 0
  let decisionMakerStatusNone = 0

  for (const lead of leads) {
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission === "accepted") admissionAccepted += 1
    if (admission === "review") admissionReview += 1
    if (admission === "rejected") admissionRejected += 1
    if (lead.decision_maker_status && lead.decision_maker_status !== "none") {
      decisionMakerInvoked += 1
    } else {
      decisionMakerStatusNone += 1
    }
  }

  const dfRows = draftFactoryRows.data ?? []
  return {
    researchCompleted: leads.length,
    admissionAccepted,
    admissionReview,
    admissionRejected,
    decisionMakerInvoked,
    decisionMakerStatusNone,
    draftFactoryWaitingForDm: dfRows.filter((row) => row.state === "waiting_for_dm").length,
    draftFactoryWaitingForGeneration: dfRows.filter((row) => row.state === "waiting_for_generation")
      .length,
    draftFactoryWaitingForApproval: dfRows.filter((row) => row.state === "waiting_for_approval").length,
    draftFactoryPausedStopInvestment: dfRows.filter(
      (row) => row.state === "paused" && row.paused_reason === "stop_investment",
    ).length,
    outreachPreparationRuns: outreachRunCount.count ?? 0,
    approvalPackages: approvalPackages.count ?? 0,
    awaitingApproval,
  }
}

async function syncOutreachPreparationPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ previous: string; next: string }> {
  const generatedAt = new Date().toISOString()
  const evaluation = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId,
    generatedAt,
  })
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, organizationId, generatedAt)
  const nextControlState = deriveOutreachPreparationPilotControlFromPolicy(
    evaluation.policy,
    orgState.controlState,
  )
  if (nextControlState !== orgState.controlState) {
    await setAutonomousOutreachPreparationPilotControlState({
      admin,
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
  return { previous: orgState.controlState, next: nextControlState }
}

export async function applyRevenueFlowRecoveryCorrections(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
    reconcileAdmission?: boolean
    enableOutreachPreparation?: boolean
    triggerOutreachPrep?: boolean
    maxAdmissionReconciles?: number
    maxOutreachPrepTriggers?: number
  },
): Promise<{
  correctionsApplied: string[]
  admissionReconciledLeadIds: string[]
  outreachPrepTriggeredLeadIds: string[]
}> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const correctionsApplied: string[] = []
  const admissionReconciledLeadIds: string[] = []
  const outreachPrepTriggeredLeadIds: string[] = []

  if (input.enableOutreachPreparation !== false) {
    const operatorRepair = await applyOperatorPackageAutonomyRepair(admin, input.organizationId)
    if (operatorRepair.applied && operatorRepair.description) {
      correctionsApplied.push(operatorRepair.description)
    }

    const kill = await getRuntimeKillSwitchStates(admin)
    if (!kill.autonomy_generation_enabled) {
      await setRuntimeKillSwitch(admin, { key: "autonomy_generation_enabled", enabled: true })
      correctionsApplied.push(
        "Enabled autonomy_generation kill switch for outreach preparation (outbound transport remains off).",
      )
    }
    if (!kill.autonomy_objective_mode_enabled) {
      await setRuntimeKillSwitch(admin, { key: "autonomy_objective_mode_enabled", enabled: true })
      correctionsApplied.push("Enabled autonomy_objective_mode kill switch for objective-mode agents.")
    }

    const pilotSync = await syncOutreachPreparationPilotFromPolicy(admin, input.organizationId)
    if (pilotSync.previous !== pilotSync.next) {
      correctionsApplied.push(
        `Synced outreach preparation pilot control ${pilotSync.previous} → ${pilotSync.next}.`,
      )
    }
  }

  if (input.reconcileAdmission !== false) {
    const admissionContext = await loadGrowthLeadAdmissionContext(admin, input.organizationId)
    const cohort = await loadResearchedLeadCohort(admin, input.organizationId)

    for (const row of cohort.slice(0, input.maxAdmissionReconciles ?? 50)) {
      const lead = (await fetchGrowthLeadById(admin, row.id)) as GrowthLead | null
      if (!lead) continue
      const run = await fetchLatestCompletedProspectResearchRun(admin, lead.id)
      if (!run) continue
      const before = resolveLeadAdmissionStateFromMetadata(lead.metadata)
      const reconciliation = await reconcileExternalDiscoveryPostResearchAdmission({
        admin,
        lead,
        admissionContext,
        evidenceBundle: run.signals?.companyEvidence_v22 ?? null,
        websiteCrawlText: run.researchSummary,
        researchRun: run,
        generatedAt,
      })
      if (!reconciliation.applied) continue
      admissionReconciledLeadIds.push(lead.id)
      if (before !== reconciliation.admissionState) {
        correctionsApplied.push(
          `Reconciled admission for ${lead.companyName ?? lead.id}: ${before} → ${reconciliation.admissionState}.`,
        )
      }
    }
  }

  if (input.triggerOutreachPrep !== false) {
    const cohort = await loadResearchedLeadCohort(admin, input.organizationId)
    let triggered = 0
    for (const row of cohort) {
      if (triggered >= (input.maxOutreachPrepTriggers ?? 12)) break
      const admission = resolveLeadAdmissionStateFromMetadata(row.metadata)
      if (admission !== "accepted") continue
      const run = await fetchLatestCompletedProspectResearchRun(admin, row.id)
      if (!run || !isGoodEnoughForEarlyOutreachFromRun(run)) continue
      await runAutonomousOutreachPreparationManualRequest(admin, {
        organizationId: input.organizationId,
        leadId: row.id,
        generatedAt,
      }).catch(() => undefined)
      outreachPrepTriggeredLeadIds.push(row.id)
      triggered += 1
    }
    if (triggered > 0) {
      correctionsApplied.push(`Triggered outreach preparation for ${triggered} admission-accepted lead(s).`)
    }
  }

  return { correctionsApplied, admissionReconciledLeadIds, outreachPrepTriggeredLeadIds }
}

export async function runRevenueFlowRecoveryProductionValidation(
  admin: SupabaseClient,
  input?: {
    organizationId?: string
    applyCorrections?: boolean
  },
): Promise<RevenueFlowRecoveryReport> {
  const organizationId = input?.organizationId ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const before = await collectRevenueFlowStageAccounting(admin, organizationId)
  const researchedLeadRows = await loadResearchedLeadCohort(admin, organizationId)

  const kill = await getRuntimeKillSwitchStates(admin)
  const evaluation = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId,
    generatedAt,
  })
  const pilotState = await getAutonomousOutreachPreparationPilotOrgState(admin, organizationId, generatedAt)
  const effectivePilotControl = deriveOutreachPreparationPilotControlFromPolicy(
    evaluation.policy,
    pilotState.controlState,
  )

  const rootCauses: RevenueFlowRecoveryRootCauses = {
    admissionRejection: summarizeAdmissionRejections(researchedLeadRows),
    decisionMakerNotExecuting:
      before.admissionRejected > before.admissionAccepted
        ? "Decision Maker discovery is gated behind Draft Factory advancement; admission rejection maps to stop_investment, so DM enrichment never starts."
        : before.draftFactoryPausedStopInvestment > 0
          ? "Draft Factory investment authority paused eligible leads at stop_investment before the decision_maker stage."
          : "No DM requests observed — leads have not reached waiting_for_dm in Draft Factory.",
    draftFactoryStopInvestment:
      before.draftFactoryPausedStopInvestment > 0
        ? `${before.draftFactoryPausedStopInvestment} Draft Factory row(s) paused with stop_investment — canonical investment authority blocking billable stages after admission/qualification stop signals.`
        : "Draft Factory stop_investment gate not currently blocking durable states.",
    outreachPreparationZeroRuns:
      !evaluation.policy.outreachAutonomyEnabled
        ? "Outreach preparation policy gate blocked — outreach_agent and/or autonomy_generation kill switch disabled."
        : effectivePilotControl !== "active"
          ? `Outreach preparation pilot control state is ${effectivePilotControl} in production store.`
          : before.admissionAccepted === 0
            ? "No admission-accepted researched leads available to wake outreach preparation."
            : "Outreach preparation scheduler not yet invoked for eligible leads.",
  }

  let correctionsApplied: string[] = []
  let admissionReconciledLeadIds: string[] = []
  let outreachPrepTriggeredLeadIds: string[] = []

  if (input?.applyCorrections) {
    const repair = await applyRevenueFlowRecoveryCorrections(admin, {
      organizationId,
      generatedAt,
      reconcileAdmission: true,
      enableOutreachPreparation: true,
      triggerOutreachPrep: true,
    })
    correctionsApplied = repair.correctionsApplied
    admissionReconciledLeadIds = repair.admissionReconciledLeadIds
    outreachPrepTriggeredLeadIds = repair.outreachPrepTriggeredLeadIds
  }

  const after = input?.applyCorrections
    ? await collectRevenueFlowStageAccounting(admin, organizationId)
    : before

  const newApprovalPackages = Math.max(0, after.approvalPackages - before.approvalPackages)
  const companiesReachingApproval = Math.max(0, after.awaitingApproval - before.awaitingApproval)

  const verdictReasons: string[] = []
  if (kill.autonomy_outbound_enabled) {
    verdictReasons.push("Outbound transport kill switch is ON (expected).")
  } else {
    verdictReasons.push("Outbound transport remains disabled (expected).")
  }
  if (after.outreachPreparationRuns <= before.outreachPreparationRuns && input?.applyCorrections) {
    verdictReasons.push("Outreach preparation runs did not increase after correction pass.")
  }
  if (after.admissionAccepted <= before.admissionAccepted && before.admissionRejected > 0) {
    verdictReasons.push("Admission accepted count did not improve versus rejected cohort.")
  }
  if (after.draftFactoryPausedStopInvestment >= before.draftFactoryPausedStopInvestment) {
    verdictReasons.push("Draft Factory stop_investment paused rows remain elevated.")
  }

  let executiveVerdict: RevenueFlowRecoveryReport["executiveVerdict"] = "Additional bottlenecks remain"
  const pipelineProgressed =
    after.admissionAccepted > before.admissionAccepted ||
    after.outreachPreparationRuns > before.outreachPreparationRuns ||
    after.approvalPackages > before.approvalPackages ||
    after.awaitingApproval > before.awaitingApproval ||
    after.decisionMakerInvoked > before.decisionMakerInvoked

  if (
    pipelineProgressed &&
    after.outreachPreparationRuns > 0 &&
    after.admissionAccepted > 0 &&
    verdictReasons.length <= 1
  ) {
    executiveVerdict = "Revenue pipeline restored"
  } else if (pipelineProgressed) {
    executiveVerdict = "Restored with remaining constraints"
  }

  return {
    qaMarker: GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER,
    organizationId,
    generatedAt,
    before,
    after,
    rootCauses,
    correctionsApplied,
    admissionReconciledLeadIds,
    outreachPrepTriggeredLeadIds,
    newApprovalPackages,
    companiesReachingApproval,
    outboundEnabled: kill.autonomy_outbound_enabled,
    outreachPilotControlState: effectivePilotControl,
    outreachAutonomyEnabled: evaluation.policy.outreachAutonomyEnabled,
    executiveVerdict,
    verdictReasons,
    recommendedNextAction:
      executiveVerdict === "Revenue pipeline restored"
        ? "Monitor operator approval queue and Home pipeline pace; keep outbound transport disabled until supervised send validation passes."
        : executiveVerdict === "Restored with remaining constraints"
          ? "Review remaining stop_investment rows and admission review cohort; rerun Draft Factory due scheduler tick."
          : "Apply CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A=1 production correction pass, then rerun validation.",
  }
}
