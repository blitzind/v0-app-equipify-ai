import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  type GrowthSequenceApprovalGateInput,
  type GrowthSequenceApprovalGateResult,
} from "@/lib/growth/sequences/execution/sequence-execution-types"

export function evaluateSequenceApprovalGate(
  input: GrowthSequenceApprovalGateInput,
): GrowthSequenceApprovalGateResult {
  if (!input.job.requiresHumanApproval) {
    return { allowed: true, code: "ok", message: "Approval not required." }
  }

  if (input.job.humanApprovedAt && input.job.humanApprovedBy) {
    if (input.humanApproved !== true || input.humanApprovalConfirmed !== true) {
      return {
        allowed: false,
        code: "human_approval_confirmed_required",
        message: "Run request must include humanApproved=true and humanApprovalConfirmed=true.",
      }
    }
    if (!input.approvedBy) {
      return {
        allowed: false,
        code: "approved_by_required",
        message: "approvedBy user id is required.",
      }
    }
    return { allowed: true, code: "ok", message: "Job approved." }
  }

  return {
    allowed: false,
    code: "not_yet_approved",
    message: "Job is pending human approval.",
  }
}

export function assertSequenceRunApproval(input: GrowthSequenceApprovalGateInput): void {
  const gate = evaluateSequenceApprovalGate(input)
  if (!gate.allowed) {
    throw new Error(gate.code)
  }
}

export function buildSequenceApprovalMetadata(input: {
  approvedBy: string
  qaMarker?: typeof GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER
}): Record<string, unknown> {
  return {
    qa_marker: input.qaMarker ?? GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
    approved_by: input.approvedBy,
    source: "growth_sequence_safe_execution",
  }
}
