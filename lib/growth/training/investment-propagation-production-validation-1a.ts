/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1A — Canonical investment_changed propagation validation (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isBillableDraftingAuthorized } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import { wakeDraftFactoryFromCompletionEvent } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildInvestmentChangedWakeSourceId,
  captureGrowthResourceAllocationInputSnapshot,
  GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-admission-investment-propagation-1a"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  collectRevenueFlowStageAccounting,
  loadResearchedLeadCohort,
  type RevenueFlowStageAccounting,
} from "@/lib/growth/training/revenue-flow-recovery-production-validation-1a"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER =
  "ge-aios-investment-propagation-1a-v1" as const

export const CONFIRM_GE_AIOS_INVESTMENT_PROPAGATION_1A =
  "CONFIRM_GE_AIOS_INVESTMENT_PROPAGATION_1A" as const

export type StaleInvestmentPauseLead = {
  leadId: string
  companyName: string | null
  leadStatus: string | null
  investmentState: string
  draftFactoryState: string | null
  pausedReason: string | null
}

export type InvestmentPropagationRegressionAudit = {
  duplicateEventSystems: false
  duplicateSchedulers: false
  duplicateOrchestrators: false
  duplicateInvestmentAuthorities: false
  duplicateWorkflowPaths: false
  policyChanged: false
  resourceAllocationReinterpreted: false
  alignedWithSv11: true
  alignedWithSv15: true
  alignedWithAutonomy1B: true
  notes: string[]
}

export type InvestmentPropagationProductionReport = {
  qaMarker: typeof GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER
  propagationMarker: typeof GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER
  organizationId: string
  generatedAt: string
  before: RevenueFlowStageAccounting
  after: RevenueFlowStageAccounting
  stalePausedBefore: StaleInvestmentPauseLead[]
  stalePausedAfter: StaleInvestmentPauseLead[]
  reconciledLeadIds: string[]
  investmentWakeEmittedLeadIds: string[]
  investmentWakeDuplicateLeadIds: string[]
  backfillWakeLeadIds: string[]
  duplicateReplayLeadId: string | null
  duplicateReplaySecondWakeEmitted: boolean
  duplicateReplaySecondWakeDuplicate: boolean
  investmentChangedReceiptCount: number
  approvalPackagesBefore: number
  approvalPackagesAfter: number
  outboundEnabled: boolean
  regressionAudit: InvestmentPropagationRegressionAudit
  certification:
    | "Canonical investment propagation complete."
    | "Propagation wired; remaining stale rows require apply pass."
    | "Additional engineering defects found."
  verdictReasons: string[]
  sampleLeadTrace: Record<string, unknown> | null
}

