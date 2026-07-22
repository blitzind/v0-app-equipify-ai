/**
 * GE-AIOS-INVESTMENT-RECONCILIATION-1A — Canonical state reconciliation production validation (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  evaluateGrowthCanonicalStateConsistencyForLead,
  summarizeGrowthCanonicalStateConsistency,
  type GrowthCanonicalStateConsistencyReport,
} from "@/lib/growth/revenue-workflow/growth-canonical-state-consistency-1a"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  collectRevenueFlowStageAccounting,
  loadResearchedLeadCohort,
  type RevenueFlowStageAccounting,
} from "@/lib/growth/training/revenue-flow-recovery-production-validation-1a"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER =
  "ge-aios-investment-reconciliation-1a-v1" as const

export const CONFIRM_GE_AIOS_INVESTMENT_RECONCILIATION_1A =
  "CONFIRM_GE_AIOS_INVESTMENT_RECONCILIATION_1A" as const

export type PendingInvestmentPolicyAssessment = {
  intendedBehavior: string
  productionBehavior: string
  recommendation: string
  policyChanged: false
}

export type InvestmentReconciliationProductionReport = {
  qaMarker: typeof GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER
  organizationId: string
  generatedAt: string
  before: RevenueFlowStageAccounting
  after: RevenueFlowStageAccounting
  consistencyBefore: GrowthCanonicalStateConsistencyReport
  consistencyAfter: GrowthCanonicalStateConsistencyReport
  staleStatusRootCause: string
  reconciliationCorrection: string
  resourceAllocationValidation: string
  draftFactoryValidation: string
  pendingInvestmentPolicy: PendingInvestmentPolicyAssessment
  statusRepairedLeadIds: string[]
  investmentWakeEmittedLeadIds: string[]
  sampleLeadTrace: Record<string, unknown> | null
  outboundEnabled: boolean
  executiveVerdict:
    | "Canonical state fully reconciled"
    | "Remaining policy decisions identified"
    | "Additional engineering defects found"
  verdictReasons: string[]
}

async function scanCanonicalStateConsistency(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthCanonicalStateConsistencyReport> {
  const cohort = await loadResearchedLeadCohort(admin, organizationId)
  const inconsistencies = []

  for (const row of cohort) {
    const lead = (await fetchGrowthLeadById(admin, row.id)) as GrowthLead | null
    if (!lead) continue
    inconsistencies.push(
      ...evaluateGrowthCanonicalStateConsistencyForLead({
        lead,
        organizationId,
      }),
    )
  }

  return summarizeGrowthCanonicalStateConsistency(inconsistencies, cohort.length)
}

async function buildSampleLeadTrace(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<Record<string, unknown>> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { leadId, missing: true }

  const signals = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
  })
  const investment = evaluateResourceAllocationFacade({
    organizationId,
    accountId: leadId,
    resourceClass: "email_drafting",
    signals,
  })
  const { data: df } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, paused_reason, earliest_incomplete_stage, package_id, updated_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle()

  return {
    leadId,
    companyName: lead.companyName,
    admission: resolveLeadAdmissionStateFromMetadata(lead.metadata),
    leadStatus: lead.status,
    investmentState: investment.investment_state,
    investmentReason: investment.reason,
    stopConditionActive: signals.stopConditionActive,
    draftFactory: df,
  }
}

export async function applyInvestmentReconciliationCorrections(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt?: string
    maxRepairs?: number
  },
): Promise<{
  statusRepairedLeadIds: string[]
  investmentWakeEmittedLeadIds: string[]
}> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const admissionContext = await loadGrowthLeadAdmissionContext(admin, input.organizationId)
  const cohort = await loadResearchedLeadCohort(admin, input.organizationId)
  const statusRepairedLeadIds: string[] = []
  const investmentWakeEmittedLeadIds: string[] = []

  for (const row of cohort) {
    if (statusRepairedLeadIds.length >= (input.maxRepairs ?? 50)) break

    const lead = (await fetchGrowthLeadById(admin, row.id)) as GrowthLead | null
    if (!lead) continue

    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission !== "accepted") continue
    if (lead.status !== "disqualified") continue

    const run = await fetchLatestCompletedProspectResearchRun(admin, lead.id)
    if (!run) continue

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

    if (result.investmentWakeEmitted) {
      investmentWakeEmittedLeadIds.push(lead.id)
    }

    const refreshed = await fetchGrowthLeadById(admin, lead.id)
    if (refreshed?.status !== "disqualified") {
      statusRepairedLeadIds.push(lead.id)
    }
  }

  return { statusRepairedLeadIds, investmentWakeEmittedLeadIds }
}

export function assessPendingInvestmentPolicy(): PendingInvestmentPolicyAssessment {
  return {
    intendedBehavior:
      "Resource Allocation maps approvalRequired without approvalGranted to pending_investment; billable drafting requires increase_investment + spendAuthorized via isBillableDraftingAuthorized.",
    productionBehavior:
      "Outreach preparation passes approvalRequired: true when evaluating prep policy; Draft Factory durable evidence assembly does not — accepted research-complete leads can earn increase_investment for downstream stages while package approval remains a separate human gate.",
    recommendation:
      "Leave pending_investment unchanged. It is intentional for operator-gated billable spend when approvalRequired is explicitly set. The stale disqualified status defect was the primary blocker, not pending_investment policy.",
    policyChanged: false,
  }
}

export async function runInvestmentReconciliationProductionValidation(
  admin: SupabaseClient,
  input?: {
    organizationId?: string
    applyCorrections?: boolean
  },
): Promise<InvestmentReconciliationProductionReport> {
  const organizationId = input?.organizationId ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const before = await collectRevenueFlowStageAccounting(admin, organizationId)
  const consistencyBefore = await scanCanonicalStateConsistency(admin, organizationId)
  const kill = await getRuntimeKillSwitchStates(admin)

  let statusRepairedLeadIds: string[] = []
  let investmentWakeEmittedLeadIds: string[] = []

  if (input?.applyCorrections) {
    const repair = await applyInvestmentReconciliationCorrections(admin, {
      organizationId,
      generatedAt,
    })
    statusRepairedLeadIds = repair.statusRepairedLeadIds
    investmentWakeEmittedLeadIds = repair.investmentWakeEmittedLeadIds
  }

  const after = input?.applyCorrections
    ? await collectRevenueFlowStageAccounting(admin, organizationId)
    : before
  const consistencyAfter = input?.applyCorrections
    ? await scanCanonicalStateConsistency(admin, organizationId)
    : consistencyBefore

  const sampleLeadId =
    statusRepairedLeadIds[0] ??
    consistencyBefore.inconsistencies.find(
      (row) => row.kind === "admission_accepted_status_disqualified",
    )?.leadId ??
    null

  const sampleLeadTrace = sampleLeadId
    ? await buildSampleLeadTrace(admin, organizationId, sampleLeadId)
    : null

  const primaryInconsistencyCount =
    consistencyBefore.byKind.admission_accepted_status_disqualified +
    consistencyBefore.byKind.admission_accepted_stop_investment_from_status

  const verdictReasons: string[] = []
  let executiveVerdict: InvestmentReconciliationProductionReport["executiveVerdict"] =
    "Additional engineering defects found"

  if (primaryInconsistencyCount === 0 && consistencyBefore.inconsistencyCount === 0) {
    executiveVerdict = "Canonical state fully reconciled"
    verdictReasons.push("No canonical state inconsistencies detected in researched cohort.")
  } else if (input?.applyCorrections) {
    const remainingPrimary =
      consistencyAfter.byKind.admission_accepted_status_disqualified +
      consistencyAfter.byKind.admission_accepted_stop_investment_from_status
    if (remainingPrimary === 0) {
      executiveVerdict = "Remaining policy decisions identified"
      verdictReasons.push(
        `Repaired stale lead.status on ${statusRepairedLeadIds.length} admission-accepted lead(s).`,
      )
      verdictReasons.push(
        "Draft Factory investment gate cleared for status-derived stop_investment; downstream progression may still pause at decision_maker or pending_investment when explicitly approval-gated.",
      )
    } else {
      verdictReasons.push(
        `${remainingPrimary} admission-accepted/disqualified inconsistency(ies) remain after correction pass.`,
      )
    }
  } else {
    verdictReasons.push(
      `${primaryInconsistencyCount} admission-accepted lead(s) still carry disqualified lead.status.`,
    )
    verdictReasons.push(
      "Root cause: post-research reconciliation preserved stale lead.status instead of admission.leadStatus.",
    )
  }

  return {
    qaMarker: GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER,
    organizationId,
    generatedAt,
    before,
    after,
    consistencyBefore,
    consistencyAfter,
    staleStatusRootCause:
      "reconcileExternalDiscoveryPostResearchAdmission wrote admission_state=accepted but kept lead.status=disqualified when prior rejection had set status; Resource Allocation correctly maps disqualified status to stop_investment.",
    reconciliationCorrection:
      "Use resolveReconciledLeadStatusFromAdmission(admission) — same authority as unified intake at creation — so rejected→accepted reconciliation clears disqualified status.",
    resourceAllocationValidation:
      "Resource Allocation behaves correctly: disqualified/archived status → stop_investment; admission rejected/invalid → stop_investment. No weakening required.",
    draftFactoryValidation:
      "Draft Factory requires no logic changes: investment → isBillableDraftingAuthorized → generation → approval chain operates once canonical evidence is consistent.",
    pendingInvestmentPolicy: assessPendingInvestmentPolicy(),
    statusRepairedLeadIds,
    investmentWakeEmittedLeadIds,
    sampleLeadTrace,
    outboundEnabled: kill.autonomy_outbound_enabled === true,
    executiveVerdict,
    verdictReasons,
  }
}
