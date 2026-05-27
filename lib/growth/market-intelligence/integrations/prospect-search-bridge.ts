import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyMarketIntelligenceToCompanyResult,
  computeProspectSearchCommitteeCompletion,
  computeProspectSearchCompanyConfidence,
} from "@/lib/growth/market-intelligence/integrations/prospect-search-market-overlay"
import { buildCompanyRelationships } from "@/lib/growth/market-intelligence/integrations/prospect-search-market-bridge"
import { refreshMarketCoverageScore } from "@/lib/growth/market-intelligence/market-repository"
import { isGrowthMarketIntelligenceSchemaReady } from "@/lib/growth/market-intelligence/market-intelligence-schema-health"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { applyProspectSearchGrowthSignalsOverlay } from "@/lib/growth/company-growth-signals/integrations/prospect-search-bridge"

export {
  buildCompanyRelationships,
  companyToRelationshipInput,
} from "@/lib/growth/market-intelligence/integrations/prospect-search-market-bridge"

export {
  applyMarketIntelligenceToCompanyResult,
  computeProspectSearchCommitteeCompletion,
  computeProspectSearchCompanyConfidence,
} from "@/lib/growth/market-intelligence/integrations/prospect-search-market-overlay"

export async function applyProspectSearchMarketIntelligenceOverlay(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  options?: {
    territory_id?: string | null
    territory_label?: string | null
    industry?: string | null
    territory_opportunity_score?: number | null
  },
): Promise<GrowthProspectSearchCompanyResult[]> {
  if (companies.length === 0) return companies

  const enriched = companies.map((company) => {
    const committee_completion = computeProspectSearchCommitteeCompletion(company)
    const related_companies = buildCompanyRelationships(company, companies, 5)
    const company_confidence = computeProspectSearchCompanyConfidence(company, committee_completion)
    return applyMarketIntelligenceToCompanyResult(company, {
      related_companies,
      company_confidence,
      committee_completion,
    })
  })

  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return enriched

  const marketLabel =
    options?.territory_label ??
    ([options?.industry, companies[0]?.state].filter(Boolean).join(" · ") || "Current search market")

  await refreshMarketCoverageScore(admin, {
    market_label: marketLabel,
    territory_id: options?.territory_id ?? null,
    industry: options?.industry ?? companies[0]?.industry ?? null,
    companies: enriched,
    territory_opportunity_score: options?.territory_opportunity_score ?? null,
  }).catch(() => null)

  return enriched
}

export async function applyProspectSearchIntelligenceOverlays(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  options?: {
    territory_id?: string | null
    territory_label?: string | null
    industry?: string | null
    territory_opportunity_score?: number | null
  },
): Promise<GrowthProspectSearchCompanyResult[]> {
  const companiesWithSignals = await applyProspectSearchGrowthSignalsOverlay(admin, companies)
  return applyProspectSearchMarketIntelligenceOverlay(admin, companiesWithSignals, options)
}
