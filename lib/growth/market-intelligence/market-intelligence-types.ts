/** Market graph + coverage intelligence types. Client-safe. */

export const GROWTH_MARKET_INTELLIGENCE_QA_MARKER = "growth-market-intelligence-v1" as const

export const GROWTH_COMPANY_RELATIONSHIP_TYPES = [
  "same_market",
  "same_geo",
  "similar_icp",
  "shared_technology",
  "shared_signal_patterns",
  "similar_size",
  "same_industry",
  "competitive_overlap",
] as const
export type GrowthCompanyRelationshipType = (typeof GROWTH_COMPANY_RELATIONSHIP_TYPES)[number]

export type GrowthCompanyRelationship = {
  id: string
  company_id: string
  related_company_id: string
  related_company_name: string
  relationship_type: GrowthCompanyRelationshipType
  relationship_strength: number
  evidence_excerpt: string
}

export type GrowthMarketCoverageScore = {
  market_key: string
  market_label: string
  territory_id: string | null
  industry: string | null
  market_total_discovered: number
  market_researched: number
  market_contacted: number
  market_active_pipeline: number
  market_customers: number
  market_penetration_percent: number
  market_signal_density: number
  market_contact_coverage: number
  whitespace_score: number
  coverage_score: number
  penetration_score: number
  territory_strength: number
  last_computed_at: string
}

export type GrowthCommandMarketHealth = {
  coverage_percent: number
  whitespace_percent: number
  discovery_velocity: number
  new_companies_discovered: number
  high_fit_discovered: number
  signal_velocity: number
  market_penetration: number
  committee_completion_avg: number
  related_company_opportunities: number
  prospect_saturation: number
}

export const GROWTH_MARKET_INTELLIGENCE_PRIVACY_NOTE =
  "Market intelligence uses indexed evidence only. Relationships require explicit matching evidence."
