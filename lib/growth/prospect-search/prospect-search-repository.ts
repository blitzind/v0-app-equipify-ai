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
import {
  isAutonomousProspectDiscoveryAuthority,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { runProspectSearchDatamoonAutonomousDiscovery } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { mapProspectSearchCompaniesToDiscoverResults } from "@/lib/growth/prospect-search/prospect-search-discover-results"
import { applyProspectSearchContactFirstHydrationLayers } from "@/lib/growth/prospect-search/prospect-search-contact-first-orchestration"
import { attachReachableHumanToCompanies } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import { GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-progressive-enrichment"
import { clampProspectSearchPageSize, GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-scalable-pagination"
import {
  buildContactNativePeopleFromHydratedCompanies,
  runContactNativePeopleSearch,
} from "@/lib/growth/prospect-search/prospect-search-contact-native-search"
import {
  applyTerritoryFiltersToSearchInput,
  attachTerritoryIntelligenceToSearchResult,
} from "@/lib/growth/territory-intelligence/integrations/prospect-search-bridge"
import { runProspectSearchRealWorldDiscovery } from "@/lib/growth/prospect-search/prospect-search-real-world-discovery"
import {
  buildProspectSearchProviderRuntimeDiagnostics,
  GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER,
  GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import {
  applyProspectSearchSignalIntelligenceOverlay,
  type GrowthProspectSearchSortBy,
} from "@/lib/growth/signals/integrations/prospect-search-signal-intelligence-loader"
import { GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_SOURCE_TYPES,
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
  GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER,
  GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER,
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
  sort_by?: GrowthProspectSearchSortBy
  created_by?: string | null
  result_mode?: import("@/lib/growth/prospect-search/prospect-search-contact-discovery").ProspectSearchResultMode
  discovery_authority?: import("@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a").ProspectSearchDiscoveryAuthority
  organization_id?: string
  approved_profile?: import("@/lib/growth/business-profile/business-profile-types").BusinessProfileDraftContent
  company_name?: string | null
  read_only_proof?: boolean
  discoveries_today?: number
  maximum_daily_discovery?: number
  generated_at?: string
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
  const sort_by: GrowthProspectSearchSortBy = input.sort_by ?? "rank"
  const page = Math.max(1, input.page ?? 1)
  const page_size = clampProspectSearchPageSize(input.page_size ?? input.limit ?? 50)
  const external_limit = clampProspectSearchPageSize(input.limit ?? page_size)
  const result_mode = input.result_mode ?? "people"
  const peopleFirstMode = result_mode === "people" || result_mode === "queue"

  if (discovery_mode === "discover_external") {
    if (isAutonomousProspectDiscoveryAuthority(input.discovery_authority)) {
      if (!input.organization_id || !input.approved_profile) {
        const emptyDiagnostics = buildProspectSearchProviderRuntimeDiagnostics({
          provider_diagnostics: [
            {
              provider_name: "DataMoon",
              provider_type: "datamoon",
              provider_executed: false,
              provider_latency_ms: 0,
              provider_result_count: 0,
              provider_fallback_reason: "business_profile_missing",
            },
          ],
          query_expansion: [],
          raw_result_count: 0,
          normalized_result_count: 0,
          filtered_result_count: 0,
          filter_diagnostics: {
            normalized_result_count: 0,
            dropped_result_count: 0,
            dropped_reasons: {},
          },
          used_relaxed_filters: false,
          fixture_active: false,
        })

        return attachTerritoryIntelligenceToSearchResult(admin, {
          qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
          discovery_mode,
          sort_by,
          signal_momentum_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
          query: input.query,
          parsed_query: parsed,
          filters: mergedFilters,
          companies: [],
          raw_provider_companies: [],
          discover_results: [],
          filtered_discover_results: [],
          people: [],
          people_rows: [],
          total_companies: 0,
          total_people: 0,
          page: 1,
          page_size: external_limit,
          has_next_page: false,
          people_cursor: null,
          people_next_cursor: null,
          source_counts: buildSourceCounts([]),
          provider_status_label: emptyDiagnostics.provider_status_label,
          provider_status_message: "Approved Business Profile required for autonomous DataMoon discovery.",
          provider_runtime_diagnostics: emptyDiagnostics,
          provider_runtime_diagnostics_qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
          datamoon_autonomous_discovery_qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
        }, [])
      }

      const datamoonDiscovery = await runProspectSearchDatamoonAutonomousDiscovery(admin, {
        organizationId: input.organization_id,
        approvedProfile: input.approved_profile,
        companyName: input.company_name,
        query: input.query,
        filters: mergedFilters,
        limit: external_limit,
        generatedAt: input.generated_at ?? new Date().toISOString(),
        createdBy: input.created_by,
        authority: input.discovery_authority ?? "autonomous_portfolio",
        readOnlyProof: input.read_only_proof,
        discoveriesToday: input.discoveries_today,
        maximumDailyDiscovery: input.maximum_daily_discovery,
      })

      const externalEnrichment = await enrichProspectSearchExternalCompanies(
        admin,
        datamoonDiscovery.companies,
        {
          query: input.query,
          filters: mergedFilters,
          parsed,
        },
      )

      const enrichedCompanies = externalEnrichment.companies
      const provider_runtime_diagnostics = buildProspectSearchProviderRuntimeDiagnostics({
        provider_diagnostics: [
          {
            provider_name: "DataMoon",
            provider_type: "datamoon",
            provider_executed: datamoonDiscovery.jobCreated || datamoonDiscovery.jobReused,
            provider_latency_ms: 0,
            provider_result_count: datamoonDiscovery.rawCompanyCount,
            provider_fallback_reason: datamoonDiscovery.stopReason,
          },
        ],
        query_expansion: [],
        raw_result_count: datamoonDiscovery.rawCompanyCount,
        normalized_result_count: datamoonDiscovery.normalizedCompanyCount,
        filtered_result_count: enrichedCompanies.length,
        filter_diagnostics: externalEnrichment.filter_diagnostics,
        used_relaxed_filters: externalEnrichment.used_relaxed_filters,
        fixture_active: false,
      })

      const { companies: companiesWithSignals, hydration: contact_first_hydration } =
        await applyProspectSearchContactFirstHydrationLayers(admin, {
          companies: enrichedCompanies,
          query: input.query,
          filters: mergedFilters,
          parsed,
          sort_by,
          operator_intent: peopleFirstMode,
          pdl_augmentation: peopleFirstMode,
        })

      return attachTerritoryIntelligenceToSearchResult(
        admin,
        {
          qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
          discovery_mode,
          sort_by,
          signal_momentum_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
          query: input.query,
          parsed_query: parsed,
          filters: mergedFilters,
          companies: companiesWithSignals,
          raw_provider_companies: externalEnrichment.raw_companies,
          discover_results: mapProspectSearchCompaniesToDiscoverResults(externalEnrichment.raw_companies),
          filtered_discover_results: mapProspectSearchCompaniesToDiscoverResults(companiesWithSignals),
          people: [],
          people_rows: [],
          total_companies: companiesWithSignals.length,
          total_people: 0,
          page: 1,
          page_size: external_limit,
          has_next_page: false,
          people_cursor: null,
          people_next_cursor: null,
          source_counts: buildSourceCounts(companiesWithSignals),
          real_world_built_query: datamoonDiscovery.built_query,
          provider_messages: [datamoonDiscovery.providerStatusMessage],
          provider_status_label: provider_runtime_diagnostics.provider_status_label,
          provider_status_message: datamoonDiscovery.providerStatusMessage,
          provider_diagnostics: provider_runtime_diagnostics.provider_diagnostics,
          provider_runtime_diagnostics,
          used_relaxed_external_filters: externalEnrichment.used_relaxed_filters,
          provider_runtime_diagnostics_qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
          external_filter_diagnostics: externalEnrichment.filter_diagnostics,
          datamoon_autonomous_discovery_qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
          datamoon_autonomous_discovery_run_id: datamoonDiscovery.runId,
          datamoon_autonomous_discovery_job_active: datamoonDiscovery.jobActive,
          datamoon_autonomous_discovery_job_created: datamoonDiscovery.jobCreated,
          datamoon_autonomous_discovery_job_reused: datamoonDiscovery.jobReused,
          datamoon_autonomous_discovery_stop_reason: datamoonDiscovery.stopReason,
          datamoon_autonomous_discovery_raw_company_count: datamoonDiscovery.rawCompanyCount,
          datamoon_autonomous_discovery_normalized_company_count: datamoonDiscovery.normalizedCompanyCount,
          datamoon_autonomous_discovery_normalization_stats: datamoonDiscovery.normalizationStats,
          discovery_hydration: {
            qa_marker: contact_first_hydration.qa_marker,
            hydration_complete: contact_first_hydration.hydration_complete,
            partial_intelligence: contact_first_hydration.partial_intelligence,
            diagnostics: contact_first_hydration.diagnostics,
            summary: contact_first_hydration.summary,
          },
          contact_first_hydration,
          contact_first_qa_marker: GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER,
          scalable_search_qa_marker: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
          discovery_runtime_hardening_qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
        },
        companiesWithSignals,
      )
    }

    const realWorld = await runProspectSearchRealWorldDiscovery(admin, {
      query: input.query,
      filters: mergedFilters,
      created_by: input.created_by,
      limit: external_limit,
    })

    const externalEnrichment = await enrichProspectSearchExternalCompanies(
      admin,
      realWorld.companies,
      {
        query: input.query,
        filters: mergedFilters,
        parsed,
      },
    )

    let enrichedCompanies = externalEnrichment.companies
    const used_relaxed_filters = externalEnrichment.used_relaxed_filters

    const query_expansion = [
      ...new Set(
        (realWorld.provider_status?.provider_diagnostics ?? []).flatMap(
          (row) => row.provider_query_generated ?? [],
        ),
      ),
    ]

    const provider_runtime_diagnostics = buildProspectSearchProviderRuntimeDiagnostics({
      provider_diagnostics: realWorld.provider_status?.provider_diagnostics ?? [],
      query_expansion,
      raw_result_count: realWorld.companies.length,
      normalized_result_count: realWorld.companies.length,
      filtered_result_count: enrichedCompanies.length,
      filter_diagnostics: externalEnrichment.filter_diagnostics,
      used_relaxed_filters,
      fixture_active: realWorld.provider_status?.fixture_active ?? false,
    })

    let provider_status_message = provider_runtime_diagnostics.provider_status_message
    let provider_status_label = provider_runtime_diagnostics.provider_status_label

    if (realWorld.persist_warning) {
      provider_status_message = `${provider_status_message} ${realWorld.persist_warning}`
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[prospect-search:external]", {
        qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
        provider_status_label,
        built_query: realWorld.built_query,
        query_expansion,
        raw_provider_count: realWorld.companies.length,
        normalized_result_count: enrichedCompanies.length,
        filter_diagnostics: externalEnrichment.filter_diagnostics,
        used_relaxed_filters,
        provider_diagnostics: realWorld.provider_status?.provider_diagnostics ?? [],
        dropped_reason_counts: provider_runtime_diagnostics.dropped_reason_counts,
      })
    }

    const { companies: companiesWithSignals, hydration: contact_first_hydration } =
      await applyProspectSearchContactFirstHydrationLayers(admin, {
        companies: enrichedCompanies,
        query: input.query,
        filters: mergedFilters,
        parsed,
        sort_by,
        operator_intent: peopleFirstMode,
        pdl_augmentation: peopleFirstMode,
      })

    const source_counts = buildSourceCounts(companiesWithSignals)
    const rawProviderCompanies = externalEnrichment.raw_companies

    const externalNative =
      peopleFirstMode && sort_by !== "signal_momentum"
        ? buildContactNativePeopleFromHydratedCompanies({
            companies: companiesWithSignals,
            filteredPeople: [],
            filters: mergedFilters,
            query: input.query,
            page,
            page_size,
            result_mode,
          })
        : null

    return attachTerritoryIntelligenceToSearchResult(
      admin,
      {
      qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
      discovery_mode,
      sort_by,
      signal_momentum_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
      query: input.query,
      parsed_query: parsed,
      filters: mergedFilters,
      companies: externalNative?.companies.length ? externalNative.companies : companiesWithSignals,
      raw_provider_companies: rawProviderCompanies,
      discover_results: mapProspectSearchCompaniesToDiscoverResults(rawProviderCompanies),
      filtered_discover_results: mapProspectSearchCompaniesToDiscoverResults(companiesWithSignals),
      people:
        externalNative?.people_rows.map((row) => ({
          id: row.contact_id,
          source_type: row.source_type,
          company_id: row.company_id,
          company_name: row.company_name,
          full_name: row.full_name,
          title: row.title,
          email: row.email,
          phone: row.phone,
          role: row.role,
          verification_status: row.verification_status,
          rank_score: row.contact_native_rank_score ?? row.rank_score,
        })) ?? [],
      people_rows: externalNative?.people_rows ?? [],
      total_companies: companiesWithSignals.length,
      total_people: externalNative?.total_people ?? 0,
      page: externalNative?.page ?? 1,
      page_size: externalNative?.page_size ?? companiesWithSignals.length,
      has_next_page: externalNative?.has_next_page ?? false,
      people_cursor: externalNative?.people_cursor ?? null,
      people_next_cursor: externalNative?.people_next_cursor ?? null,
      result_mode: peopleFirstMode ? result_mode : undefined,
      contact_native_search_qa_marker: externalNative?.qa_markers.contact_native_search ?? null,
      contact_native_pagination_qa_marker: externalNative?.qa_markers.contact_native_pagination ?? null,
      prospeo_style_results_qa_marker: externalNative?.qa_markers.prospeo_style_results ?? null,
      progressive_company_overlay_qa_marker: externalNative?.qa_markers.progressive_company_overlay ?? null,
      source_counts,
      external_discovery_run_id: realWorld.discovery_run_id,
      real_world_discovery_run_id: realWorld.discovery_run_id,
      real_world_built_query: realWorld.built_query,
      provider_messages: realWorld.provider_messages,
      provider_status_label: provider_status_label,
      provider_status_message: provider_status_message,
      provider_diagnostics: realWorld.provider_status?.provider_diagnostics ?? [],
      provider_fallback_reason: realWorld.provider_status?.provider_fallback_reason ?? null,
      provider_runtime_diagnostics,
      used_relaxed_external_filters: used_relaxed_filters,
      provider_runtime_diagnostics_qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
      provider_relaxed_filter_retry_qa_marker: used_relaxed_filters
        ? GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER
        : null,
      provider_audit_qa_marker: GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
      google_places_query_expansion_qa_marker: GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER,
      live_provider_query_expansion_qa_marker: GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER,
      provider_cache_qa_marker: GROWTH_PROVIDER_CACHE_QA_MARKER,
      external_filter_diagnostics: externalEnrichment.filter_diagnostics,
      expanded_search_exhausted:
        enrichedCompanies.length === 0 &&
        provider_status_label === "provider_returned_raw_0",
      discovery_hydration: {
        qa_marker: contact_first_hydration.qa_marker,
        hydration_complete: contact_first_hydration.hydration_complete,
        partial_intelligence: contact_first_hydration.partial_intelligence,
        diagnostics: contact_first_hydration.diagnostics,
        summary: contact_first_hydration.summary,
      },
      contact_first_hydration,
      contact_first_qa_marker: GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER,
      scalable_search_qa_marker: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
      discovery_runtime_hardening_qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
      },
      companiesWithSignals,
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

  if (peopleFirstMode && sort_by !== "signal_momentum") {
    const native = await runContactNativePeopleSearch(admin, {
      filteredCompanies,
      filteredPeople,
      query: input.query,
      parsed,
      filters: mergedFilters,
      sort_by,
      page,
      page_size,
      result_mode,
    })

    const source_counts = buildSourceCounts(native.companies)

    return attachTerritoryIntelligenceToSearchResult(
      admin,
      {
        qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
        discovery_mode: "internal",
        sort_by,
        signal_momentum_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
        query: input.query,
        parsed_query: parsed,
        filters: mergedFilters,
        companies: native.companies,
        people: native.people_rows.map((row) => ({
          id: row.contact_id,
          source_type: row.source_type,
          company_id: row.company_id,
          company_name: row.company_name,
          full_name: row.full_name,
          title: row.title,
          email: row.email,
          phone: row.phone,
          role: row.role,
          verification_status: row.verification_status,
          rank_score: row.contact_native_rank_score ?? row.rank_score,
        })),
        people_rows: native.people_rows,
        total_companies: filteredCompanies.length,
        total_people: native.total_people,
        page: native.page,
        page_size: native.page_size,
        has_next_page: native.has_next_page,
        people_cursor: native.people_cursor,
        people_next_cursor: native.people_next_cursor,
        result_mode,
        index_diagnostics,
        source_counts,
        contact_first_qa_marker: GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER,
        scalable_search_qa_marker: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
        contact_native_search_qa_marker: native.qa_markers.contact_native_search,
        contact_native_pagination_qa_marker: native.qa_markers.contact_native_pagination,
        prospeo_style_results_qa_marker: native.qa_markers.prospeo_style_results,
        progressive_company_overlay_qa_marker: native.qa_markers.progressive_company_overlay,
      },
      native.companies,
    )
  }

  let companyPageCompanies: GrowthProspectSearchCompanyResult[]
  let companyPageMeta: {
    total_count: number
    page: number
    page_size: number
    has_next_page: boolean
  }

  if (sort_by === "signal_momentum") {
    const rankedAll = rankProspectSearchCompanies(
      filteredCompanies,
      input.query,
      parsed,
      filteredCompanies.length || 1,
      mergedFilters,
    )
    const withSignals = await applyProspectSearchSignalIntelligenceOverlay(admin, rankedAll, {
      sort_by: "signal_momentum",
    })
    const offset = (page - 1) * page_size
    companyPageCompanies = withSignals.slice(offset, offset + page_size)
    companyPageMeta = {
      total_count: withSignals.length,
      page,
      page_size,
      has_next_page: offset + page_size < withSignals.length,
    }
  } else {
    const companyPage = paginateRankedProspectSearchCompanies(
      filteredCompanies,
      input.query,
      parsed,
      page,
      page_size,
      mergedFilters,
    )
    companyPageCompanies = companyPage.companies
    companyPageMeta = {
      total_count: companyPage.total_count,
      page: companyPage.page,
      page_size: companyPage.page_size,
      has_next_page: companyPage.has_next_page,
    }
  }

  const peoplePage = paginateRankedProspectSearchPeople(
    filteredPeople,
    input.query,
    page,
    page_size,
  )

  const source_counts = buildSourceCounts(companyPageCompanies)

  const { companies: contactFirstCompanies, hydration: contact_first_hydration } =
    await applyProspectSearchContactFirstHydrationLayers(admin, {
      companies: companyPageCompanies,
      query: input.query,
      filters: mergedFilters,
      parsed,
      sort_by,
      operator_intent: false,
    })

  const companiesWithSignals =
    sort_by === "signal_momentum"
      ? await applyProspectSearchSignalIntelligenceOverlay(admin, contactFirstCompanies, {
          sort_by,
        }).catch(() => contactFirstCompanies)
      : attachReachableHumanToCompanies(contactFirstCompanies)

  return attachTerritoryIntelligenceToSearchResult(
    admin,
    {
    qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
    discovery_mode: "internal",
    sort_by,
    signal_momentum_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    query: input.query,
    parsed_query: parsed,
    filters: mergedFilters,
    companies: companiesWithSignals,
    people: peoplePage.people,
    total_companies: companyPageMeta.total_count,
    total_people: peoplePage.total_count,
    page: companyPageMeta.page,
    page_size: companyPageMeta.page_size,
    has_next_page: companyPageMeta.has_next_page,
    index_diagnostics,
    source_counts,
    contact_first_hydration,
    contact_first_qa_marker: GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER,
    scalable_search_qa_marker: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
    },
    companiesWithSignals,
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
