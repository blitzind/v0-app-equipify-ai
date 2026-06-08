/** Apollo API types for Growth Engine contact discovery (Phase 7.PCA-2). Client-safe. */

import { GROWTH_APOLLO_PROVIDER_QA_MARKER } from "@/lib/growth/providers/apollo/apollo-config"

export { GROWTH_APOLLO_PROVIDER_QA_MARKER }

export type ApolloPersonSearchInput = {
  company_name: string
  domain: string | null
  website_url?: string | null
  industry?: string | null
  limit?: number
}

export type ApolloOrganizationRecord = {
  id?: string | null
  name?: string | null
  website_url?: string | null
  primary_domain?: string | null
  linkedin_url?: string | null
}

export type ApolloPersonRecord = {
  id?: string | null
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  title?: string | null
  headline?: string | null
  linkedin_url?: string | null
  email?: string | null
  email_status?: string | null
  extrapolated_email_confidence?: number | null
  sanitized_phone?: string | null
  phone_numbers?: Array<{ raw_number?: string | null; sanitized_number?: string | null }> | null
  seniority?: string | null
  departments?: string[] | null
  functions?: string[] | null
  organization?: ApolloOrganizationRecord | null
  organization_id?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  /** Apollo search may expose availability flags without PII */
  has_email?: boolean | null
  has_direct_phone?: boolean | null
}

export type ApolloApiErrorCategory =
  | "none"
  | "missing_credentials"
  | "missing_company_identity"
  | "rate_limit"
  | "auth"
  | "client_error"
  | "server_error"
  | "parse_error"
  | "network_error"
  | "disabled"
  | "mock"

export type ApolloSearchDiagnostics = {
  qa_marker: typeof GROWTH_APOLLO_PROVIDER_QA_MARKER
  endpoint: string
  search_input: {
    company_name: string
    domain: string | null
    person_titles: string[]
    person_seniorities: string[]
    per_page: number
  }
  result_count: number
  contacts_mapped: number
  contacts_skipped: number
  skip_reasons: Record<string, number>
  api_error_category: ApolloApiErrorCategory
  rate_limit_remaining: number | null
  credits_consumed_estimate: number | null
  enrich_endpoint: string | null
  enrich_batch_count: number
  mock: boolean
  latency_ms: number | null
}

export type ApolloPersonSearchResult = {
  qa_marker: typeof GROWTH_APOLLO_PROVIDER_QA_MARKER
  status: "success" | "skipped" | "failed"
  message: string
  people: ApolloPersonRecord[]
  total: number
  mock: boolean
  diagnostics: ApolloSearchDiagnostics
  error?: string | null
}

export type ApolloPeopleSearchResponse = {
  people?: ApolloPersonRecord[] | null
  pagination?: {
    page?: number
    per_page?: number
    total_entries?: number
  } | null
}

export type ApolloBulkMatchResponse = {
  matches?: ApolloPersonRecord[] | null
  people?: ApolloPersonRecord[] | null
}
