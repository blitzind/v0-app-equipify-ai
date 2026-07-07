/** GE-AVA-AUTONOMY-EXECUTION-REQUEST-1 — Channel-agnostic execution hand-off (client-safe). */

export const GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER =
  "ge-ava-autonomy-execution-request-1-v1" as const

export const GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_FEATURE_FLAG =
  "GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_ENABLED" as const

export const GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY =
  "ava_outreach_execution_requests" as const

export const GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT =
  "growth.ava.outreach_execution_request" as const

export const GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT =
  "growth.ava.outreach_package_approval" as const

export const GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_STATUSES = [
  "pending_fulfillment",
  "queued",
  "awaiting_manual_channel",
  "failed",
  "rejected",
  "cancelled",
] as const

export type GrowthAvaOutreachExecutionRequestStatus =
  (typeof GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_STATUSES)[number]

export type GrowthAvaOutreachExecutionRequestChannel =
  | "email"
  | "sms"
  | "voice"
  | "linkedin"
  | "video"
  | "marketing"
  | "call"
  | "follow_up"
  | "unknown"

export type GrowthAvaOutreachPackageApprovalDecision = "approve" | "reject"

export type GrowthAvaOutreachExecutionRequest = {
  qa_marker: typeof GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER
  requestId: string
  organizationId: string
  leadId: string
  packageId: string
  approvedBy: string
  approvedAt: string
  recommendedChannel: GrowthAvaOutreachExecutionRequestChannel
  recommendedCadence: string | null
  executionStatus: GrowthAvaOutreachExecutionRequestStatus
  sequenceJobId: string | null
  sequenceEnrollmentId: string | null
  sequenceStepId: string | null
  fulfillmentError: string | null
  fulfilledAt: string | null
}

export type GrowthAvaOutreachPackageApprovalResult = {
  qa_marker: typeof GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER
  decision: GrowthAvaOutreachPackageApprovalDecision
  packageId: string
  leadId: string
  executionRequest: GrowthAvaOutreachExecutionRequest | null
}
