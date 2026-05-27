/** Territory Intelligence types. Client-safe. */

import type {
  GrowthProspectSearchFilters,
  GrowthProspectSearchTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER = "growth-territory-intelligence-v1" as const

export const GROWTH_TERRITORY_TYPES = [
  "state",
  "city_metro",
  "postal_code",
  "radius",
  "custom",
] as const
export type GrowthTerritoryType = (typeof GROWTH_TERRITORY_TYPES)[number]

export const GROWTH_TERRITORY_SCORE_BUCKETS = ["urgent", "high", "moderate", "low", "unmapped"] as const
export type GrowthTerritoryScoreBucket = (typeof GROWTH_TERRITORY_SCORE_BUCKETS)[number]

export type GrowthTerritoryRow = {
  id: string
  name: string
  territory_type: GrowthTerritoryType
  territory_filter: GrowthProspectSearchTerritoryFilter
  industry: string | null
  icp_label: string | null
  saved_search_id: string | null
  query_text: string
  filters: GrowthProspectSearchFilters
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type GrowthTerritoryCompanyRow = {
  id: string
  territory_id: string
  company_id: string
  source_type: string
  company_name: string
  lat: number | null
  lng: number | null
  is_mapped: boolean
  match_reasons: string[]
  lead_engine_score: number | null
  growth_signal_score: number | null
  contact_coverage_score: number | null
  score_bucket: GrowthTerritoryScoreBucket
  is_existing_customer: boolean
  is_existing_prospect: boolean
  is_suppressed: boolean
  last_matched_at: string
}

export type GrowthTerritoryScoreRow = {
  territory_id: string
  company_count: number
  mapped_company_count: number
  unmapped_company_count: number
  high_fit_count: number
  contact_coverage_avg: number
  growth_signal_avg: number
  growth_signal_density: number
  existing_customer_count: number
  existing_prospect_count: number
  suppressed_count: number
  whitespace_score: number
  territory_opportunity_score: number
  score_buckets: Record<GrowthTerritoryScoreBucket, number>
  clusters: GrowthTerritoryCluster[]
  whitespace_zones: GrowthTerritoryWhitespaceZone[]
  top_signal_companies: GrowthTerritoryTopCompany[]
  last_computed_at: string
}

export type GrowthTerritoryCluster = {
  id: string
  label: string
  lat: number | null
  lng: number | null
  company_count: number
  high_fit_count: number
  avg_opportunity_score: number
}

export type GrowthTerritoryWhitespaceZone = {
  id: string
  label: string
  high_fit_count: number
  existing_account_count: number
  whitespace_score: number
}

export type GrowthTerritoryTopCompany = {
  company_id: string
  company_name: string
  source_type: string
  growth_signal_score: number | null
  lead_engine_score: number | null
  contact_coverage_score: number | null
  score_bucket: GrowthTerritoryScoreBucket
  is_mapped: boolean
}

export type GrowthTerritoryHeatmapPoint = {
  lat: number
  lng: number
  weight: number
  score_bucket: GrowthTerritoryScoreBucket
  company_id: string
  company_name: string
}

export type GrowthTerritoryMapCompany = {
  company_id: string
  source_type: string
  company_name: string
  lat: number | null
  lng: number | null
  is_mapped: boolean
  score_bucket: GrowthTerritoryScoreBucket
  lead_engine_score: number | null
  growth_signal_score: number | null
  contact_coverage_score: number | null
}

export type GrowthTerritoryMapSnapshot = {
  qa_marker: typeof GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER
  schema_ready: boolean
  territory: GrowthTerritoryRow | null
  score: GrowthTerritoryScoreRow | null
  companies: GrowthTerritoryMapCompany[]
  heatmap_points: GrowthTerritoryHeatmapPoint[]
  clusters: GrowthTerritoryCluster[]
  whitespace_zones: GrowthTerritoryWhitespaceZone[]
  privacy_note: string
}

export type GrowthTerritoryIntelligenceSummary = {
  territory_id: string
  territory_name: string
  territory_opportunity_score: number
  whitespace_score: number
  company_count: number
  mapped_company_count: number
  high_fit_count: number
  contact_coverage_avg: number
  growth_signal_density: number
  existing_customer_count: number
  existing_prospect_count: number
  suppressed_count: number
  cluster_count: number
  top_signal_companies: GrowthTerritoryTopCompany[]
  last_computed_at: string | null
}

export const GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE =
  "Territory maps use indexed coordinates only. Companies without lat/lng appear as unmapped — coordinates are never guessed."
