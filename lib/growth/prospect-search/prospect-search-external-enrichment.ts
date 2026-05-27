import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyProspectSearchFilters,
  filterProspectPeopleByTitle,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
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

export async function enrichProspectSearchExternalCompanies(
  admin: SupabaseClient,
  companies: GrowthProspectSearchCompanyResult[],
  context: {
    query: string
    filters: GrowthProspectSearchFilters
    parsed: GrowthProspectSearchParsedQuery
  },
): Promise<GrowthProspectSearchCompanyResult[]> {
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

  return applyProspectSearchFilters(enriched, context.filters)
}
