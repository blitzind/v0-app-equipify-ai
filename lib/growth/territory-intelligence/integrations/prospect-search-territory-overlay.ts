/** Pure Prospect Search territory overlay helpers. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthTerritoryIntelligenceSummary } from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import type { GrowthTerritoryScoreRow } from "@/lib/growth/territory-intelligence/territory-intelligence-types"

export function buildTerritoryIntelligenceSummary(input: {
  territory_id: string
  territory_name: string
  score: GrowthTerritoryScoreRow | null
}): GrowthTerritoryIntelligenceSummary | null {
  if (!input.score) return null
  return {
    territory_id: input.territory_id,
    territory_name: input.territory_name,
    territory_opportunity_score: input.score.territory_opportunity_score,
    whitespace_score: input.score.whitespace_score,
    company_count: input.score.company_count,
    mapped_company_count: input.score.mapped_company_count,
    high_fit_count: input.score.high_fit_count,
    contact_coverage_avg: input.score.contact_coverage_avg,
    growth_signal_density: input.score.growth_signal_density,
    existing_customer_count: input.score.existing_customer_count,
    existing_prospect_count: input.score.existing_prospect_count,
    suppressed_count: input.score.suppressed_count,
    cluster_count: input.score.clusters.length,
    top_signal_companies: input.score.top_signal_companies,
    last_computed_at: input.score.last_computed_at,
  }
}

export function companyToTerritoryScoringInput(
  company: GrowthProspectSearchCompanyResult,
): import("@/lib/growth/territory-intelligence/territory-scoring").TerritoryScoringCompanyInput {
  return {
    company_id: company.id,
    source_type: company.source_type,
    company_name: company.company_name,
    lat: company.lat,
    lng: company.lng,
    state: company.state,
    city: company.city,
    lead_engine_score: company.lead_engine_score ?? company.lead_score,
    growth_signal_score: company.growth_signal_score,
    contact_coverage_score: company.contact_intelligence?.contact_coverage_score ?? null,
    is_existing_customer: company.existing_customer,
    is_existing_prospect: company.existing_prospect,
    is_suppressed: company.is_suppressed,
  }
}
