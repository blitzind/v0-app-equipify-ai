/** Phase GS-2A — Natural Language Prospect Discovery types (client-safe). */

import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const PROSPECT_DISCOVERY_QA_MARKER = "growth-prospect-discovery-gs2a-v1" as const

export const PROSPECT_DISCOVERY_EXECUTE_CONFIRM =
  "RUN_PROSPECT_DISCOVERY_FOUNDATION_CERTIFICATION" as const

export const PROSPECT_SEARCH_SIGNAL_TYPES = [
  "hiring",
  "funding",
  "expansion",
  "technology_change",
  "website_intent",
] as const

export type ProspectSearchSignalType = (typeof PROSPECT_SEARCH_SIGNAL_TYPES)[number]

export const PROSPECT_DISCOVERY_PROVIDERS = [
  "apollo_company_search",
  "apollo_people_search",
  "pdl_search",
  "website_discovery",
  "real_world_google_places",
  "real_world_serp",
  "real_world_business_directory",
  "signal_enrichment",
  "company_intelligence",
  "buying_committee_expansion",
] as const

export type ProspectDiscoveryProvider = (typeof PROSPECT_DISCOVERY_PROVIDERS)[number]

export const PROSPECT_SEARCH_RESULT_QUALITY_LEVELS = ["low", "medium", "high"] as const

export type ProspectSearchResultQuality = (typeof PROSPECT_SEARCH_RESULT_QUALITY_LEVELS)[number]

export type ProspectSearchIntent = {
  raw_query: string
  industries: string[]
  locations: string[]
  employee_ranges: string[]
  revenue_ranges: string[]
  titles: string[]
  technologies: string[]
  keywords: string[]
  signals: string[]
  exclusions: string[]
  company_characteristics: string[]
  confidence: number
  assumptions: string[]
  ambiguities: string[]
}

export type NormalizedProspectSearchIntent = {
  raw_query: string
  industries: string[]
  locations: string[]
  employee_ranges: string[]
  revenue_ranges: string[]
  titles: string[]
  technologies: string[]
  keywords: string[]
  signals: string[]
  exclusions: string[]
  company_characteristics: string[]
  prospect_search_filters: GrowthProspectSearchFilters
}

export type ProspectSearchPlan = {
  qa_marker: typeof PROSPECT_DISCOVERY_QA_MARKER
  normalized_intent: NormalizedProspectSearchIntent
  discovery_providers: ProspectDiscoveryProvider[]
  provider_filters: Partial<Record<ProspectDiscoveryProvider, GrowthProspectSearchFilters>>
  qualification_filters: GrowthProspectSearchFilters
  signal_filters: string[]
  enrichment_requirements: string[]
  estimated_result_quality: ProspectSearchResultQuality
  warnings: string[]
  recommendations: string[]
  requires_human_review: true
  search_execution_enabled: false
}

export type ProspectSearchSuggestion = {
  id: string
  label: string
  reason: string
  field: string
  examples: string[]
}

export type ProspectSearchSuggestionsResponse = {
  qa_marker: typeof PROSPECT_DISCOVERY_QA_MARKER
  suggestions: ProspectSearchSuggestion[]
  based_on: Pick<
    ProspectSearchIntent,
    "industries" | "technologies" | "signals" | "locations" | "employee_ranges" | "titles"
  >
}

export type ProspectSearchParseResponse = {
  qa_marker: typeof PROSPECT_DISCOVERY_QA_MARKER
  intent: ProspectSearchIntent
  normalized_intent: NormalizedProspectSearchIntent
  requires_human_review: true
  search_execution_enabled: false
}
