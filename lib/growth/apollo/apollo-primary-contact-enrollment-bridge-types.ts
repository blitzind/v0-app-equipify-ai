/** Apollo-Primary-3 enrollment approval bridge types — client-safe. */

import type {
  ApolloPrimaryContactEnrichmentStatus,
  ApolloPrimaryContactOperatorReviewRow,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

export const APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER =
  "apollo-primary-contact-enrollment-bridge-v3" as const

export const APOLLO_PRIMARY_CONTACT_ENROLLMENT_QUEUE_STATUSES = [
  "pending_enrollment_approval",
  "enrollment_approved",
  "enrollment_rejected",
] as const

export type ApolloPrimaryContactEnrollmentQueueStatus =
  (typeof APOLLO_PRIMARY_CONTACT_ENROLLMENT_QUEUE_STATUSES)[number]

export type ApolloPrimaryContactEnrollmentQueueRow = {
  queue_item_id: string
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  operator_review_id: string | null
  status: ApolloPrimaryContactEnrollmentQueueStatus
  full_name: string
  title: string | null
  company_name: string
  source: "Apollo"
  enrichment_status: ApolloPrimaryContactEnrichmentStatus
  contactable: boolean
  sequence_ready: boolean
  blockers: string[]
  sequence_ready_at_handoff: boolean
  blockers_at_handoff: string[]
  handoff_at: string
  enrollment_approved_at: string | null
  enrollment_approved_email: string | null
}

export type ApolloPrimaryContactEnrollmentApprovalQueueSnapshot = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER
  items: ApolloPrimaryContactEnrollmentQueueRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    sequence_ready: number
    contactable: number
  }
  auto_enrollment: false
  outreach_sent: false
}

export type ApolloPrimaryContactEnrollmentHandoffEvidence = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_ENROLLMENT_BRIDGE_QA_MARKER
  handoff_id: string
  queue_item_id: string
  operator_review_id: string | null
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  sequence_ready_at_handoff: boolean
  blockers_at_handoff: string[]
  auto_enrollment: false
  outreach_sent: false
  recorded_at: string
}

export type ApolloPrimaryContactEnrollmentBridgeActionResult = {
  ok: boolean
  action: "handoff" | "approve_enrollment" | "reject_enrollment" | "bulk_handoff"
  queue_item_id: string | null
  queue_item_ids: string[]
  status: ApolloPrimaryContactEnrollmentQueueStatus | null
  error?: string | null
  handoff?: ApolloPrimaryContactEnrollmentHandoffEvidence | null
  auto_enrollment: false
  outreach_sent: false
  enrolled_count: 0
  outreach_count: 0
}

export type ApolloEnrollmentBridgeHandoffGateResult = {
  allowed: boolean
  code: string | null
  reason: string | null
  contact_row: ApolloPrimaryContactOperatorReviewRow | null
}
