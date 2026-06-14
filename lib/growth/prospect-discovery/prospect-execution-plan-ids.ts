/** Deterministic plan id helpers (client-safe). */

import type { ProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

function simpleDeterministicHash(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(4).slice(0, 32)
}

export function deriveSearchPlanId(searchPlan: ProspectSearchPlan): string {
  const payload = JSON.stringify({
    query: searchPlan.normalized_intent.raw_query,
    filters: searchPlan.normalized_intent.prospect_search_filters,
    providers: searchPlan.discovery_providers,
  })
  return simpleDeterministicHash(payload)
}

export function deriveExecutionPlanId(searchPlanId: string): string {
  return simpleDeterministicHash(`execution:${searchPlanId}`)
}
