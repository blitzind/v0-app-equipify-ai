/** Partial discovery hydration — layers fail independently, companies still render. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyProspectSearchIntelligenceOverlays } from "@/lib/growth/market-intelligence/integrations/prospect-search-bridge"
import { applyProspectSearchContactIntelligenceOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import { GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import { filterProspectSearchCompaniesByEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-filters"
import {
  filterProspectSearchCompaniesByEngineReadiness,
  prioritizeProspectSearchCompaniesByEngineReadiness,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness"
import { applyProspectSearchSignalIntelligenceOverlay } from "@/lib/growth/signals/integrations/prospect-search-signal-intelligence-loader"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchParsedQuery,
  GrowthProspectSearchSortBy,
} from "@/lib/growth/prospect-search/prospect-search-types"

export type GrowthProspectSearchHydrationDiagnostic = {
  layer: string
  status: "degraded" | "skipped"
  message: string
}

export type GrowthProspectSearchHydrationSnapshot = {
  qa_marker: typeof GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER
  hydration_complete: boolean
  partial_intelligence: boolean
  diagnostics: GrowthProspectSearchHydrationDiagnostic[]
  summary: string | null
}

function pushHydrationDiagnostic(
  diagnostics: GrowthProspectSearchHydrationDiagnostic[],
  layer: string,
  err: unknown,
  fallbackMessage: string,
): void {
  const detail = err instanceof Error ? err.message : fallbackMessage
  diagnostics.push({
    layer,
    status: "degraded",
    message: `${fallbackMessage} ${detail ? `(${detail})` : ""}`.trim(),
  })
}

export async function applyProspectSearchDiscoverHydrationLayers(
  admin: SupabaseClient,
  input: {
    companies: GrowthProspectSearchCompanyResult[]
    query: string
    filters: GrowthProspectSearchFilters
    parsed: GrowthProspectSearchParsedQuery
    sort_by: GrowthProspectSearchSortBy
  },
): Promise<{
  companies: GrowthProspectSearchCompanyResult[]
  hydration: GrowthProspectSearchHydrationSnapshot
}> {
  const diagnostics: GrowthProspectSearchHydrationDiagnostic[] = []
  let companies = input.companies

  if (companies.length === 0) {
    return {
      companies,
      hydration: {
        qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
        hydration_complete: true,
        partial_intelligence: false,
        diagnostics: [],
        summary: null,
      },
    }
  }

  try {
    companies = await applyProspectSearchContactIntelligenceOverlay(admin, companies, {
      query: input.query,
      filters: input.filters,
      parsed: input.parsed,
    })
  } catch (err) {
    pushHydrationDiagnostic(
      diagnostics,
      "contact_intelligence",
      err,
      "Contact intelligence unavailable — showing discovered companies with partial coverage.",
    )
  }

  try {
    companies = await applyProspectSearchIntelligenceOverlays(admin, companies, {
      territory_id: input.filters.territory_id ?? null,
      industry: input.filters.industry ?? input.parsed.industry ?? null,
      territory_label: input.filters.territory_filter?.states?.[0]
        ? `${input.filters.territory_filter.states[0]} ${input.filters.industry ?? input.parsed.industry ?? ""}`.trim()
        : null,
    })
  } catch (err) {
    pushHydrationDiagnostic(
      diagnostics,
      "market_intelligence",
      err,
      "Market intelligence overlay unavailable — territory/org panels may be incomplete.",
    )
  }

  try {
    companies = await applyProspectSearchSignalIntelligenceOverlay(admin, companies, {
      sort_by: input.sort_by,
    })
  } catch (err) {
    pushHydrationDiagnostic(
      diagnostics,
      "signal_intelligence",
      err,
      "Signal intelligence unavailable — momentum overlays may be missing.",
    )
  }

  companies = filterProspectSearchCompaniesByEngineIntelligence(companies, input.filters)
  companies = filterProspectSearchCompaniesByEngineReadiness(companies, input.filters)
  companies = prioritizeProspectSearchCompaniesByEngineReadiness(companies)

  const partial_intelligence = diagnostics.length > 0
  const summary = partial_intelligence
    ? diagnostics.map((row) => row.message).slice(0, 2).join(" · ")
    : null

  return {
    companies,
    hydration: {
      qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
      hydration_complete: diagnostics.length === 0,
      partial_intelligence,
      diagnostics,
      summary,
    },
  }
}
