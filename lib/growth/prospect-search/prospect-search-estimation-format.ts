/** Client-safe formatting for live Prospect Search estimates — never fake precision. */

import type {
  GrowthMarketEstimationTier,
} from "@/lib/growth/prospect-search/prospect-search-presearch-market-estimation"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  GrowthProspectSearchEstimateConfidence,
  GrowthProspectSearchEstimateState,
  GrowthProspectSearchProviderReadiness,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"

const RANGE_FLOORS = [10, 50, 250, 1000] as const

export const PROSPECT_SEARCH_ESTIMATE_UNAVAILABLE_LABEL =
  "Estimate unavailable — click Search to run discovery" as const

/** Same numeric formatting as pagination (`totalCount.toLocaleString()`). */
export function formatProspectSearchMatchingCount(count: number): string {
  return count.toLocaleString()
}

export function floorEstimateToRange(count: number): { floor: number; label: string } {
  if (count <= 0) return { floor: 0, label: "No likely matches" }
  if (count < 10) return { floor: count, label: `~${count}` }
  for (let i = RANGE_FLOORS.length - 1; i >= 0; i -= 1) {
    const floor = RANGE_FLOORS[i]!
    if (count >= floor) {
      return { floor, label: floor >= 1000 ? "~1k+" : `~${floor}+` }
    }
  }
  return { floor: 10, label: "~10+" }
}

export function buildProspectSearchButtonLabel(input: {
  state: GrowthProspectSearchEstimateState
  discovery_mode: GrowthProspectSearchDiscoveryMode
  exact_count: number | null
  confidence: GrowthProspectSearchEstimateConfidence
  provider_readiness: GrowthProspectSearchProviderReadiness
  broad_market_category?: boolean
  market_tier?: GrowthMarketEstimationTier | null
}): { label: string; disabled: boolean } {
  if (
    input.discovery_mode === "discover_external" &&
    !input.provider_readiness.external_discovery_available
  ) {
    return { label: "Provider unavailable", disabled: true }
  }

  if (input.discovery_mode === "discover_external") {
    return { label: "Search market", disabled: false }
  }

  if (input.broad_market_category || input.market_tier === "large" || input.market_tier === "massive") {
    return { label: "Search", disabled: false }
  }

  if (input.state === "no_likely_matches" && !input.broad_market_category) {
    return { label: "Search", disabled: false }
  }

  const count = input.exact_count ?? 0
  if (count > 0 && input.confidence === "high") {
    return { label: `Search ${formatProspectSearchMatchingCount(count)} companies`, disabled: false }
  }

  return { label: "Search", disabled: false }
}

export function countActiveProspectSearchFilters(filters: GrowthProspectSearchFilters): number {
  return Object.entries(filters).filter(([key, value]) => {
    if (value == null) return false
    if (key === "existing_account_mode" && value === "any") return false
    if (key === "suppression_mode" && value === "exclude") return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }).length
}
