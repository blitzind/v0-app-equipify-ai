/** GE-AIOS-NEXT-3B — Operator decision history evidence (client-safe). */

import type {
  GrowthEvidenceCompletenessClassification,
  GrowthOperatorDecisionHistoryFinding,
} from "./growth-organizational-evidence-completeness-next-3b-types"

export function buildOperatorDecisionHistoryFinding(input: {
  packageApprovedInPeriod: number
  packageRejectedInPeriod: number
  pendingApprovals: number
  memoryDecisionEvents: number
  memoryApprovalEvents: number
  workflowRequestsAcceptedInPeriod: number
  workflowRequestsCompletedInPeriod: number
  workflowRequestsTotal: number
}): GrowthOperatorDecisionHistoryFinding {
  const durableSignals =
    input.packageApprovedInPeriod +
    input.packageRejectedInPeriod +
    input.memoryDecisionEvents +
    input.memoryApprovalEvents +
    input.workflowRequestsAcceptedInPeriod

  let completeness: GrowthEvidenceCompletenessClassification = "partially_available"
  if (durableSignals >= 3) completeness = "available"
  else if (durableSignals === 0 && input.pendingApprovals === 0) completeness = "insufficient_evidence"

  return {
    completeness,
    packageApprovedInPeriod: input.packageApprovedInPeriod,
    packageRejectedInPeriod: input.packageRejectedInPeriod,
    pendingApprovals: input.pendingApprovals,
    organizationalMemoryDecisionEvents: input.memoryDecisionEvents + input.memoryApprovalEvents,
    workflowRequestsAcceptedInPeriod: input.workflowRequestsAcceptedInPeriod,
    workflowRequestsCompletedInPeriod: input.workflowRequestsCompletedInPeriod,
    strategicOverrideEvents: 0,
    completenessNote:
      "Strategic override history remains browser-local — server-side override counts are not durable yet.",
  }
}
