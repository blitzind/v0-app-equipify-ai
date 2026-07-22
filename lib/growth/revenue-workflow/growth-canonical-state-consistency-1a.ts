/**
 * GE-AIOS-INVESTMENT-RECONCILIATION-1A — Canonical lead/admission/investment consistency checks.
 * Reuses admission drift helpers — no duplicate monitoring authority.
 */

import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  resolveLeadQueueMembership,
  resolveOutreachEligibility,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-drift"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import {
  evaluateResourceAllocationFacade,
  type AiOsInvestmentState,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_CANONICAL_STATE_CONSISTENCY_1A_QA_MARKER =
  "ge-aios-investment-reconciliation-1a-v1" as const

export const GROWTH_CANONICAL_STATE_INCONSISTENCY_KINDS = [
  "admission_accepted_status_disqualified",
  "admission_accepted_status_archived",
  "admission_rejected_status_active",
  "admission_accepted_stop_investment_from_status",
  "admission_accepted_outreach_blocked_by_status",
  "archived_with_pending_approval_package",
] as const

export type GrowthCanonicalStateInconsistencyKind =
  (typeof GROWTH_CANONICAL_STATE_INCONSISTENCY_KINDS)[number]

export type GrowthCanonicalStateInconsistency = {
  kind: GrowthCanonicalStateInconsistencyKind
  leadId: string
  companyName: string | null
  admissionState: GrowthLeadAdmissionState | null
  leadStatus: string | null
  investmentState: AiOsInvestmentState | null
  investmentReason: string | null
  detail: string
}

export type GrowthCanonicalStateConsistencyReport = {
  qaMarker: typeof GROWTH_CANONICAL_STATE_CONSISTENCY_1A_QA_MARKER
  scannedLeadCount: number
  inconsistencyCount: number
  byKind: Record<GrowthCanonicalStateInconsistencyKind, number>
  inconsistencies: GrowthCanonicalStateInconsistency[]
}

function emptyKindCounts(): Record<GrowthCanonicalStateInconsistencyKind, number> {
  return {
    admission_accepted_status_disqualified: 0,
    admission_accepted_status_archived: 0,
    admission_rejected_status_active: 0,
    admission_accepted_stop_investment_from_status: 0,
    admission_accepted_outreach_blocked_by_status: 0,
    archived_with_pending_approval_package: 0,
  }
}

export function evaluateGrowthCanonicalStateConsistencyForLead(input: {
  lead: Pick<
    GrowthLead,
    | "id"
    | "companyName"
    | "status"
    | "metadata"
    | "prospectRecommendedNextAction"
    | "nextBestAction"
    | "lastProspectResearchedAt"
    | "latestProspectResearchRunId"
    | "score"
  >
  organizationId: string
  hasPendingApprovalPackage?: boolean
}): GrowthCanonicalStateInconsistency[] {
  const admissionState = resolveLeadAdmissionStateFromMetadata(input.lead.metadata)
  const leadStatus = input.lead.status ?? null
  const signals = buildResourceAllocationSignalsFromLead(input.lead, {
    budgetAvailable: true,
    killSwitchActive: false,
  })
  const investment = evaluateResourceAllocationFacade({
    organizationId: input.organizationId,
    accountId: input.lead.id,
    resourceClass: "email_drafting",
    signals,
  })
  const queueMembership = resolveLeadQueueMembership({
    status: leadStatus,
    suppressed: input.lead.metadata?.suppressed === true,
  })
  const outreachEligible = resolveOutreachEligibility({
    evaluation: {
      state: admissionState ?? "review",
      reasons: [],
      allowLeadCreation: true,
      allowAutoResearch: true,
      leadStatus: leadStatus === "disqualified" ? "disqualified" : "new",
      requiresHumanReview: false,
      blockers: [],
      sanitized: { companyName: input.lead.companyName ?? "", website: null, domain: null },
      qa_marker: "ge-aios-21c-lead-admission-gate-v1",
    },
    status: leadStatus,
    suppressed: input.lead.metadata?.suppressed === true,
  })

  const rows: GrowthCanonicalStateInconsistency[] = []
  const base = {
    leadId: input.lead.id,
    companyName: input.lead.companyName,
    admissionState,
    leadStatus,
    investmentState: investment.investment_state,
    investmentReason: investment.reason,
  }

  if (admissionState === "accepted" && leadStatus === "disqualified") {
    rows.push({
      ...base,
      kind: "admission_accepted_status_disqualified",
      detail:
        "Admission metadata is accepted but lead.status remains disqualified — Resource Allocation stop condition blocks Draft Factory.",
    })
  }

  if (admissionState === "accepted" && leadStatus === "archived") {
    rows.push({
      ...base,
      kind: "admission_accepted_status_archived",
      detail: "Admission metadata is accepted but lead.status is archived.",
    })
  }

  if (
    (admissionState === "rejected" || admissionState === "invalid") &&
    leadStatus !== "disqualified" &&
    leadStatus !== "archived"
  ) {
    rows.push({
      ...base,
      kind: "admission_rejected_status_active",
      detail: `Admission is ${admissionState} but lead.status is ${leadStatus ?? "unknown"}.`,
    })
  }

  if (
    admissionState === "accepted" &&
    leadStatus === "disqualified" &&
    investment.investment_state === "stop_investment" &&
    signals.stopConditionActive === true
  ) {
    rows.push({
      ...base,
      kind: "admission_accepted_stop_investment_from_status",
      detail: investment.reason,
    })
  }

  if (admissionState === "accepted" && !outreachEligible && queueMembership === "disqualified") {
    rows.push({
      ...base,
      kind: "admission_accepted_outreach_blocked_by_status",
      detail: "Admission accepted but queue membership is disqualified due to lead.status.",
    })
  }

  if (leadStatus === "archived" && input.hasPendingApprovalPackage === true) {
    rows.push({
      ...base,
      kind: "archived_with_pending_approval_package",
      detail: "Archived lead still has a pending approval package.",
    })
  }

  return rows
}

export function summarizeGrowthCanonicalStateConsistency(
  inconsistencies: GrowthCanonicalStateInconsistency[],
  scannedLeadCount: number,
): GrowthCanonicalStateConsistencyReport {
  const byKind = emptyKindCounts()
  for (const row of inconsistencies) {
    byKind[row.kind] += 1
  }
  return {
    qaMarker: GROWTH_CANONICAL_STATE_CONSISTENCY_1A_QA_MARKER,
    scannedLeadCount,
    inconsistencyCount: inconsistencies.length,
    byKind,
    inconsistencies,
  }
}