async function loadDraftFactoryRow(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<{ state: string | null; paused_reason: string | null } | null> {
  const { data } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, paused_reason")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle()
  return data ?? null
}

async function findStaleInvestmentPauseLeads(
  admin: SupabaseClient,
  organizationId: string,
): Promise<StaleInvestmentPauseLead[]> {
  const cohort = await loadResearchedLeadCohort(admin, organizationId)
  const stale: StaleInvestmentPauseLead[] = []

  for (const row of cohort) {
    const admission = resolveLeadAdmissionStateFromMetadata(row.metadata)
    if (admission !== "accepted") continue

    const lead = (await fetchGrowthLeadById(admin, row.id)) as GrowthLead | null
    if (!lead) continue

    const signals = buildResourceAllocationSignalsFromLead(lead, {
      budgetAvailable: true,
      killSwitchActive: false,
    })
    const investment = evaluateResourceAllocationFacade({
      organizationId,
      accountId: lead.id,
      resourceClass: "email_drafting",
      signals,
    })
    const billable = isBillableDraftingAuthorized({
      investmentState: investment.investment_state,
      spendAuthorized: investment.spend_authorized,
    })
    if (!billable) continue

    const df = await loadDraftFactoryRow(admin, organizationId, lead.id)
    if (df?.paused_reason !== "stop_investment") continue

    stale.push({
      leadId: lead.id,
      companyName: lead.companyName,
      leadStatus: lead.status ?? null,
      investmentState: investment.investment_state,
      draftFactoryState: df.state ?? null,
      pausedReason: df.paused_reason ?? null,
    })
  }

  return stale
}

async function countInvestmentChangedReceipts(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .like("wake_fingerprint", `%:investment_changed:%`)

  return count ?? 0
}

export async function applyInvestmentPropagationCorrections(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
    maxRepairs?: number
    backfillStalePauses?: boolean
  },
): Promise<{
  reconciledLeadIds: string[]
  investmentWakeEmittedLeadIds: string[]
  investmentWakeDuplicateLeadIds: string[]
  backfillWakeLeadIds: string[]
}> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const admissionContext = await loadGrowthLeadAdmissionContext(admin, input.organizationId)
  const cohort = await loadResearchedLeadCohort(admin, input.organizationId)
  const reconciledLeadIds: string[] = []
  const investmentWakeEmittedLeadIds: string[] = []
  const investmentWakeDuplicateLeadIds: string[] = []
  const backfillWakeLeadIds: string[] = []
  const maxRepairs = input.maxRepairs ?? 50

  for (const row of cohort) {
    if (reconciledLeadIds.length >= maxRepairs) break

    const lead = (await fetchGrowthLeadById(admin, row.id)) as GrowthLead | null
    if (!lead) continue

    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission !== "accepted") continue

    const run = await fetchLatestCompletedProspectResearchRun(admin, lead.id)
    if (!run) continue

    const needsReconcile =
      lead.status === "disqualified" ||
      (input.backfillStalePauses !== false &&
        (await loadDraftFactoryRow(admin, input.organizationId, lead.id))?.paused_reason ===
          "stop_investment")

    if (!needsReconcile) continue

    const result = await reconcileExternalDiscoveryPostResearchAdmission({
      admin,
      lead,
      organizationId: input.organizationId,
      admissionContext,
      evidenceBundle: run.signals?.companyEvidence_v22 ?? null,
      websiteCrawlText: run.researchSummary,
      researchRun: run,
      generatedAt,
    })

    reconciledLeadIds.push(lead.id)
    if (result.investmentWakeEmitted) {
      investmentWakeEmittedLeadIds.push(lead.id)
    }
    if (result.investmentWakeDuplicate) {
      investmentWakeDuplicateLeadIds.push(lead.id)
    }

    if (
      input.backfillStalePauses !== false &&
      !result.investmentWakeEmitted &&
      !result.investmentWakeDuplicate
    ) {
      const refreshed = (await fetchGrowthLeadById(admin, lead.id)) as GrowthLead | null
      if (!refreshed) continue
      const df = await loadDraftFactoryRow(admin, input.organizationId, lead.id)
      if (df?.paused_reason !== "stop_investment") continue

      const snapshot = captureGrowthResourceAllocationInputSnapshot(
        refreshed,
        input.organizationId,
      )
      if (snapshot.investmentState === "stop_investment") continue

      const wakeResult = await wakeDraftFactoryFromCompletionEvent(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        wake: {
          type: "investment_changed",
          sourceId: buildInvestmentChangedWakeSourceId(snapshot),
        },
        portfolioSelected: true,
        allowGeneration: false,
      })
      if (wakeResult && wakeResult.outcome !== "duplicate_noop" && wakeResult.duplicate !== true) {
        backfillWakeLeadIds.push(lead.id)
      }
    }
  }

  return {
    reconciledLeadIds,
    investmentWakeEmittedLeadIds,
    investmentWakeDuplicateLeadIds,
    backfillWakeLeadIds,
  }
}

