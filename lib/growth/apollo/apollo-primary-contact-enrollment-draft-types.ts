/** Apollo-Primary-4 enrollment draft bridge types — client-safe. */

import type { ApolloPrimaryContactEnrollmentQueueRow } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-types"

export const APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER =
  "apollo-primary-contact-enrollment-draft-v4" as const

export const APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Operator Approved",
  "Enrollment Queue",
  "Draft",
] as const

export type ApolloPrimaryContactEnrollmentSourceAttribution =
  (typeof APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION)[number]

export type ApolloPrimaryContactEnrollmentDraftEvidence = {
  queued_contacts: number
  draftable_contacts: number
  drafts_created: number
  blocked_contacts: number
}

export type ApolloPrimaryContactEnrollmentDraftQueueRow = ApolloPrimaryContactEnrollmentQueueRow & {
  source_attribution: ApolloPrimaryContactEnrollmentSourceAttribution[]
  growth_lead_id: string | null
  enrollment_draft_id: string | null
  draft_created_at: string | null
  draft_blockers: string[]
  draftable: boolean
}

export type ApolloPrimaryContactEnrollmentDraftSnapshot = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER
  items: ApolloPrimaryContactEnrollmentDraftQueueRow[]
  evidence: ApolloPrimaryContactEnrollmentDraftEvidence
  summary: {
    total: number
    approved: number
    draftable: number
    drafts_created: number
    blocked: number
  }
  source_attribution_chain: ApolloPrimaryContactEnrollmentSourceAttribution[]
  auto_enrollment: false
  outreach_sent: false
}

export type ApolloPrimaryContactEnrollmentDraftActionResult = {
  ok: boolean
  action: "create_enrollment_draft"
  queue_item_id: string | null
  growth_lead_id: string | null
  enrollment_draft_id: string | null
  source_attribution: ApolloPrimaryContactEnrollmentSourceAttribution[]
  error?: string | null
  blockers?: string[]
  auto_enrollment: false
  outreach_sent: false
  enrolled_count: 0
  outreach_count: 0
}

export type ApolloEnrollmentDraftGateResult = {
  allowed: boolean
  code: string | null
  reason: string | null
  blockers: string[]
}
