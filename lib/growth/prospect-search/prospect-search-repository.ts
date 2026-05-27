import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyProspectSearchFilters,
  filterProspectPeopleByTitle,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  getProspectSearchMaterializedIndexStats,
  isProspectSearchMaterializedIndexAvailable,
  loadProspectSearchMaterializedCompanies,
  loadProspectSearchPeopleForQuery,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import { createInternalProspectSearchProvider } from "@/lib/growth/prospect-search/prospect-search-provider"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import {
  paginateRankedProspectSearchCompanies,
  paginateRankedProspectSearchPeople,
  rankProspectSearchCompanies,
  rankProspectSearchPeople,
} from "@/lib/growth/prospect-search/prospect-search-ranking"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import { applyProspectSearchContactIntelligenceOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import { applyProspectSearchIntelligenceOverlays } from "@/lib/growth/market-intelligence/integrations/prospect-search-bridge"
import {
  applyTerritoryFiltersToSearchInput,
  attachTerritoryIntelligenceToSearchResult,
} from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"
import { runProspectSearchRealWorldDiscovery } from "@/lib/growth/prospect-search/prospect-search-real-world-discovery"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_SOURCE_TYPES,
  GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
  GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER,
  GROWTH_PROVIDER_CACHE_QA_MARKER,
  type GrowthProspectSearchCompanyResult,
  type GrowthProspectSearchDiscoveryMode,
  type GrowthProspectSearchFilters,
  type GrowthProspectSearchIndexDiagnostics,
  type GrowthProspectSearchResult,
  type GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"

export type RunProspectSearchInput = {
  query: string
  filters?: Partial<GrowthProspectSearchFilters>
  limit?: number
  page?: number
  page_size?: number
  discovery_mode?: GrowthProspectSearchDiscoveryMode
  created_by?: string | null
}


function buildSourceCounts(
  companies: Array<{ source_type: GrowthProspectSearchSourceType }>,
): Record<GrowthProspectSearchSourceType, number> {
  const source_counts = Object.fromEntries(
    GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.map((t) => [t, 0]),
  ) as Record<GrowthProspectSearchSourceType, number>
  for (const c of companies) {
    source_counts[c.source_type] = (source_counts[c.source_type] ?? 0) + 1
  }
  return source_counts
}

function logProspectSearchIndexMode(diagnostics: GrowthProspectSearchIndexDiagnostics): void {
  if (process.env.NODE_ENV === "production") return
  console.info("[prospect-search]", diagnostics)
}

export async function runProspectSearch(
  admin: SupabaseClient,
  input: RunProspectSearchInput,
): Promise<GrowthProspectSearchResult> {
  const parsed = parseProspectSearchQuery(input.query)
  const baseFilters = mergeParsedQueryIntoFilters(parsed, input.filters ?? {}) as GrowthProspectSearchFilters
  const mergedFilters = normalizeProspectSearchFilters(
    await applyTerritoryFiltersToSearchInput(admin, baseFilters),
  )

  const discovery_mode = input.discovery_mode ?? "internal"
  const page = Math.max(1, input.page ?? 1)
  const page_size = Math.min(200, Math.max(1, input.page_size ?? input.limit ?? 50))

  if (discovery_mode === "discover_external") {
    const realWorld = await runProspectSearchRealWorldDiscovery(admin, {
      query: input.query,
      filters: mergedFilters,
      created_by: input.created_by,
      limit: input.limit ?? 50,
    })

    const enrichedCompanies = await enrichProspectSearchExternalCompanies(
      admin,
      realWorld.companies,
      {
        query: input.query,
        filters: mergedFilters,
        parsed,
      },
    )

    const companiesWithContacts = await applyProspectSearchContactIntelligenceOverlay(
      admin,
      enrichedCompanies,
      { query: input.query, filters: mergedFilters, parsed },
    )
    const companiesWithMarket = await applyProspectSearchIntelligenceOverlays(
      admin,
      companiesWithContacts,
      {
        territory_id: mergedFilters.territory_id ?? null,
        industry: mergedFilters.industry ?? parsed.industry ?? null,
        territory_label: mergedFilters.territory_filter?.states?.[0]
          ? `${mergedFilters.territory_filter.states[0]} ${mergedFilters.industry ?? parsed.industry ?? ""}`.trim()
          : null,
      },
    )

    const source_counts = buildSourceCounts(companiesWithMarket)

    return attachTerritoryIntelligenceToSearchResult(
      admin,
      {
      qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
      discovery_mode,
      query: input.query,
      parsed_query: parsed,
      filters: mergedFilters,
      companies: companiesWithMarket,
      people: [],
      total_companies: companiesWithMarket.length,
      total_people: 0,
      page: 1,
      page_size: companiesWithMarket.length,
      has_next_page: false,
      source_counts,
      external_discovery_run_id: realWorld.discovery_run_id,
      real_world_discovery_run_id: realWorld.discovery_run_id,
      real_world_built_query: realWorld.built_query,
      provider_messages: realWorld.provider_messages,
      provider_status_label: realWorld.provider_status?.label ?? null,
      provider_status_message: realWorld.provider_status?.message ?? null,
      provider_diagnostics: realWorld.provider_status?.provider_diagnostics ?? [],
      provider_fallback_reason: realWorld.provider_status?.provider_fallback_reason ?? null,
      provider_audit_qa_marker: GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
      google_places_query_expansion_qa_marker: GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER,
      provider_cache_qa_marker: GROWTH_PROVIDER_CACHE_QA_MARKER,
      },
      companiesWithMarket,
    )
  }

  const provider = createInternalProspectSearchProvider()
  provider.describe()

  const materializedAvailable = await isProspectSearchMaterializedIndexAvailable(admin)
  const materializedStats = materializedAvailable
    ? await getProspectSearchMaterializedIndexStats(admin)
    : { row_count: 0, last_indexed_at: null }

  const useMaterialized = materializedAvailable && materializedStats.row_count > 0
  const index_diagnostics: GrowthProspectSearchIndexDiagnostics = {
    index_mode: useMaterialized ? "materialized" : "fallback",
    index_row_count: materializedAvailable ? materializedStats.row_count : null,
    last_indexed_at: materializedAvailable ? materializedStats.last_indexed_at : null,
    territory_radius_note: mergedFilters.territory_filter?.radius
      ? "Radius filter uses indexed coordinates only — companies without lat/lng are excluded."
      : null,
  }
  logProspectSearchIndexMode(index_diagnostics)

  let indexCompanies
  let indexPeople

  if (useMaterialized) {
    indexCompanies = await loadProspectSearchMaterializedCompanies(admin, {
      query: input.query,
      territory_filter: mergedFilters.territory_filter,
    })
    const leadNames = new Map<string, string>()
    for (const company of indexCompanies) {
      if (company.growth_lead_id) leadNames.set(company.growth_lead_id, company.company_name)
    }
    indexPeople = await loadProspectSearchPeopleForQuery(admin, input.query, leadNames)
  } else {
    const built = await buildProspectSearchIndex(admin, input.query)
    indexCompanies = built.companies
    indexPeople = built.people
  }

  const filteredCompanies = applyProspectSearchFilters(indexCompanies, mergedFilters)
  const filteredPeople = filterProspectPeopleByTitle(
    indexPeople,
    mergedFilters.title_contains,
    mergedFilters.decision_maker_role,
  )

  const companyPage = paginateRankedProspectSearchCompanies(
    filteredCompanies,
    input.query,
    parsed,
    page,
    page_size,
    mergedFilters,
  )
  const peoplePage = paginateRankedProspectSearchPeople(
    filteredPeople,
    input.query,
    page,
    page_size,
  )

  const source_counts = buildSourceCounts(companyPage.companies)

  const companiesWithContacts = await applyProspectSearchContactIntelligenceOverlay(
    admin,
    companyPage.companies,
    { query: input.query, filters: mergedFilters, parsed },
  )
  const companiesWithMarket = await applyProspectSearchIntelligenceOverlays(
    admin,
    companiesWithContacts,
    {
      territory_id: mergedFilters.territory_id ?? null,
      industry: mergedFilters.industry ?? parsed.industry ?? null,
      territory_label: mergedFilters.territory_filter?.states?.[0]
        ? `${mergedFilters.territory_filter.states[0]} ${mergedFilters.industry ?? parsed.industry ?? ""}`.trim()
        : null,
    },
  )

  return attachTerritoryIntelligenceToSearchResult(
    admin,
    {
    qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
    discovery_mode: "internal",
    query: input.query,
    parsed_query: parsed,
    filters: mergedFilters,
    companies: companiesWithMarket,
    people: peoplePage.people,
    total_companies: companyPage.total_count,
    total_people: peoplePage.total_count,
    page: companyPage.page,
    page_size: companyPage.page_size,
    has_next_page: companyPage.has_next_page,
    index_diagnostics,
    source_counts,
    },
    companiesWithMarket,
  )
}

export async function resolveProspectSearchCompanyResultsForPush(
  admin: SupabaseClient,
  input: {
    query: string
    filters?: GrowthProspectSearchFilters
    discovery_mode?: GrowthProspectSearchDiscoveryMode
    selected: Array<{ source_type: GrowthProspectSearchSourceType; id: string }>
  },
): Promise<Map<string, import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult>> {
  const { prospectSearchSelectionKey } = await import(
    "@/lib/growth/prospect-search/prospect-search-selection"
  )
  const {
    loadProspectSearchCompaniesByRefs,
    isProspectSearchMaterializedIndexAvailable,
    getProspectSearchMaterializedIndexStats,
  } = await import("@/lib/growth/prospect-search/prospect-search-materialized-index")

  const map = new Map<
    string,
    import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult
  >()

  const parsed = parseProspectSearchQuery(input.query)
  const mergedFilters = normalizeProspectSearchFilters(input.filters ?? {})

  const materializedAvailable = await isProspectSearchMaterializedIndexAvailable(admin)
  const stats = materializedAvailable
    ? await getProspectSearchMaterializedIndexStats(admin)
    : { row_count: 0, last_indexed_at: null }

  if (materializedAvailable && stats.row_count > 0) {
    const indexed = await loadProspectSearchCompaniesByRefs(admin, input.selected)
    for (const ref of input.selected) {
      const key = `${ref.source_type}:${ref.id}`
      const row = indexed.get(key)
      if (!row) continue
      const filtered = applyProspectSearchFilters([row], mergedFilters)
      if (filtered.length === 0) continue
      const [ranked] = rankProspectSearchCompanies(filtered, input.query, parsed, 1, mergedFilters)
      if (ranked) map.set(prospectSearchSelectionKey(ranked), ranked)
    }
  }

  if (map.size >= input.selected.length) return map

  const search = await runProspectSearch(admin, {
    query: input.query,
    filters: input.filters,
    discovery_mode: input.discovery_mode,
    page: 1,
    page_size: 200,
  })

  for (const company of search.companies) {
    map.set(prospectSearchSelectionKey(company), company)
  }

  return map
}
