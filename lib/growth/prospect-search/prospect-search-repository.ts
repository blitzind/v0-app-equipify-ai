import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyProspectSearchFilters,
  filterProspectPeopleByTitle,
  normalizeProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import { createInternalProspectSearchProvider } from "@/lib/growth/prospect-search/prospect-search-provider"
import {
  mergeParsedQueryIntoFilters,
  parseProspectSearchQuery,
} from "@/lib/growth/prospect-search/prospect-search-query-parser"
import {
  rankProspectSearchCompanies,
  rankProspectSearchPeople,
} from "@/lib/growth/prospect-search/prospect-search-ranking"
import { runProspectSearchRealWorldDiscovery } from "@/lib/growth/prospect-search/prospect-search-real-world-discovery"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_SOURCE_TYPES,
  GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
  type GrowthProspectSearchDiscoveryMode,
  type GrowthProspectSearchFilters,
  type GrowthProspectSearchResult,
  type GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"

export type RunProspectSearchInput = {
  query: string
  filters?: Partial<GrowthProspectSearchFilters>
  limit?: number
  discovery_mode?: GrowthProspectSearchDiscoveryMode
  created_by?: string | null
}

export async function runProspectSearch(
  admin: SupabaseClient,
  input: RunProspectSearchInput,
): Promise<GrowthProspectSearchResult> {
  const parsed = parseProspectSearchQuery(input.query)
  const mergedFilters = normalizeProspectSearchFilters(
    mergeParsedQueryIntoFilters(parsed, input.filters ?? {}) as GrowthProspectSearchFilters,
  )

  const discovery_mode = input.discovery_mode ?? "internal"

  if (discovery_mode === "discover_external") {
    const realWorld = await runProspectSearchRealWorldDiscovery(admin, {
      query: input.query,
      filters: mergedFilters,
      created_by: input.created_by,
      limit: input.limit ?? 50,
    })

    const source_counts = Object.fromEntries(
      GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.map((t) => [t, 0]),
    ) as Record<GrowthProspectSearchSourceType, number>
    for (const c of realWorld.companies) {
      source_counts[c.source_type] = (source_counts[c.source_type] ?? 0) + 1
    }

    return {
      qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
      discovery_mode,
      query: input.query,
      parsed_query: parsed,
      filters: mergedFilters,
      companies: realWorld.companies,
      people: [],
      total_companies: realWorld.companies.length,
      total_people: 0,
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
    }
  }

  const provider = createInternalProspectSearchProvider()
  provider.describe()

  const { companies: indexCompanies, people: indexPeople } = await buildProspectSearchIndex(
    admin,
    input.query,
  )

  const filteredCompanies = applyProspectSearchFilters(indexCompanies, mergedFilters)
  const filteredPeople = filterProspectPeopleByTitle(
    indexPeople,
    mergedFilters.title_contains,
    mergedFilters.decision_maker_role,
  )

  const limit = input.limit ?? 100
  const companies = rankProspectSearchCompanies(
    filteredCompanies,
    input.query,
    parsed,
    limit,
  )
  const people = rankProspectSearchPeople(filteredPeople, input.query, limit)

  const source_counts = Object.fromEntries(
    GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.map((t) => [t, 0]),
  ) as Record<GrowthProspectSearchSourceType, number>
  for (const c of companies) {
    source_counts[c.source_type] = (source_counts[c.source_type] ?? 0) + 1
  }

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
    discovery_mode: "internal",
    query: input.query,
    parsed_query: parsed,
    filters: mergedFilters,
    companies,
    people,
    total_companies: companies.length,
    total_people: people.length,
    source_counts,
  }
}
