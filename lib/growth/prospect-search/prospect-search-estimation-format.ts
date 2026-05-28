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

const RANGE_FLOORS = [10, 50, 250, 1000, 2500, 10000] as const

export const PROSPECT_SEARCH_ESTIMATE_UNAVAILABLE_LABEL =
  "Estimate unavailable — click Search to run discovery" as const

export const PROSPECT_SEARCH_ESTIMATE_SOURCE_NOTE = "Based on internal index." as const

export const PROSPECT_SEARCH_NO_CREDITS_ESTIMATE_NOTE =
  "No credits used for estimate." as const

/** Same numeric formatting as pagination (`totalCount.toLocaleString()`). */
export function formatProspectSearchMatchingCount(count: number): string {
  return count.toLocaleString()
}

export function tierEstimateFloor(tier: GrowthMarketEstimationTier | null | undefined): number {
  switch (tier) {
    case "massive":
      return 10000
    case "large":
      return 2500
    case "moderate":
      return 250
    case "small":
      return 50
    case "tiny":
      return 10
    default:
      return 0
  }
}

export function buildProspectSearchNumericalEstimateDisplay(input: {
  company_count: number
  contact_count: number | null
  decision_maker_count: number | null
  tier: GrowthMarketEstimationTier | null
  broad_market_category: boolean
  discovery_mode: GrowthProspectSearchDiscoveryMode
  unavailable_filter_reasons: string[]
}): {
  numerical_headline: string
  display_label: string
  market_helper: string
  exact_count: number | null
  range_floor: number | null
} {
  const tierFloor = tierEstimateFloor(input.tier)
  const useTierFloor =
    input.company_count <= 0 && input.broad_market_category && tierFloor > 0
  const effectiveCount = input.company_count > 0 ? input.company_count : useTierFloor ? tierFloor : 0

  let exact_count: number | null = input.company_count > 0 ? input.company_count : null
  let range_floor: number | null = null
  let companyLabel: string

  if (input.company_count > 0) {
    companyLabel = `${formatProspectSearchMatchingCount(input.company_count)} matching companies`
  } else if (useTierFloor) {
    const ranged = floorEstimateToRange(tierFloor)
    range_floor = ranged.floor
    companyLabel = `${ranged.label} matching companies`
    exact_count = null
  } else if (effectiveCount > 0) {
    companyLabel = `${formatProspectSearchMatchingCount(effectiveCount)} matching companies`
  } else {
    companyLabel = "0 matching companies"
  }

  const helperLines = [PROSPECT_SEARCH_NO_CREDITS_ESTIMATE_NOTE, PROSPECT_SEARCH_ESTIMATE_SOURCE_NOTE]

  return {
    numerical_headline: companyLabel,
    display_label: companyLabel,
    market_helper: helperLines.join(" · "),
    exact_count,
    range_floor,
  }
}

export function floorEstimateToRange(count: number): { floor: number; label: string } {
  if (count <= 0) return { floor: 0, label: "No likely matches" }
  if (count < 10) return { floor: count, label: `~${count}` }
  for (let i = RANGE_FLOORS.length - 1; i >= 0; i -= 1) {
    const floor = RANGE_FLOORS[i]!
    if (count >= floor) {
      return { floor, label: floor >= 10000 ? "~10k+" : floor >= 1000 ? "~1k+" : `~${floor}+` }
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
