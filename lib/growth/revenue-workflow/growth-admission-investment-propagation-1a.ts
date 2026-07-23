/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1A — Admission reconciliation → investment_changed wake (client-safe).
 * Resource Allocation (SV1-1) remains sole investment authority; this module only detects input deltas.
 */

import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { resolveBoundedResearchAuthorizationFromMetadata } from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_ADMISSION_INVESTMENT_PROPAGATION_1A_QA_MARKER =
  "ge-aios-investment-propagation-1a-v1" as const

export type GrowthResourceAllocationInputSnapshot = {
  admissionState: string | null
  leadStatus: string | null
  stopConditionActive: boolean
  stopConditionReason: string | null
  investmentState: string
  spendAuthorized: boolean
  /** GE-AIOS-INVESTMENT-PROPAGATION-1B */
  researchSufficiencyDecision: string | null
  boundedResearchAuthorized: boolean
  boundedInvestmentRemaining: number
}

export function captureGrowthResourceAllocationInputSnapshot(
  lead: Pick<
    GrowthLead,
    | "id"
    | "status"
    | "metadata"
    | "prospectRecommendedNextAction"
    | "nextBestAction"
    | "lastProspectResearchedAt"
    | "latestProspectResearchRunId"
    | "score"
  >,
  organizationId: string,
): GrowthResourceAllocationInputSnapshot {
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
  const metadata =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {}
  const bounded = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  return {
    admissionState: resolveLeadAdmissionStateFromMetadata(lead.metadata),
    leadStatus: lead.status ?? null,
    stopConditionActive: signals.stopConditionActive === true,
    stopConditionReason: signals.stopConditionReason ?? null,
    investmentState: investment.investment_state,
    spendAuthorized: investment.spend_authorized,
    researchSufficiencyDecision:
      typeof metadata.research_sufficiency_decision === "string"
        ? metadata.research_sufficiency_decision
        : null,
    boundedResearchAuthorized: bounded.authorized,
    boundedInvestmentRemaining: bounded.investmentRemaining,
  }
}

export function hasMaterialResourceAllocationInputChange(
  before: GrowthResourceAllocationInputSnapshot,
  after: GrowthResourceAllocationInputSnapshot,
): boolean {
  return (
    before.admissionState !== after.admissionState ||
    before.leadStatus !== after.leadStatus ||
    before.stopConditionActive !== after.stopConditionActive ||
    before.investmentState !== after.investmentState ||
    before.spendAuthorized !== after.spendAuthorized ||
    before.researchSufficiencyDecision !== after.researchSufficiencyDecision ||
    before.boundedResearchAuthorized !== after.boundedResearchAuthorized ||
    before.boundedInvestmentRemaining !== after.boundedInvestmentRemaining
  )
}

/** Stable wake source for investment_changed idempotency — identical canonical inputs → duplicate_noop. */
export function buildInvestmentChangedWakeSourceId(
  snapshot: GrowthResourceAllocationInputSnapshot,
): string {
  return [
    "admission-reconcile",
    snapshot.admissionState ?? "unknown",
    snapshot.leadStatus ?? "unknown",
    snapshot.stopConditionActive ? "stop" : "active",
    snapshot.investmentState,
    snapshot.spendAuthorized ? "spend" : "no-spend",
    snapshot.researchSufficiencyDecision ?? "legacy",
    snapshot.boundedResearchAuthorized ? "bounded" : "unbounded",
    String(snapshot.boundedInvestmentRemaining),
  ].join(":")
}
