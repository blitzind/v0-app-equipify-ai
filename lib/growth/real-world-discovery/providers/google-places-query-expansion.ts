/** Growth Engine — Google Places multi-query ICP expansion (v2). */

import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import {
  buildLiveProviderDiscoveryQueries,
  GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER,
  liveProviderIcpInputs,
  LIVE_PROVIDER_QUERY_MAX,
  LIVE_PROVIDER_QUERY_MIN,
} from "@/lib/growth/real-world-discovery/live-provider-query-expansion"

export const GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER =
  "growth-google-places-query-expansion-v2" as const

export { GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER }

export const GOOGLE_PLACES_QUERY_MIN = LIVE_PROVIDER_QUERY_MIN
export const GOOGLE_PLACES_QUERY_MAX = LIVE_PROVIDER_QUERY_MAX

export type GooglePlacesQueryExpansionResult = {
  queries: string[]
  primary_query: string
  fallback_queries?: string[]
}

/** ICP facets used for Google Places — excludes intent, technology, and title targeting. */
export function googlePlacesIcpInputs(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): GrowthRealWorldDiscoverySearchInputs {
  return liveProviderIcpInputs(inputs)
}

/**
 * Generate 3–8 Google Places queries from ICP facets with industry synonym expansion.
 * Location is appended when present. Blank location searches broadly (no geo suffix).
 */
export function buildGooglePlacesDiscoveryQueries(
  inputs: GrowthRealWorldDiscoverySearchInputs,
  options?: { min?: number; max?: number },
): GooglePlacesQueryExpansionResult {
  const plan = buildLiveProviderDiscoveryQueries(inputs, options)
  return {
    queries: plan.queries,
    primary_query: plan.primary_query,
    fallback_queries: plan.fallback_queries,
  }
}

/** Back-compat single query helper — returns primary expanded query. */
export function buildGooglePlacesDiscoveryQuery(
  inputs: GrowthRealWorldDiscoverySearchInputs,
): string {
  return buildGooglePlacesDiscoveryQueries(inputs).primary_query
}

export function computeGooglePlacesIcpFitScore(
  candidate: {
    company_name: string
    category?: string | null
    description?: string | null
    industry?: string | null
    city?: string | null
    state?: string | null
    location?: string | null
    address?: string | null
  },
  inputs: GrowthRealWorldDiscoverySearchInputs,
  matchedQueries: string[],
): number {
  const icp = googlePlacesIcpInputs(inputs)
  const industryHint = cleanPart(icp.subindustry) || cleanPart(icp.industry)
  const locationHint = cleanPart(icp.location)
  const blob = [
    candidate.company_name,
    candidate.category,
    candidate.description,
    candidate.industry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const locBlob = [candidate.city, candidate.state, candidate.location, candidate.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  let score = 0.3

  if (industryHint) {
    const tokens = industryHint
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
    const hits = tokens.filter((t) => blob.includes(t)).length
    score += (hits / Math.max(tokens.length, 1)) * 0.35
  }

  if (locationHint) {
    const locLower = locationHint.toLowerCase()
    if (locBlob.includes(locLower)) {
      score += 0.25
    } else {
      const locTokens = locLower.split(/\s+/).filter(Boolean)
      const locHits = locTokens.filter((t) => locBlob.includes(t)).length
      score += (locHits / Math.max(locTokens.length, 1)) * 0.2
    }
  }

  for (const kw of (icp.keywords ?? []).slice(0, 3)) {
    if (blob.includes(kw.toLowerCase())) score += 0.04
  }

  for (const q of matchedQueries.slice(0, 3)) {
    score += textOverlapScore(q, blob) * 0.05
  }

  score += Math.min(0.08, matchedQueries.length * 0.015)

  return Math.min(0.99, Number(score.toFixed(4)))
}

function cleanPart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function textOverlapScore(a: string, b: string): number {
  const tokens = a
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (!tokens.length) return 0
  const hits = tokens.filter((t) => b.includes(t)).length
  return hits / tokens.length
}
