/** Phase 7.PS-HK — Human identity evidence review (client-safe types). */

export const GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER =
  "growth-human-identity-evidence-7-ps-hk-v1" as const

export const GROWTH_HUMAN_IDENTITY_EVIDENCE_MIGRATION =
  "20270721120000_growth_engine_company_contact_identity_reviews_7_ps_hk.sql" as const

export const GROWTH_HUMAN_IDENTITY_GENERIC_NAMES = [
  "company contact",
  "contact",
  "general contact",
  "info",
  "unknown",
  "team member",
  "staff",
] as const

export type HumanIdentityEvidenceReviewAction =
  | "mark_contact_verified"
  | "mark_phone_verified"
  | "update_name_from_evidence"
  | "update_title_from_evidence"

export type HumanIdentityEvidenceQueueItem = {
  company_contact_id: string
  company_id: string
  canonical_company_id: string | null
  canonical_person_id: string | null
  company_name: string
  full_name: string
  title: string | null
  phone: string | null
  email: string | null
  contact_status: string
  phone_status: string
  source_type: string
  source_url: string | null
  confidence_score: number
  priority_score: number
  priority_reasons: string[]
}

export type HumanIdentityEvidenceWorkspace = {
  queue_item: HumanIdentityEvidenceQueueItem
  source_evidence: Array<{
    claim: string
    evidence: string
    source: string
    page_url?: string | null
  }>
  canonical_person: {
    person_id: string
    full_name: string
    normalized_name: string
    first_name: string | null
    last_name: string | null
  } | null
  staging_trusted_preview: boolean
  promotion_confidence_preview: number
  allowed_actions: HumanIdentityEvidenceReviewAction[]
}

export type HumanIdentityEvidenceReviewInput = {
  company_contact_id: string
  actions: HumanIdentityEvidenceReviewAction[]
  full_name?: string | null
  title?: string | null
  review_note?: string | null
  rerun_phone_discovery?: boolean
}

export type HumanIdentityEvidenceReviewResult = {
  ok: boolean
  review_id: string | null
  company_contact_id: string
  fields_changed: string[]
  previous_values: Record<string, unknown>
  new_values: Record<string, unknown>
  phone_discovery: {
    run_id: string | null
    verified_count: number
    promoted_count: number
  } | null
  error?: string
}
