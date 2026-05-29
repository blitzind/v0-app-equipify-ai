/** Bulk acquisition query/phase helpers — client-safe (no server-only). */

import type { GrowthBulkAcquisitionPhase, GrowthBulkAcquisitionRunState } from "@/lib/growth/acquisition/acquisition-types"

export function allQueriesExhaustedForTile(state: GrowthBulkAcquisitionRunState): boolean {
  const primaryDone = state.query_index >= state.query_plan.primary.length
  if (!primaryDone) return false
  if (state.query_plan.fallback.length === 0) return true
  if (!state.use_fallback_queries) return false
  return state.query_index >= state.query_plan.primary.length + state.query_plan.fallback.length
}

export function currentAcquisitionQuery(state: GrowthBulkAcquisitionRunState): string | null {
  const combined = state.use_fallback_queries
    ? [...state.query_plan.primary, ...state.query_plan.fallback]
    : state.query_plan.primary
  return combined[state.query_index] ?? null
}

export function companyDiscoveryQueriesRemain(state: GrowthBulkAcquisitionRunState): boolean {
  if (state.discovery_exhausted) return false
  if (allQueriesExhaustedForTile(state)) return false
  if (currentAcquisitionQuery(state) !== null) return true
  if (
    !state.use_fallback_queries &&
    state.query_plan.fallback.length > 0 &&
    state.query_index >= state.query_plan.primary.length
  ) {
    return true
  }
  return false
}

/** Stay in discover_companies until primary + fallback queries are exhausted for the current tile. */
export function resolveNextPhase(state: GrowthBulkAcquisitionRunState): GrowthBulkAcquisitionPhase {
  if (state.phase !== "discover_companies") return state.phase
  if (companyDiscoveryQueriesRemain(state)) return "discover_companies"
  return "discover_contacts"
}

export function discoveryComplete(state: GrowthBulkAcquisitionRunState): boolean {
  if (state.discovery_exhausted) return true
  if (
    state.target_company_count != null &&
    state.stats.companies_discovered >= state.target_company_count
  ) {
    return true
  }
  return state.geo_tile_index >= state.geo_tiles.length && allQueriesExhaustedForTile(state)
}

/**
 * Rewind premature discover_contacts transitions (e.g. after primary-only exhaustion)
 * so partial runs can resume company discovery without creating a new run.
 */
export function repairAcquisitionRunPhase(state: GrowthBulkAcquisitionRunState): GrowthBulkAcquisitionRunState {
  if (state.phase !== "discover_contacts") return state
  if (state.discovery_exhausted) return state
  if (!companyDiscoveryQueriesRemain(state)) return state
  return { ...state, phase: "discover_companies" }
}
