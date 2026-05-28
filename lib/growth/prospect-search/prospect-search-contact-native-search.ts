/** Contact-native people-first search orchestration. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mergeProspectSearchPeopleResults,
  type GrowthProspectSearchPeopleResultRow,
  type ProspectSearchResultMode,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { applyProspectSearchContactFirstHydrationLayers } from "@/lib/growth/prospect-search/prospect-search-contact-first-orchestration"
import { attachReachableHumanToCompanies } from "@/lib/growth/prospect-search/prospect-search-contactability-ranking"
import {
  buildContactNativeIndexRecordsFromCompanies,
  GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-native-index"
import {
  filterProspectSearchQueueReadyPeopleRows,
  rankProspectSearchPeopleNativeRows,
  rankProspectSearchPersonResultsNative,
} from "@/lib/growth/prospect-search/prospect-search-people-native-ranking"
import {
  buildProspectSearchCursorPage,
  clampProspectSearchPageSize,
  GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-scalable-pagination"
import { rankProspectSearchCompanies } from "@/lib/growth/prospect-search/prospect-search-ranking"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchIndexCompany,
  GrowthProspectSearchIndexPerson,
  GrowthProspectSearchParsedQuery,
  GrowthProspectSearchSortBy,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER = "growth-contact-native-pagination-v1" as const
export const GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER = "growth-prospeo-style-results-v1" as const
export const GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER = "growth-progressive-company-overlay-v1" as const

const PEOPLE_HYDRATION_BATCH_SIZE = 500

export function buildContactNativePeopleFromHydratedCompanies(input: {
  companies: GrowthProspectSearchCompanyResult[]
  filteredPeople?: GrowthProspectSearchIndexPerson[]
  query: string
  page: number
  page_size: number
  result_mode: ProspectSearchResultMode
}): Omit<ContactNativePeopleSearchResult, "qa_markers"> & {
  qa_markers: ContactNativePeopleSearchResult["qa_markers"]
} {
  const page_size = clampProspectSearchPageSize(input.page_size)
  const page = Math.max(1, input.page)
  const filteredPeople = input.filteredPeople ?? []

  const companiesWithReachable = attachReachableHumanToCompanies(input.companies)
  const nativeRecords = buildContactNativeIndexRecordsFromCompanies(companiesWithReachable)

  const rankedIndexPeople = rankProspectSearchPersonResultsNative(
    filteredPeople.map((person) => ({
      id: person.id,
      source_type: person.source_type,
      company_id: person.company_id,
      company_name: person.company_name,
      full_name: person.full_name,
      title: person.title,
      email: person.email,
      phone: person.phone,
      role: person.role,
      verification_status: person.verification_status,
      rank_score: 0,
    })),
    input.query,
    nativeRecords,
  )

  let peopleRows = mergeProspectSearchPeopleResults(rankedIndexPeople, companiesWithReachable)
  peopleRows = rankProspectSearchPeopleNativeRows(peopleRows, input.query)

  if (input.result_mode === "queue") {
    peopleRows = filterProspectSearchQueueReadyPeopleRows(peopleRows)
  }

  const total_people = peopleRows.length
  const offset = (page - 1) * page_size
  const pageRows = peopleRows.slice(offset, offset + page_size)

  const companyIds = new Set(pageRows.map((row) => row.company_id))
  const companies = companiesWithReachable
    .filter((company) => companyIds.has(company.id))
    .map((company) => ({
      ...company,
      lightweight_mode: true,
      progressive_enrichment: company.progressive_enrichment ?? null,
    }))

  const cursorPage = buildProspectSearchCursorPage({
    page,
    page_size,
    total_count: total_people,
    sort_token: "people_native",
  })

  return {
    qa_markers: {
      contact_native_search: GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER,
      contact_native_pagination: GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER,
      prospeo_style_results: GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER,
      progressive_company_overlay: GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER,
      scalable_search: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
    },
    people_rows: pageRows,
    companies,
    total_people,
    page: cursorPage.page,
    page_size: cursorPage.page_size,
    has_next_page: cursorPage.has_next_page,
    people_cursor: cursorPage.cursor,
    people_next_cursor: cursorPage.next_cursor,
    native_index_count: nativeRecords.length,
    hydration_batch_size: companiesWithReachable.length,
  }
}

export type ContactNativePeopleSearchResult = {
  qa_markers: {
    contact_native_search: typeof GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER
    contact_native_pagination: typeof GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER
    prospeo_style_results: typeof GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER
    progressive_company_overlay: typeof GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER
    scalable_search: typeof GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER
  }
  people_rows: GrowthProspectSearchPeopleResultRow[]
  companies: GrowthProspectSearchCompanyResult[]
  total_people: number
  page: number
  page_size: number
  has_next_page: boolean
  people_cursor: string | null
  people_next_cursor: string | null
  native_index_count: number
  hydration_batch_size: number
}

export async function runContactNativePeopleSearch(
  admin: SupabaseClient,
  input: {
    filteredCompanies: GrowthProspectSearchIndexCompany[]
    filteredPeople: GrowthProspectSearchIndexPerson[]
    query: string
    parsed: GrowthProspectSearchParsedQuery
    filters: GrowthProspectSearchFilters
    sort_by: GrowthProspectSearchSortBy
    page: number
    page_size: number
    result_mode: ProspectSearchResultMode
    pdl_augmentation?: boolean
  },
): Promise<ContactNativePeopleSearchResult> {
  const page_size = clampProspectSearchPageSize(input.page_size)
  const page = Math.max(1, input.page)

  const rankedCompanies = rankProspectSearchCompanies(
    input.filteredCompanies,
    input.query,
    input.parsed,
    input.filteredCompanies.length || 1,
    input.filters,
  )

  const hydrationBatch = rankedCompanies.slice(0, PEOPLE_HYDRATION_BATCH_SIZE)
  const { companies: hydratedCompanies } = await applyProspectSearchContactFirstHydrationLayers(
    admin,
    {
      companies: hydrationBatch,
      query: input.query,
      filters: input.filters,
      parsed: input.parsed,
      sort_by: input.sort_by,
      operator_intent: input.result_mode === "queue",
      pdl_augmentation:
        input.pdl_augmentation ??
        (input.result_mode === "people" || input.result_mode === "queue"),
    },
  )

  const native = buildContactNativePeopleFromHydratedCompanies({
    companies: hydratedCompanies,
    filteredPeople: input.filteredPeople,
    query: input.query,
    page,
    page_size,
    result_mode: input.result_mode,
  })

  return {
    ...native,
    hydration_batch_size: hydrationBatch.length,
  }
}

export function paginateContactNativePeopleRowsClient(input: {
  rows: GrowthProspectSearchPeopleResultRow[]
  query: string
  page: number
  page_size: number
  result_mode: ProspectSearchResultMode
}): {
  rows: GrowthProspectSearchPeopleResultRow[]
  total_people: number
  page: number
  page_size: number
  has_next_page: boolean
} {
  const page_size = clampProspectSearchPageSize(input.page_size)
  const page = Math.max(1, input.page)
  let ranked = rankProspectSearchPeopleNativeRows(input.rows, input.query)
  if (input.result_mode === "queue") {
    ranked = filterProspectSearchQueueReadyPeopleRows(ranked)
  }
  const offset = (page - 1) * page_size
  return {
    rows: ranked.slice(offset, offset + page_size),
    total_people: ranked.length,
    page,
    page_size,
    has_next_page: offset + page_size < ranked.length,
  }
}
