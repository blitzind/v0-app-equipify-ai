/** Apollo-Primary-2 operator review types — client-safe. */

export const APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER =
  "apollo-primary-contact-operator-review-v2" as const

export const APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const

export type ApolloPrimaryContactOperatorReviewStatus =
  (typeof APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_STATUSES)[number]

export const APOLLO_PRIMARY_CONTACT_ENRICHMENT_STATUSES = [
  "not_enriched",
  "partial",
  "enriched",
  "channel_ready",
] as const

export type ApolloPrimaryContactEnrichmentStatus =
  (typeof APOLLO_PRIMARY_CONTACT_ENRICHMENT_STATUSES)[number]

export type ApolloPrimaryContactChannelAvailability = {
  email: boolean
  linkedin: boolean
  phone: boolean
}

export type ApolloPrimaryContactOperatorReviewRow = {
  row_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  full_name: string
  title: string | null
  company_name: string
  source: "Apollo"
  channel_availability: ApolloPrimaryContactChannelAvailability
  enrichment_status: ApolloPrimaryContactEnrichmentStatus
  contactable: boolean
  sequence_ready: boolean
  operator_review_status: ApolloPrimaryContactOperatorReviewStatus
  outreach_ready: boolean
  blockers: string[]
  contact_status: string | null
  email_status: string | null
  phone_status: string | null
}

export type ApolloPrimaryContactOperatorReviewSnapshot = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  contacts: ApolloPrimaryContactOperatorReviewRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    contactable: number
    sequence_ready: number
    sequence_ready_pending_approval: number
  }
  auto_enrollment: false
  outreach_sent: false
}

export type ApolloPrimaryContactOperatorReviewActionResult = {
  ok: boolean
  action: "approve" | "reject" | "bulk_approve"
  review_id: string | null
  contact_id: string | null
  contact_ids: string[]
  operator_review_status: ApolloPrimaryContactOperatorReviewStatus | null
  error?: string | null
  auto_enrollment: false
  outreach_sent: false
  enrolled_count: 0
  outreach_count: 0
}

export type ApolloPrimaryContactOperatorReviewEvidence = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_OPERATOR_REVIEW_QA_MARKER
  review_id: string
  action: "approve" | "reject" | "bulk_approve"
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  operator_review_status: "approved" | "rejected"
  reviewer_user_id: string | null
  reviewer_email: string | null
  sequence_ready_at_action: boolean
  blockers_at_action: string[]
  note: string | null
  auto_enrollment: false
  outreach_sent: false
  recorded_at: string
}
