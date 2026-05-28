/** Client-safe rules for when live Prospect Search estimates may appear. */

import { countActiveProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-estimation-format"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER =
  "growth-discover-estimate-hidden-when-stale-v1" as const

export function buildProspectSearchEstimateCriteriaKey(
  query: string,
  filters: GrowthProspectSearchFilters,
): string {
  return `${query.trim()}\0${JSON.stringify(filters)}`
}

export function hasProspectSearchEstimateCriteria(
  query: string,
  filters: GrowthProspectSearchFilters,
): boolean {
  if (query.trim().length > 0) return true
  return countActiveProspectSearchFilters(filters) > 0
}

export function shouldShowProspectSearchLiveEstimate(input: {
  hasCriteria: boolean
  loading: boolean
  estimate: GrowthProspectSearchLiveEstimate | null
  criteriaKey: string
  matchedCriteriaKey: string | null
}): boolean {
  if (!input.hasCriteria) return false
  if (input.matchedCriteriaKey == null) {
    return input.loading
  }
  if (input.matchedCriteriaKey !== input.criteriaKey) {
    return input.loading
  }
  if (!input.estimate) return input.loading
  if (input.estimate.estimate_visible === false) return false
  return true
}

export function isProspectSearchLiveEstimateStale(
  criteriaKey: string,
  matchedCriteriaKey: string | null,
): boolean {
  if (matchedCriteriaKey == null) return criteriaKey.length > 0
  return matchedCriteriaKey !== criteriaKey
}
