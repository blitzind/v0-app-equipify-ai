/** Contact-first discovery orchestration — contacts before deep intelligence. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyProspectSearchIntelligenceOverlays } from "@/lib/growth/market-intelligence/integrations/prospect-search-bridge"
import { applyProspectSearchContactIntelligenceOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import { attachReachableHumanToCompanies } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import {
  resolveProspectSearchProgressiveEnrichmentPlan,
  shouldRunProspectSearchDeepOverlays,
} from "@/lib/growth/prospect-search/prospect-search-progressive-enrichment"
import { GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import { augmentProspectSearchCompaniesWithPdl } from "@/lib/growth/prospect-search/prospect-search-pdl-augmentation"
import { GROWTH_PDL_PROVIDER_QA_MARKER } from "@/lib/growth/providers/pdl/pdl-types"
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
import type { GrowthProspectSearchHydrationDiagnostic } from "@/lib/growth/prospect-search/prospect-search-discovery-hydration"

export type GrowthProspectSearchContactFirstHydrationSnapshot = {
  qa_marker: typeof GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER
  hydration_complete: boolean
  partial_intelligence: boolean
  diagnostics: GrowthProspectSearchHydrationDiagnostic[]
  summary: string | null
  contact_first_applied: boolean
  deep_overlays_skipped_count: number
  pdl_augmentation_qa_marker?: typeof GROWTH_PDL_PROVIDER_QA_MARKER | null
  pdl_augmented_count?: number
}

function pushDiagnostic(
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

export async function applyProspectSearchContactFirstHydrationLayers(
  admin: SupabaseClient,
  input: {
    companies: GrowthProspectSearchCompanyResult[]
    query: string
    filters: GrowthProspectSearchFilters
    parsed: GrowthProspectSearchParsedQuery
    sort_by: GrowthProspectSearchSortBy
    operator_intent?: boolean
    pdl_augmentation?: boolean
  },
): Promise<{
  companies: GrowthProspectSearchCompanyResult[]
  hydration: GrowthProspectSearchContactFirstHydrationSnapshot
}> {
  const diagnostics: GrowthProspectSearchHydrationDiagnostic[] = []
  let companies = input.companies
  let deep_overlays_skipped_count = 0

  if (companies.length === 0) {
    return {
      companies,
      hydration: {
        qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
        hydration_complete: true,
        partial_intelligence: false,
        diagnostics: [],
        summary: null,
        contact_first_applied: true,
        deep_overlays_skipped_count: 0,
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
    pushDiagnostic(
      diagnostics,
      "contact_intelligence",
      err,
      "Contact intelligence unavailable — showing lightweight company rows.",
    )
  }

  if (input.pdl_augmentation) {
    try {
      const pdl = await augmentProspectSearchCompaniesWithPdl(admin, {
        companies,
        query: input.query,
        filters: input.filters,
        parsed: input.parsed,
      })
      companies = pdl.companies
      if (pdl.augmented > 0) {
        diagnostics.push({
          layer: "pdl_acquisition",
          status: "success",
          message: `PDL augmented ${pdl.augmented} account(s) after internal contact discovery.`,
        })
      } else if (pdl.skipped_reason) {
        diagnostics.push({
          layer: "pdl_acquisition",
          status: "skipped",
          message: pdl.skipped_reason,
        })
      }
    } catch (err) {
      pushDiagnostic(
        diagnostics,
        "pdl_acquisition",
        err,
        "PDL contact augmentation unavailable — continuing with internal contacts only.",
      )
    }
  }

  companies = attachReachableHumanToCompanies(companies)

  const companiesNeedingDeep: GrowthProspectSearchCompanyResult[] = []
  const companiesLightweight: GrowthProspectSearchCompanyResult[] = []

  for (const company of companies) {
    const plan = resolveProspectSearchProgressiveEnrichmentPlan({
      company,
      context: {
        tier: input.operator_intent ? "tier_3_contact_intelligence" : "tier_1_lightweight_discovery",
        operator_selected: input.operator_intent,
      },
    })
    if (shouldRunProspectSearchDeepOverlays(plan)) {
      companiesNeedingDeep.push(company)
    } else {
      deep_overlays_skipped_count += 1
      companiesLightweight.push({
        ...company,
        lightweight_mode: true,
        progressive_enrichment: plan,
      })
    }
  }

  let enrichedDeep = companiesNeedingDeep
  if (companiesNeedingDeep.length > 0) {
    try {
      enrichedDeep = await applyProspectSearchIntelligenceOverlays(admin, companiesNeedingDeep, {
        territory_id: input.filters.territory_id ?? null,
        industry: input.filters.industry ?? input.parsed.industry ?? null,
        territory_label: input.filters.territory_filter?.states?.[0]
          ? `${input.filters.territory_filter.states[0]} ${input.filters.industry ?? input.parsed.industry ?? ""}`.trim()
          : null,
      })
    } catch (err) {
      pushDiagnostic(
        diagnostics,
        "market_intelligence",
        err,
        "Market intelligence deferred for contactable subset.",
      )
      enrichedDeep = companiesNeedingDeep
    }

    try {
      enrichedDeep = await applyProspectSearchSignalIntelligenceOverlay(admin, enrichedDeep, {
        sort_by: input.sort_by,
      })
    } catch (err) {
      pushDiagnostic(
        diagnostics,
        "signal_intelligence",
        err,
        "Signal intelligence deferred for contactable subset.",
      )
    }
  } else {
    diagnostics.push({
      layer: "deep_intelligence",
      status: "skipped",
      message: "Deep overlays skipped — no accounts met reachable-human threshold.",
    })
  }

  let merged = attachReachableHumanToCompanies([...companiesLightweight, ...enrichedDeep])
  merged = filterProspectSearchCompaniesByEngineIntelligence(merged, input.filters)
  merged = filterProspectSearchCompaniesByEngineReadiness(merged, input.filters)
  if (input.sort_by !== "signal_momentum") {
    merged = prioritizeProspectSearchCompaniesByEngineReadiness(merged)
  }
  const partial_intelligence = diagnostics.length > 0
  const summary = partial_intelligence
    ? diagnostics.map((row) => row.message).slice(0, 2).join(" · ")
    : deep_overlays_skipped_count > 0
      ? `Contact-first mode: ${deep_overlays_skipped_count} account(s) kept lightweight.`
      : null

  return {
    companies: merged,
    hydration: {
      qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
      hydration_complete: diagnostics.filter((d) => d.status === "degraded").length === 0,
      partial_intelligence,
      diagnostics,
      summary,
      contact_first_applied: true,
      deep_overlays_skipped_count,
    },
  }
}
