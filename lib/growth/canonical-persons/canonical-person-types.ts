/** Phase 7.2B — Canonical person layer (client-safe types). */

export const GROWTH_CANONICAL_PERSON_QA_MARKER = "growth-canonical-person-7.2b-v1" as const

export const GROWTH_CANONICAL_PERSON_MIGRATION =
  "20270709120000_growth_engine_canonical_persons_7_2b.sql" as const

export const GROWTH_CANONICAL_PERSON_STATUSES = ["active", "merged", "suppressed"] as const
export type GrowthCanonicalPersonStatus = (typeof GROWTH_CANONICAL_PERSON_STATUSES)[number]

export const GROWTH_CANONICAL_PERSON_RESOLUTION_METHODS = [
  "normalized_email",
  "normalized_linkedin",
  "normalized_phone",
  "name_company",
  "new",
  "manual",
] as const
export type GrowthCanonicalPersonResolutionMethod =
  (typeof GROWTH_CANONICAL_PERSON_RESOLUTION_METHODS)[number]

export const GROWTH_CANONICAL_PERSON_SOURCE_TABLES = [
  "contact_candidates",
  "company_contacts",
  "lead_decision_makers",
] as const
export type GrowthCanonicalPersonSourceTable = (typeof GROWTH_CANONICAL_PERSON_SOURCE_TABLES)[number]

export type GrowthCanonicalPersonCandidateInput = {
  source_table: GrowthCanonicalPersonSourceTable
  source_id: string
  run_id: string | null
  provider_name: string
  provider_type: string
  discovery_source: string
  company_candidate_id?: string | null
  lead_id?: string | null
  canonical_company_id?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name: string
  title?: string | null
  department?: string | null
  seniority?: string | null
  location?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  email_verification_status?: string | null
  phone_verification_status?: string | null
  role_type?: string | null
  confidence?: number
  observed_at?: string | null
  source_metadata?: Record<string, unknown>
}

export type GrowthCanonicalPersonResolutionResult = {
  person_id: string | null
  resolution_method: GrowthCanonicalPersonResolutionMethod
  normalized_email: string | null
  normalized_linkedin: string | null
  normalized_phone: string | null
  name_company_key: string | null
  would_create_new: boolean
}

export const GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE = 40
export const GROWTH_CANONICAL_PERSON_BACKFILL_MAX_BATCH_SIZE = 100

export type GrowthCanonicalPersonBackfillCursor = {
  source_table: GrowthCanonicalPersonSourceTable
  after_id: string | null
  identity_counts: Record<string, number>
}

export type GrowthCanonicalPersonBackfillStats = {
  qa_marker: typeof GROWTH_CANONICAL_PERSON_QA_MARKER
  mode: "dry_run" | "apply"
  sources: Record<
    GrowthCanonicalPersonSourceTable,
    {
      rows_processed: number
      already_linked: number
      resolved_normalized_email: number
      resolved_normalized_linkedin: number
      resolved_normalized_phone: number
      resolved_name_company: number
      would_create_new: number
      errors: number
    }
  >
  canonical_persons_existing: number
  canonical_persons_after: number
  unique_normalized_emails: number
  merge_groups_by_email: number
}

export type GrowthCanonicalPersonBackfillErrorRow = {
  source_table: GrowthCanonicalPersonSourceTable
  source_id: string
  message: string
}

export type GrowthCanonicalPersonBackfillVerification = {
  passed: boolean
  pending_by_source: Record<GrowthCanonicalPersonSourceTable, number>
  pending_total: number
}

export type GrowthCanonicalPersonBackfillResult = {
  stats: GrowthCanonicalPersonBackfillStats
  done: boolean
  cursor: GrowthCanonicalPersonBackfillCursor | null
  progress: {
    batch_size: number
    processed_in_chunk: number
    current_source_table: GrowthCanonicalPersonSourceTable
  }
  pending_by_source: Record<GrowthCanonicalPersonSourceTable, number>
  pending_total: number
  error_rows: GrowthCanonicalPersonBackfillErrorRow[]
  verification: GrowthCanonicalPersonBackfillVerification | null
  certification: "pass" | "conditional_pass" | "fail" | null
}
