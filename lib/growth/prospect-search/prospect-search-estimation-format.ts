/** Client-safe formatting for live Prospect Search estimates — never fake precision. */

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

export function formatExactOrRangeLabel(input: {
  exact_count: number | null
  confidence: GrowthProspectSearchEstimateConfidence
  discovery_mode: GrowthProspectSearchDiscoveryMode
}): { display_label: string; range_floor: number | null } {
  const count = input.exact_count ?? 0
  if (input.confidence === "high" && input.exact_count != null) {
    return {
      display_label: `~${input.exact_count.toLocaleString()} estimated matches`,
      range_floor: input.exact_count,
    }
  }
  if (count <= 0 && input.discovery_mode === "discover_external") {
    return { display_label: "External discovery estimate unavailable", range_floor: null }
  }
  const ranged = floorEstimateToRange(count)
  return {
    display_label: `${ranged.label} estimated matches`,
    range_floor: ranged.floor,
  }
}

export function buildProspectSearchButtonLabel(input: {
  state: GrowthProspectSearchEstimateState
  discovery_mode: GrowthProspectSearchDiscoveryMode
  exact_count: number | null
  confidence: GrowthProspectSearchEstimateConfidence
  provider_readiness: GrowthProspectSearchProviderReadiness
}): { label: string; disabled: boolean } {
  if (input.state === "provider_unavailable" && input.discovery_mode === "discover_external") {
    return { label: "Provider unavailable", disabled: true }
  }
  if (input.state === "no_likely_matches") {
    return { label: "No likely matches", disabled: true }
  }
  if (input.discovery_mode === "discover_external") {
    if (!input.provider_readiness.external_discovery_available) {
      return { label: "Provider unavailable", disabled: true }
    }
    if (input.exact_count != null && input.exact_count > 0 && input.confidence !== "low") {
      const ranged = floorEstimateToRange(input.exact_count)
      if (input.confidence === "high") {
        return { label: `Search ${input.exact_count.toLocaleString()} companies`, disabled: false }
      }
      if (ranged.floor >= 1000) {
        return { label: "Search estimated 1k+ companies", disabled: false }
      }
      return { label: `Search estimated ${ranged.label.replace("~", "")} companies`, disabled: false }
    }
    return { label: "Search providers", disabled: false }
  }

  const count = input.exact_count ?? 0
  if (count <= 0 && input.state === "filters_too_restrictive") {
    return { label: "No likely matches", disabled: true }
  }
  if (count <= 0) {
    return { label: "No likely matches", disabled: true }
  }
  if (input.confidence === "high" && input.exact_count != null) {
    return { label: `Search ${input.exact_count.toLocaleString()} companies`, disabled: false }
  }
  const ranged = floorEstimateToRange(count)
  if (ranged.floor >= 1000) {
    return { label: "Search estimated 1k+ companies", disabled: false }
  }
  return { label: `Search estimated ${ranged.label.replace("~", "")} companies`, disabled: false }
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