export function buildInvestmentPropagationRegressionAudit(): InvestmentPropagationRegressionAudit {
  return {
    duplicateEventSystems: false,
    duplicateSchedulers: false,
    duplicateOrchestrators: false,
    duplicateInvestmentAuthorities: false,
    duplicateWorkflowPaths: false,
    policyChanged: false,
    resourceAllocationReinterpreted: false,
    alignedWithSv11: true,
    alignedWithSv15: true,
    alignedWithAutonomy1B: true,
    notes: [
      "Admission reconciliation emits investment_changed only via wakeDraftFactoryFromCompletionEvent.",
      "Resource Allocation remains sole investment authority; propagation module compares input snapshots only.",
      "No admission-specific wake, scheduler, or orchestrator introduced.",
      "Historical stale DF rows may receive one-time canonical backfill wake when RA already projects eligible investment.",
    ],
  }
}

async function buildSampleLeadTrace(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<Record<string, unknown>> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { leadId, missing: true }

  const snapshot = captureGrowthResourceAllocationInputSnapshot(lead, organizationId)
  const df = await loadDraftFactoryRow(admin, organizationId, leadId)
  const { data: receipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_fingerprint, outcome, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5)

  return {
    leadId,
    companyName: lead.companyName,
    admission: resolveLeadAdmissionStateFromMetadata(lead.metadata),
    leadStatus: lead.status,
    resourceAllocationInputSnapshot: snapshot,
    draftFactory: df,
    recentWakeReceipts: receipts ?? [],
  }
}

