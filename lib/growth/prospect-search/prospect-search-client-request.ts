/** Client-safe Prospect Search GET request builder (shell + tests). */

import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export function compactProspectSearchFiltersForTransport(
  filters: GrowthProspectSearchFilters,
): Partial<GrowthProspectSearchFilters> | null {
  const entries = Object.entries(filters).filter(([key, value]) => {
    if (value == null) return false
    if (key === "existing_account_mode" && value === "any") return false
    if (key === "suppression_mode" && value === "exclude") return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  })
  if (entries.length === 0) return null
  return Object.fromEntries(entries) as Partial<GrowthProspectSearchFilters>
}

export function buildProspectSearchGetRequestParams(input: {
  query: string
  filters: Partial<GrowthProspectSearchFilters>
  discoveryMode: GrowthProspectSearchDiscoveryMode
  page: number
  pageSize: number
  includeMeta?: boolean
}): URLSearchParams {
  const params = new URLSearchParams({
    meta: input.includeMeta === false ? "0" : "1",
    q: input.query,
    page: String(input.page),
    page_size: String(input.pageSize),
  })

  if (input.discoveryMode === "discover_external") {
    params.set("mode", "discover_external")
  }

  const normalized = normalizeProspectSearchFilters(input.filters)
  const payload = compactProspectSearchFiltersForTransport(normalized)
  if (payload) {
    params.set("filters", JSON.stringify(payload))
  }

  return params
}
