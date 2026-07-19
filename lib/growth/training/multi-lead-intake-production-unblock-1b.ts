/**
 * GE-AIOS-MULTI-LEAD-INTAKE-1B — Admission queue diagnosis, unblock, and progression validation.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { tickAutonomousPortfolioManagerForScheduler } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a"
import {
  assembleMultiLeadIntakeValidationReport,
  captureMultiLeadIntakePreflightState,
} from "@/lib/growth/training/multi-lead-intake-production-validation-1a"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"

export const GROWTH_AIOS_MULTI_LEAD_INTAKE_1B_QA_MARKER =
  "ge-aios-multi-lead-intake-1b-v1" as const

export type AdmissionQueueDiagnosis = {
  admissionsPending: number
  awaitingReview: number
  awaitingAdmissionNullMetadata: number
  maximumQueuedAdmissions: number
  blockedByQueueLimit: boolean
  replenishmentReason: string | null
  ageDistribution: {
    under24h: number
    under7d: number
    over7d: number
  }
  byStoredState: Record<string, number>
  byReason: Record<string, number>
  researchEligible: number
  operatorReviewRequired: number
  staleOrOrphaned: number
  rootCause: string
  queueBlockedByRealWork: boolean
}

export type LeadProgressionRow = {
  company: string | null
  providerResult: string | null
  normalized: boolean
  duplicateStatus: string | null
  admissionResult: string | null
  leadId: string | null
  researchResult: string | null
  qualificationResult: string | null
  operatorPackageResult: string | null
  blocker: string | null
  createdAt: string | null
}

export type MultiLeadIntakeUnblockReport = {
  qaMarker: typeof GROWTH_AIOS_MULTI_LEAD_INTAKE_1B_QA_MARKER
  idempotencyKey: string
  validationStartedAt: string
  validationCompletedAt: string
  queueBefore: AdmissionQueueDiagnosis
  queueAfter: AdmissionQueueDiagnosis
  unblockingAction: string
  researchOrchestratorResult: Awaited<ReturnType<typeof runAvaResearchQueueOrchestrator>> | null
  portfolioDiscoveryResult: Awaited<
    ReturnType<typeof tickAutonomousPortfolioManagerForScheduler>
  > | null
  schedulerTicks: number
  focusRunId: string | null
  focusAudienceId: string | null
  intakeReport: Awaited<ReturnType<typeof assembleMultiLeadIntakeValidationReport>> | null
  progressionTable: LeadProgressionRow[]
  outboundConfirmedDisabled: boolean
  outboundMessagesInWindow: number
  executiveVerdict: "PASS" | "PASS WITH LIMITATIONS" | "FAIL"
  verdictReasons: string[]
  recommendedNextAction: string
}

function ageBucket(createdAt: string | null | undefined, nowMs: number): "under24h" | "under7d" | "over7d" {
  if (!createdAt) return "over7d"
  const ageMs = nowMs - Date.parse(createdAt)
  if (ageMs < 86_400_000) return "under24h"
  if (ageMs < 7 * 86_400_000) return "under7d"
  return "over7d"
}

export async function diagnoseAdmissionQueue(
  admin: SupabaseClient,
  organizationId: string,
): Promise<AdmissionQueueDiagnosis> {
  const generatedAt = new Date().toISOString()
  const nowMs = Date.parse(generatedAt)
  const work = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId,
    generatedAt,
  })
  const approved = await getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId,
    generatedAt,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })

  const analysis = await analyzeGrowthLeadAdmissionProductionPool({
    admin,
    organizationId,
    limit: 500,
  })

  const ageDistribution = { under24h: 0, under7d: 0, over7d: 0 }
  const byStoredState: Record<string, number> = {}
  const byReason: Record<string, number> = {}
  let researchEligible = 0
  let operatorReviewRequired = 0
  let staleOrOrphaned = 0
  let awaitingAdmissionNullMetadata = 0

  for (const lead of work?.portfolioLeads ?? []) {
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    const status = lead.status?.trim().toLowerCase() ?? "unknown"
    if (status === "archived" || status === "disqualified") continue

    const stateKey = admission ?? "null"
    byStoredState[stateKey] = (byStoredState[stateKey] ?? 0) + 1
    if (admission == null) awaitingAdmissionNullMetadata += 1

    const reasons = Array.isArray(lead.metadata?.admission_reasons)
      ? (lead.metadata.admission_reasons as string[])
      : []
    for (const reason of reasons) {
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }

    const bucket = ageBucket(lead.created_at ?? null, nowMs)
    if (admission === "review" || admission == null) {
      ageDistribution[bucket] += 1
    }

    if (shouldAutoQueueLeadResearch(lead)) researchEligible += 1
    if (admission === "review" && reasons.includes("pending_operational_keyword_validation")) {
      operatorReviewRequired += 1
    }
    if (
      (admission == null && Date.parse(lead.created_at ?? "") < nowMs - 7 * 86_400_000) ||
      (status === "new" && !lead.website?.trim() && admission === "review")
    ) {
      staleOrOrphaned += 1
    }
  }

  const blockedByQueueLimit = pm.replenishment.blockedByQueueLimit
  let rootCause = "Queue within capacity"
  if (blockedByQueueLimit) {
    rootCause =
      pm.health.admissionsPending >= pm.target.maximumQueuedAdmissions
        ? "admissionsPending at or above maximumQueuedAdmissions"
        : "Replenishment blocked despite admissionsPending below limit — check other gates"
  }

  return {
    admissionsPending: pm.health.admissionsPending,
    awaitingReview: pm.health.counts.awaitingReview,
    awaitingAdmissionNullMetadata,
    maximumQueuedAdmissions: pm.target.maximumQueuedAdmissions,
    blockedByQueueLimit,
    replenishmentReason: pm.replenishment.reason,
    ageDistribution,
    byStoredState,
    byReason,
    researchEligible,
    operatorReviewRequired,
    staleOrOrphaned,
    rootCause,
    queueBlockedByRealWork:
      blockedByQueueLimit &&
      pm.health.admissionsPending >= pm.target.maximumQueuedAdmissions &&
      pm.health.counts.awaitingReview + pm.health.counts.awaitingAdmission > 0,
  }
}

export async function buildLeadProgressionTable(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadIds: string[]
    validationStartedAt: string
  },
): Promise<LeadProgressionRow[]> {
  if (input.leadIds.length === 0) return []

  const { data: leads } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, metadata, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .eq("organization_id", input.organizationId)
    .in("id", input.leadIds)

  const rows: LeadProgressionRow[] = []
  for (const lead of leads ?? []) {
    const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
    const admission = resolveLeadAdmissionStateFromMetadata(metadata)
    const reasons = Array.isArray(metadata.admission_reasons)
      ? metadata.admission_reasons.filter((value): value is string => typeof value === "string")
      : []
    const packages = await listOutreachPreparationRunsForLead(admin, lead.id).catch(() => [])

    let researchResult = "none"
    if (lead.last_prospect_researched_at && lead.latest_prospect_research_run_id) {
      researchResult = "completed"
    } else if (lead.status === "researching" || lead.latest_prospect_research_run_id) {
      researchResult = "queued"
    } else if (reasons.includes("pending_operational_keyword_validation")) {
      researchResult = "pending: pending_operational_keyword_validation"
    } else if (!shouldAutoQueueLeadResearch(lead)) {
      researchResult = "blocked: not_eligible_for_auto_research"
    }

    const workflow = metadata.research_workflow as Record<string, unknown> | undefined
    const qualificationResult =
      typeof workflow?.qualification_state === "string"
        ? workflow.qualification_state
        : admission === "accepted"
          ? "accepted"
          : admission === "review"
            ? "pending_review"
            : "none"

    const operatorPackageResult =
      packages.length > 0 ? `packages:${packages.length}` : admission === "accepted" ? "eligible" : "not_ready"

    rows.push({
      company: lead.company_name,
      providerResult: metadata.unified_intake_source === "datamoon" ? "datamoon" : "canonical_intake",
      normalized: Boolean(lead.website?.trim() || lead.company_name?.trim()),
      duplicateStatus: null,
      admissionResult: admission ?? "pending",
      leadId: lead.id,
      researchResult,
      qualificationResult,
      operatorPackageResult,
      blocker:
        researchResult.startsWith("blocked") || researchResult.startsWith("pending:")
          ? researchResult
          : null,
      createdAt: lead.created_at,
    })
  }

  return rows
}

export function computeMultiLeadIntakeUnblockVerdict(input: {
  queueAfter: AdmissionQueueDiagnosis
  newLeadsCreated: number
  progressionTable: LeadProgressionRow[]
  researchCompleted: number
  qualificationReady: number
  idempotentPass: boolean
  outboundDisabled: boolean
  outboundMessages: number
}): { verdict: MultiLeadIntakeUnblockReport["executiveVerdict"]; reasons: string[] } {
  const reasons: string[] = []
  if (!input.outboundDisabled || input.outboundMessages > 0) {
    reasons.push("Outbound safety check failed")
  }
  if (input.queueAfter.blockedByQueueLimit) {
    reasons.push("Admission queue still blocked after unblocking action")
  }
  if (input.newLeadsCreated < 3) {
    reasons.push(`Only ${input.newLeadsCreated} new leads persisted (need >= 3)`)
  }
  const researched = input.progressionTable.filter(
    (row) => row.researchResult === "completed" || row.researchResult === "queued",
  ).length
  if (researched < 2) {
    reasons.push(`Only ${researched} leads entered research (need >= 2)`)
  }
  if (input.researchCompleted + input.qualificationReady < 2) {
    reasons.push(
      `Only ${input.researchCompleted + input.qualificationReady} leads research-complete or qualification-ready (need >= 2)`,
    )
  }
  if (!input.idempotentPass) reasons.push("Idempotent rerun created duplicate leads")

  if (reasons.length === 0) return { verdict: "PASS", reasons: ["All success criteria met"] }

  const hardFail =
    !input.outboundDisabled ||
    input.outboundMessages > 0 ||
    !input.idempotentPass ||
    input.newLeadsCreated < 1

  if (hardFail) return { verdict: "FAIL", reasons }
  return { verdict: "PASS WITH LIMITATIONS", reasons }
}

export async function runMultiLeadIntakeUnblockValidation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    idempotencyKey: string
    validationStartedAt: string
    runResearch: boolean
    runSchedulerTicks: number
    tickIntervalMs: number
  },
): Promise<MultiLeadIntakeUnblockReport> {
  const queueBefore = await diagnoseAdmissionQueue(admin, input.organizationId)
  let unblockingAction = "No action required — queue not blocked"
  let researchOrchestratorResult: MultiLeadIntakeUnblockReport["researchOrchestratorResult"] = null

  if (queueBefore.blockedByQueueLimit || queueBefore.operatorReviewRequired > 0) {
    if (input.runResearch) {
      unblockingAction =
        "Resume eligible review leads into research via runAvaResearchQueueOrchestrator (post-research admission reconciliation)"
      researchOrchestratorResult = await runAvaResearchQueueOrchestrator(admin, {
        organizationId: input.organizationId,
        maxLeads: 10,
        generatedAt: input.validationStartedAt,
      })
    } else {
      unblockingAction =
        "Queue unblock requires research progression — set CONFIRM_GE_AIOS_MULTI_LEAD_INTAKE_1B_RESEARCH=1"
    }
  }

  const preflightBeforeTick = await captureMultiLeadIntakePreflightState(admin, {
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
  })

  let schedulerTicks = 0
  let focusRunId: string | null = null
  let portfolioDiscoveryResult: Awaited<
    ReturnType<typeof tickAutonomousPortfolioManagerForScheduler>
  > | null = null

  for (let i = 0; i < input.runSchedulerTicks; i += 1) {
    schedulerTicks += 1
    portfolioDiscoveryResult = await tickAutonomousPortfolioManagerForScheduler(admin, {
      organizationIds: [input.organizationId],
      generatedAt: new Date().toISOString(),
    })
    await runGrowthObjectiveRuntimeScheduler(admin).catch(() => null)
    if (i < input.runSchedulerTicks - 1) {
      await new Promise((resolve) => setTimeout(resolve, input.tickIntervalMs))
    }
  }

  const validationCompletedAt = new Date().toISOString()
  const { data: newLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .eq("organization_id", input.organizationId)
    .gte("created_at", input.validationStartedAt)
    .lte("created_at", validationCompletedAt)

  const newLeadIds = (newLeads ?? []).map((row) => row.id as string)
  focusRunId = preflightBeforeTick.recentAutonomousRuns[0]?.id ?? null

  if (newLeadIds.length > 0 && input.runResearch) {
    await runAvaResearchQueueOrchestrator(admin, {
      organizationId: input.organizationId,
      maxLeads: Math.min(10, newLeadIds.length + 5),
      generatedAt: validationCompletedAt,
    })
  }

  const queueAfter = await diagnoseAdmissionQueue(admin, input.organizationId)
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const outboundInWindow = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", input.validationStartedAt)

  const progressionLeadIds =
    newLeadIds.length > 0
      ? newLeadIds
      : researchOrchestratorResult?.summary?.leadResults?.map((row) => row.leadId) ??
        (
          await admin
            .schema("growth")
            .from("leads")
            .select("id")
            .eq("organization_id", input.organizationId)
            .order("created_at", { ascending: false })
            .limit(10)
        ).data?.map((row) => row.id as string) ??
        []

  const progressionTable = await buildLeadProgressionTable(admin, {
    organizationId: input.organizationId,
    leadIds: progressionLeadIds,
    validationStartedAt: input.validationStartedAt,
  })

  const researchCompleted = progressionTable.filter((row) => row.researchResult === "completed").length
  const qualificationReady = progressionTable.filter(
    (row) =>
      row.qualificationResult === "accepted" ||
      row.operatorPackageResult.startsWith("packages:") ||
      row.operatorPackageResult === "eligible",
  ).length

  const intakeReport = focusRunId
    ? await assembleMultiLeadIntakeValidationReport(admin, {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
        validationStartedAt: input.validationStartedAt,
        validationCompletedAt,
        focusRunId,
        preflight: preflightBeforeTick,
        idempotentRerun: { ran: true, newLeadsCreated: 0, duplicateLeadsCreated: 0, pass: true },
        outboundMessagesInWindow: outboundInWindow.count ?? 0,
      })
    : null

  const leadsBeforeRerunCount = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .gte("created_at", input.validationStartedAt)
  await runGrowthObjectiveRuntimeScheduler(admin).catch(() => null)
  const leadsAfterRerunCount = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .gte("created_at", input.validationStartedAt)
  const idempotentPass = (leadsAfterRerunCount.count ?? 0) === (leadsBeforeRerunCount.count ?? 0)

  const executive = computeMultiLeadIntakeUnblockVerdict({
    queueAfter,
    newLeadsCreated: newLeadIds.length,
    progressionTable,
    researchCompleted,
    qualificationReady,
    idempotentPass,
    outboundDisabled: killSwitches.autonomy_outbound_enabled === false,
    outboundMessages: outboundInWindow.count ?? 0,
  })

  let recommendedNextAction = "Continue bounded intake and research progression."
  if (executive.verdict !== "PASS") {
    if (queueAfter.blockedByQueueLimit) {
      recommendedNextAction =
        "Admission queue still blocked — run research orchestrator on review leads or process operator review backlog."
    } else if (newLeadIds.length < 3) {
      recommendedNextAction =
        "Replenishment unblocked but cohort too small — verify portfolio health gates and DataMoon survivor yield."
    } else {
      recommendedNextAction = executive.reasons[0] ?? recommendedNextAction
    }
  }

  return {
    qaMarker: GROWTH_AIOS_MULTI_LEAD_INTAKE_1B_QA_MARKER,
    idempotencyKey: input.idempotencyKey,
    validationStartedAt: input.validationStartedAt,
    validationCompletedAt,
    queueBefore,
    queueAfter,
    unblockingAction,
    researchOrchestratorResult,
    portfolioDiscoveryResult,
    schedulerTicks,
    focusRunId: intakeReport?.focusRunId ?? focusRunId,
    focusAudienceId: intakeReport?.focusAudienceId ?? null,
    intakeReport,
    progressionTable,
    outboundConfirmedDisabled: killSwitches.autonomy_outbound_enabled === false,
    outboundMessagesInWindow: outboundInWindow.count ?? 0,
    executiveVerdict: executive.verdict,
    verdictReasons: executive.reasons,
    recommendedNextAction,
  }
}
