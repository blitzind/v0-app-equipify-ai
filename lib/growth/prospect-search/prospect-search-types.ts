/** Growth Engine — Prospect Search + ICP Builder types (Prompt 23). Client-safe. */

import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import type { GrowthSearchIntentCategory } from "@/lib/growth/search-intent/search-intent-types"

export const GROWTH_PROSPECT_SEARCH_QA_MARKER = "growth-prospect-search-v1" as const

export const GROWTH_PROSPECT_SEARCH_SOURCE_TYPES = [
  "growth_lead",
  "lead_inbox",
  "crm_prospect",
  "crm_customer",
  "external_discovered",
] as const

export const GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES = [
  "internal",
  "discover_external",
] as const

export type GrowthProspectSearchDiscoveryMode =
  (typeof GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES)[number]

export type GrowthProspectSearchSourceType = (typeof GROWTH_PROSPECT_SEARCH_SOURCE_TYPES)[number]

export const GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS = [
  "1-10",
  "11-20",
  "21-50",
  "51-100",
  "101-250",
  "251-500",
  "501-1000",
  "1000+",
  "unknown",
] as const

export type GrowthProspectSearchEmployeeSizeBand =
  (typeof GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS)[number]

export const GROWTH_PROSPECT_SEARCH_REVENUE_BANDS = [
  "under_1m",
  "1m_5m",
  "5m_10m",
  "10m_50m",
  "50m_100m",
  "100m+",
  "unknown",
] as const

export type GrowthProspectSearchRevenueBand = (typeof GROWTH_PROSPECT_SEARCH_REVENUE_BANDS)[number]

export const GROWTH_PROSPECT_SEARCH_EXISTING_ACCOUNT_MODES = [
  "any",
  "include_only",
  "exclude",
] as const

export type GrowthProspectSearchExistingAccountMode =
  (typeof GROWTH_PROSPECT_SEARCH_EXISTING_ACCOUNT_MODES)[number]

export const GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS = [
  "save_search",
  "create_list",
  "push_to_lead_inbox",
  "run_lead_engine",
  "open_workspace",
  "export_csv",
] as const

export type GrowthProspectSearchResultAction =
  (typeof GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS)[number]

/** ICP Builder filter set — all optional facets. */
export type GrowthProspectSearchFilters = {
  industry?: string | null
  subindustry?: string | null
  employee_size_bands?: GrowthProspectSearchEmployeeSizeBand[]
  revenue_bands?: GrowthProspectSearchRevenueBand[]
  location?: string | null
  service_area?: string | null
  company_age_years_min?: number | null
  company_age_years_max?: number | null
  keywords?: string[]
  naics_codes?: string[]
  sic_codes?: string[]
  technologies?: string[]
  crm_detected?: string | null
  website_platform?: string | null
  field_service_software?: string | null
  intent_score_min?: number | null
  buying_stages?: GrowthBuyingStage[]
  search_intent_categories?: GrowthSearchIntentCategory[]
  company_identification_confidence_min?: number | null
  returning_visitor_only?: boolean
  existing_account_mode?: GrowthProspectSearchExistingAccountMode
  lead_score_min?: number | null
  decision_maker_role?: string | null
  title_contains?: string | null
  verification_status?: string | null
  priority?: string | null
  source_types?: GrowthProspectSearchSourceType[]
}

export type GrowthProspectSearchParsedQuery = {
  raw_query: string
  keywords: string[]
  industry_hints: string[]
  location_hints: string[]
  employee_min: number | null
  employee_max: number | null
  title_hints: string[]
}

export type GrowthProspectSearchCompanyResult = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_name: string
  website: string | null
  industry: string | null
  subindustry: string | null
  employees: string | null
  revenue_range: string | null
  location: string | null
  intent_score: number | null
  buying_stage: string | null
  lead_score: number | null
  confidence: number
  company_match_confidence: number | null
  decision_maker_coverage: number | null
  verification_status: string
  signals: string[]
  search_intent_category: string | null
  lead_inbox_id: string | null
  growth_lead_id: string | null
  prospect_id: string | null
  customer_id: string | null
  rank_score: number
  match_reasoning: string[]
}

export type GrowthProspectSearchPersonResult = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_id: string
  company_name: string
  full_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  role: string | null
  verification_status: string
  rank_score: number
}

export type GrowthProspectSearchResult = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_QA_MARKER
  discovery_mode: GrowthProspectSearchDiscoveryMode
  query: string
  parsed_query: GrowthProspectSearchParsedQuery
  filters: GrowthProspectSearchFilters
  companies: GrowthProspectSearchCompanyResult[]
  people: GrowthProspectSearchPersonResult[]
  total_companies: number
  total_people: number
  source_counts: Record<GrowthProspectSearchSourceType, number>
  external_discovery_run_id?: string | null
  provider_messages?: string[]
}

export type GrowthProspectSearchSavedSearchRow = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  name: string
  query_text: string
  filters: GrowthProspectSearchFilters
  metadata: Record<string, unknown>
}

export type GrowthProspectSearchListRow = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  name: string
  description: string
  member_count: number
  metadata: Record<string, unknown>
}

export type GrowthProspectSearchListMemberRow = {
  id: string
  created_at: string
  list_id: string
  source_type: GrowthProspectSearchSourceType | "person"
  source_id: string
  company_name: string
  snapshot: Record<string, unknown>
}

export type GrowthProspectSearchActionResult = {
  ok: boolean
  action: GrowthProspectSearchResultAction
  message: string
  lead_inbox_id?: string | null
  growth_lead_id?: string | null
  list_id?: string | null
  saved_search_id?: string | null
  workspace_url?: string | null
}