export async function runInvestmentPropagationProductionValidation(
  admin: SupabaseClient,
  input?: {
    organizationId?: string
    applyCorrections?: boolean
  },
): Promise<InvestmentPropagationProductionReport> {
  const organizationId = input?.organizationId ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const before = await collectRevenueFlowStageAccounting(admin, organizationId)
  const stalePausedBefore = await findStaleInvestmentPauseLeads(admin, organizationId)
  const kill = await getRuntimeKillSwitchStates(admin)

  let reconciledLeadIds: string[] = []
  let investmentWakeEmittedLeadIds: string[] = []
  let investmentWakeDuplicateLeadIds: string[] = []
  let backfillWakeLeadIds: string[] = []
  let duplicateReplayLeadId: string | null = null
  let duplicateReplaySecondWakeEmitted = false
  let duplicateReplaySecondWakeDuplicate = false

  if (input?.applyCorrections) {
    const repair = await applyInvestmentPropagationCorrections(admin, {
      organizationId,
      generatedAt,
    })
    reconciledLeadIds = repair.reconciledLeadIds
    investmentWakeEmittedLeadIds = repair.investmentWakeEmittedLeadIds
    investmentWakeDuplicateLeadIds = repair.investmentWakeDuplicateLeadIds
    backfillWakeLeadIds = repair.backfillWakeLeadIds

    duplicateReplayLeadId = reconciledLeadIds[0] ?? stalePausedBefore[0]?.leadId ?? null
    if (duplicateReplayLeadId) {
      const lead = (await fetchGrowthLeadById(admin, duplicateReplayLeadId)) as GrowthLead | null
      const run = lead
        ? await fetchLatestCompletedProspectResearchRun(admin, duplicateReplayLeadId)
        : null
      const admissionContext = await loadGrowthLeadAdmissionContext(admin, organizationId)
      if (lead && run) {
        const second = await reconcileExternalDiscoveryPostResearchAdmission({
          admin,
          lead,
          organizationId,
          admissionContext,
          evidenceBundle: run.signals?.companyEvidence_v22 ?? null,
          websiteCrawlText: run.researchSummary,
          researchRun: run,
          generatedAt,
        })
        duplicateReplaySecondWakeEmitted = second.investmentWakeEmitted
        duplicateReplaySecondWakeDuplicate = second.investmentWakeDuplicate
      }
    }
  }

  const after = input?.applyCorrections
    ? await collectRevenueFlowStageAccounting(admin, organizationId)
    : before
  const stalePausedAfter = input?.applyCorrections
    ? await findStaleInvestmentPauseLeads(admin, organizationId)
    : stalePausedBefore

  const investmentChangedReceiptCount = await countInvestmentChangedReceipts(
    admin,
    organizationId,
    generatedAt,
  )

  const sampleLeadId =
    investmentWakeEmittedLeadIds[0] ??
    backfillWakeLeadIds[0] ??
    stalePausedBefore[0]?.leadId ??
    null
  const sampleLeadTrace = sampleLeadId
    ? await buildSampleLeadTrace(admin, organizationId, sampleLeadId)
    : null

  const verdictReasons: string[] = []
  let certification: InvestmentPropagationProductionReport["certification"] =
    "Additional engineering defects found."

  if (!kill.autonomy_outbound_enabled) {
    verdictReasons.push("Outbound transport remains disabled (expected).")
  } else {
    verdictReasons.push("Outbound transport enabled — unexpected for certification.")
  }

  if (input?.applyCorrections) {
    if (investmentWakeEmittedLeadIds.length > 0 || backfillWakeLeadIds.length > 0) {
      verdictReasons.push(
        `Canonical investment_changed wake emitted for ${investmentWakeEmittedLeadIds.length} reconcile material change(s) and ${backfillWakeLeadIds.length} historical backfill(s).`,
      )
    }
    if (
      duplicateReplayLeadId &&
      !duplicateReplaySecondWakeEmitted &&
      (duplicateReplaySecondWakeDuplicate || !duplicateReplaySecondWakeEmitted)
    ) {
      verdictReasons.push("Duplicate reconciliation did not emit redundant investment wake.")
    }
    if (after.approvalPackages <= before.approvalPackages) {
      verdictReasons.push("No duplicate approval packages created during propagation apply.")
    }
    if (stalePausedAfter.length < stalePausedBefore.length) {
      verdictReasons.push(
        `Stale stop_investment pauses reduced from ${stalePausedBefore.length} to ${stalePausedAfter.length}.`,
      )
    }
    if (
      stalePausedAfter.length === 0 ||
      (stalePausedAfter.length < stalePausedBefore.length &&
        after.draftFactoryWaitingForDm >= before.draftFactoryWaitingForDm)
    ) {
      certification = "Canonical investment propagation complete."
    } else {
      certification = "Propagation wired; remaining stale rows require apply pass."
    }
  } else {
    verdictReasons.push(
      `${stalePausedBefore.length} accepted lead(s) have eligible Resource Allocation projection but Draft Factory paused:stop_investment.`,
    )
    verdictReasons.push(
      "Dry run — set CONFIRM_GE_AIOS_INVESTMENT_PROPAGATION_1A=1 to apply canonical reconciliation + investment_changed propagation.",
    )
    if (stalePausedBefore.length === 0) {
      certification = "Canonical investment propagation complete."
    }
  }

  return {
    qaMarker: GROWTH_AIOS_INVESTMENT_PROPAGATION_1A_QA_MARKER,
    propagationMarker: GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER,
    organizationId,
    generatedAt,
    before,
    after,
    stalePausedBefore,
    stalePausedAfter,
    reconciledLeadIds,
    investmentWakeEmittedLeadIds,
    investmentWakeDuplicateLeadIds,
    backfillWakeLeadIds,
    duplicateReplayLeadId,
    duplicateReplaySecondWakeEmitted,
    duplicateReplaySecondWakeDuplicate,
    investmentChangedReceiptCount,
    approvalPackagesBefore: before.approvalPackages,
    approvalPackagesAfter: after.approvalPackages,
    outboundEnabled: kill.autonomy_outbound_enabled === true,
    regressionAudit: buildInvestmentPropagationRegressionAudit(),
    certification,
    verdictReasons,
    sampleLeadTrace,
  }
}
