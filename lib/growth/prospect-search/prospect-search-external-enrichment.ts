import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { filterProspectPeopleByTitle } from "@/lib/growth/prospect-search/prospect-search-filters"
import {
  applyProspectSearchExternalCompanyFilters,
  type GrowthProspectSearchExternalFilterDiagnostics,
} from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"
import { deriveProspectSearchCompanyStatus } from "@/lib/growth/prospect-search/prospect-search-status"
import {
  applyProspectSearchSuppressionOverlay,
  loadProspectSearchSuppressionLookup,
} from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchParsedQuery,
} from "@/lib/growth/prospect-search/prospect-search-types"

const EXTERNAL_SAFETY_DEFAULTS = {
  in_lead_inbox: false,
  existing_customer: false,
  existing_prospect: false,
  already_pushed: false,
  is_suppressed: false,
  suppression_reason: null as string | null,
  suppression_scope: null as string | null,
  suppressed_at: null as string | null,
}

export type EnrichProspectSearchExternalCompaniesResult = {
  companies: GrowthProspectSearchCompanyResult[]
  raw_companies: GrowthProspectSearchCompanyResult[]
  filter_diagnostics: GrowthProspectSearchExternalFilterDiagnostics
  used_relaxed_filters: boolean
}

export async function enrichProspectSearchExternalCompanies(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  context: {
    query: string
    filters: GrowthProspectSearchFilters
    parsed: GrowthProspectSearchParsedQuery
  },
): Promise<EnrichProspectSearchExternalCompaniesResult> {
  const suppressionLookup = await loadProspectSearchSuppressionLookup(admin)

  const enriched = companies.map((company) => {
    const status = deriveProspectSearchCompanyStatus(company)
    const withSafety = applyProspectSearchSuppressionOverlay(
      {
        ...EXTERNAL_SAFETY_DEFAULTS,
        ...company,
        ...status,
      },
      suppressionLookup,
    )
    return finalizeProspectSearchCompanyResult(withSafety, context)
  })

  const filtered = applyProspectSearchExternalCompanyFilters(enriched, context.filters)
  if (filtered.companies.length > 0 || enriched.length === 0) {
    return {
      companies: filtered.companies,
      raw_companies: enriched,
      filter_diagnostics: filtered.diagnostics,
      used_relaxed_filters: false,
    }
  }

  const relaxedFilters: GrowthProspectSearchFilters = {
    ...context.filters,
    employee_size_bands: undefined,
    revenue_bands: undefined,
    technologies: undefined,
    buying_stages: undefined,
    intent_score_min: undefined,
    lead_score_min: undefined,
    growth_signal_score_min: undefined,
    growth_signal_tiers: undefined,
    search_intent_categories: undefined,
  }

  const relaxedFiltered = applyProspectSearchExternalCompanyFilters(enriched, relaxedFilters)

  return {
    companies: relaxedFiltered.companies,
    raw_companies: enriched,
    filter_diagnostics: {
      ...filtered.diagnostics,
      normalized_result_count: relaxedFiltered.companies.length,
      dropped_result_count: enriched.length - relaxedFiltered.companies.length,
      dropped_reasons: {
        ...filtered.diagnostics.dropped_reasons,
        ...relaxedFiltered.diagnostics.dropped_reasons,
        relaxed_filter_pass: relaxedFiltered.companies.length,
      },
    },
    used_relaxed_filters: relaxedFiltered.companies.length > 0,
  }
}
