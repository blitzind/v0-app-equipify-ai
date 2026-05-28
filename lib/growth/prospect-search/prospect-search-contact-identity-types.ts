/** Contact identity resolution types — client-safe. */

import type { ProspectSearchContactEvidence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER =
  "growth-contact-identity-resolution-v1" as const
export const GROWTH_EVIDENCE_FUSION_QA_MARKER = "growth-evidence-fusion-v1" as const
export const GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER = "growth-contact-conflict-review-v1" as const

export const PROSPECT_SEARCH_CONTACT_CONFLICT_STATUSES = [
  "no_conflict",
  "needs_review",
  "likely_same_person",
  "likely_different_people",
  "channel_conflict",
  "branch_conflict",
] as const

export type ProspectSearchContactConflictStatus =
  (typeof PROSPECT_SEARCH_CONTACT_CONFLICT_STATUSES)[number]

export const PROSPECT_SEARCH_CONTACT_IDENTITY_OPERATOR_ACTIONS = [
  "confirm_same_person",
  "keep_separate",
  "mark_channel_role_shared",
  "mark_title_outdated",
  "mark_contact_invalid",
  "mark_contact_confirmed",
  "add_note",
] as const

export type ProspectSearchContactIdentityOperatorAction =
  (typeof PROSPECT_SEARCH_CONTACT_IDENTITY_OPERATOR_ACTIONS)[number]

export type ProspectSearchContactIdentitySourceRecord = {
  contact_id: string
  provider: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  branch_name: string | null
  branch_city: string | null
  branch_state: string | null
  source_page_url: string | null
  confidence: number
  evidence_quality_label: string | null
  discovered_at: string | null
}

export type ProspectSearchContactIdentityConflict = {
  status: ProspectSearchContactConflictStatus
  label: string
  detail: string
  source_contact_ids: string[]
}

export type ProspectSearchContactCanonicalChannelSelection = {
  value: string | null
  source_contact_id: string | null
  provider: string | null
  reasons: string[]
  downgraded_alternatives: string[]
}

export type ProspectSearchContactCanonicalSnapshot = {
  display_name: string
  best_title: string | null
  best_email: ProspectSearchContactCanonicalChannelSelection
  best_phone: ProspectSearchContactCanonicalChannelSelection
  best_linkedin: ProspectSearchContactCanonicalChannelSelection
  best_branch_name: string | null
  best_branch_city: string | null
  best_branch_state: string | null
  best_source: string | null
  confidence: number
  selection_summary: string[]
}

export type ProspectSearchContactIdentityTimelineEvent = {
  id: string
  kind:
    | "discovered"
    | "merged_from_source"
    | "email_observed"
    | "phone_observed"
    | "title_changed"
    | "branch_observed"
    | "conflict_detected"
    | "operator_confirmed"
    | "operator_review"
    | "verification_refreshed"
    | "routed_queue"
    | "added_pipeline"
    | "exported"
  label: string
  detail: string
  occurred_at: string | null
  source?: string | null
}

export type ProspectSearchContactIdentityOperatorReview = {
  action: ProspectSearchContactIdentityOperatorAction
  note: string | null
  reviewed_at: string
  reviewed_by?: string | null
  confidence_adjustment: number
}

export type ProspectSearchContactIdentityResolution = {
  qa_marker: typeof GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER
  identity_key: string
  merge_confidence: number
  identity_confidence: number
  primary_name: string
  primary_title: string | null
  known_emails: string[]
  known_phones: string[]
  known_linkedin_urls: string[]
  known_branches: string[]
  source_evidence: ProspectSearchContactEvidence[]
  source_records: ProspectSearchContactIdentitySourceRecord[]
  source_count: number
  conflict_status: ProspectSearchContactConflictStatus
  conflicts: ProspectSearchContactIdentityConflict[]
  conflict_flags: string[]
  canonical: ProspectSearchContactCanonicalSnapshot
  timeline: ProspectSearchContactIdentityTimelineEvent[]
  operator_confirmed: boolean
  operator_review: ProspectSearchContactIdentityOperatorReview | null
  primary_contact_id: string
}

export type ProspectSearchContactIdentityOverlayFields = {
  contact_identity_key: string | null
  identity_confidence: number | null
  merge_confidence: number | null
  conflict_status: ProspectSearchContactConflictStatus | null
  source_count: number | null
  operator_confirmed: boolean
  identity_resolution?: ProspectSearchContactIdentityResolution | null
}
