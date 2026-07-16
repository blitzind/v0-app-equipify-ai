/**
 * GE-AIOS-EXTERNAL-DISCOVERY-KEYWORD-DEFERRAL-PRODUCTION-CLOSURE-1K — Canonical Prospect Search filter projection.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { applyTerritoryFiltersToSearchInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"

export const GROWTH_EXTERNAL_DISCOVERY_KEYWORD_DEFERRAL_PRODUCTION_CLOSURE_1K_QA_MARKER =
  "ge-aios-external-discovery-keyword-deferral-production-closure-1k-v1" as const

export async function buildCanonicalProspectSearchFiltersFromBusinessProfile(
  admin: SupabaseClient,
  input: {
    profile: BusinessProfileDraftContent
    query: string
  },
): Promise<GrowthProspectSearchFilters> {
  const profileFilters = buildProspectSearchFiltersFromBusinessProfile(input.profile)
  const parsed = parseProspectSearchQuery(input.query)
  const merged = mergeParsedQueryIntoFilters(parsed, profileFilters) as GrowthProspectSearchFilters

  // Supported Service Vertical aliases remain the OR authority for industry gate matching.
  if ((profileFilters.industry_aliases?.length ?? 0) > 0) {
    merged.industry = profileFilters.industry ?? null
  }

  return normalizeProspectSearchFilters(
    await applyTerritoryFiltersToSearchInput(admin, merged),
  )
}

export {
  buildProspectSearchQueryFromBusinessProfile,
  buildProspectSearchFiltersFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
