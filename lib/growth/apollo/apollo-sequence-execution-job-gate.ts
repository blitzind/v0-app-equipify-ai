/** Apollo sequence execution job approval gate — client-safe. */

import type { ApolloSequenceExecutionCandidateStatus } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"

export const APOLLO_SEQUENCE_EXECUTION_JOB_GATE_QA_MARKER =
  "apollo-sequence-execution-job-gate-v1" as const

export const APOLLO_DRAFT_REJECTED_JOB_SKIP_REASON = "apollo_draft_rejected" as const

export type ApolloSequenceExecutionJobApprovalGateResult = {
  allowed: boolean
  code: string | null
  operator_message: string | null
  apollo_candidate_status: ApolloSequenceExecutionCandidateStatus | null
}

export function evaluateApolloSequenceExecutionJobApprovalGate(input: {
  apollo_candidate_status: ApolloSequenceExecutionCandidateStatus | null
}): ApolloSequenceExecutionJobApprovalGateResult {
  const status = input.apollo_candidate_status
  if (!status) {
    return {
      allowed: true,
      code: null,
      operator_message: null,
      apollo_candidate_status: null,
    }
  }

  if (status === "execution_ready") {
    return {
      allowed: true,
      code: null,
      operator_message: null,
      apollo_candidate_status: status,
    }
  }

  if (status === "pending_draft_approval" || status === "draft_regenerated") {
    return {
      allowed: false,
      code: "apollo_draft_approval_required",
      operator_message:
        "Approve sequence drafts in the Sequence Execution Queue before approving execution jobs.",
      apollo_candidate_status: status,
    }
  }

  if (status === "draft_rejected") {
    return {
      allowed: false,
      code: "apollo_draft_rejected",
      operator_message:
        "Drafts were rejected — regenerate drafts in the Sequence Execution Queue before approving jobs.",
      apollo_candidate_status: status,
    }
  }

  return {
    allowed: false,
    code: "apollo_draft_approval_required",
    operator_message: "Apollo draft approval required before job approval.",
    apollo_candidate_status: status,
  }
}
