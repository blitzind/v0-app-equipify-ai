/** Phase 7.2A — Canonical company layer (client-safe types). */

export const GROWTH_CANONICAL_COMPANY_QA_MARKER = "growth-canonical-company-7.2a-v1" as const

export const GROWTH_CANONICAL_COMPANY_MIGRATION =
  "20270708120000_growth_engine_canonical_companies_7_2a.sql" as const

export const GROWTH_CANONICAL_COMPANY_STATUSES = ["active", "merged", "suppressed"] as const
export type GrowthCanonicalCompanyStatus = (typeof GROWTH_CANONICAL_COMPANY_STATUSES)[number]

export const GROWTH_CANONICAL_COMPANY_RESOLUTION_METHODS = [
  "normalized_domain",
  "domain_alias",
  "name_city",
  "name_state",
  "new",
  "manual",
] as const
export type GrowthCanonicalCompanyResolutionMethod =
  (typeof GROWTH_CANONICAL_COMPANY_RESOLUTION_METHODS)[number]

export const GROWTH_CANONICAL_COMPANY_SOURCE_TABLES = [
  "external_company_candidates",
  "real_world_company_candidates",
  "discovery_candidates",
] as const
export type GrowthCanonicalCompanySourceTable = (typeof GROWTH_CANONICAL_COMPANY_SOURCE_TABLES)[number]

export type GrowthCanonicalCompanyRecord = {
  id: string
  display_name: string
  normalized_name: string
  legal_name: string | null
  primary_domain: string | null
  website: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  industry: string | null
  subindustry: string | null
  employee_range: string | null
  revenue_range: string | null
  technologies: unknown[]
  identity_confidence: number
  resolution_method: GrowthCanonicalCompanyResolutionMethod
  status: GrowthCanonicalCompanyStatus
  merged_into_company_id: string | null
  first_observed_at: string
  last_observed_at: string
  last_refreshed_at: string | null
  metadata: Record<string, unknown>
}

export type GrowthCanonicalCompanyCandidateInput = {
  source_table: GrowthCanonicalCompanySourceTable
  source_id: string
  run_id: string | null
  provider_name: string
  provider_type: string
  company_name: string
  legal_name?: string | null
  website?: string | null
  domain?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  industry?: string | null
  subindustry?: string | null
  employee_range?: string | null
  revenue_range?: string | null
  technologies?: unknown[]
  confidence?: number
  observed_at?: string | null
  source_metadata?: Record<string, unknown>
}

export type GrowthCanonicalCompanyResolutionResult = {
  company_id: string | null
  resolution_method: GrowthCanonicalCompanyResolutionMethod
  normalized_domain: string | null
  exact_domain: string | null
  name_city_key: string | null
  name_state_key: string | null
  would_create_new: boolean
  review_tier: boolean
}

export const GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE = 40
export const GROWTH_CANONICAL_COMPANY_BACKFILL_MAX_BATCH_SIZE = 100

export type GrowthCanonicalCompanyBackfillCursor = {
  source_table: GrowthCanonicalCompanySourceTable
  after_id: string | null
  /** Accumulated domain → candidate count for merge-group stats across chunks. */
  domain_counts: Record<string, number>
}

export type GrowthCanonicalCompanyBackfillStats = {
  qa_marker: typeof GROWTH_CANONICAL_COMPANY_QA_MARKER
  mode: "dry_run" | "apply"
  sources: Record<
    GrowthCanonicalCompanySourceTable,
    {
      rows_processed: number
      already_linked: number
      resolved_normalized_domain: number
      resolved_domain_alias: number
      resolved_name_city: number
      resolved_name_state: number
      would_create_new: number
      review_tier: number
      errors: number
    }
  >
  canonical_companies_existing: number
  canonical_companies_after: number
  unique_normalized_domains: number
  merge_groups_by_domain: number
}

export type GrowthCanonicalCompanyBackfillErrorRow = {
  source_table: GrowthCanonicalCompanySourceTable
  source_id: string
  message: string
}

export type GrowthCanonicalCompanyBackfillVerification = {
  passed: boolean
  pending_by_source: Record<GrowthCanonicalCompanySourceTable, number>
  pending_total: number
}

export type GrowthCanonicalCompanyBackfillResult = {
  stats: GrowthCanonicalCompanyBackfillStats
  done: boolean
  cursor: GrowthCanonicalCompanyBackfillCursor | null
  progress: {
    batch_size: number
    processed_in_chunk: number
    current_source_table: GrowthCanonicalCompanySourceTable
  }
  pending_by_source: Record<GrowthCanonicalCompanySourceTable, number>
  pending_total: number
  error_rows: GrowthCanonicalCompanyBackfillErrorRow[]
  verification: GrowthCanonicalCompanyBackfillVerification | null
  certification: "pass" | "conditional_pass" | "fail" | null
}
