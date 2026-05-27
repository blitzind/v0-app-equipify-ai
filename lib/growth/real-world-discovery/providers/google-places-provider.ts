import "server-only"

import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderDiagnostics,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import { searchGooglePlacesText } from "@/lib/growth/real-world-discovery/providers/google-places-client"
import { mapGooglePlaceToCandidate } from "@/lib/growth/real-world-discovery/providers/google-places-mapper"
import { mergeGooglePlacesCandidates } from "@/lib/growth/real-world-discovery/providers/google-places-merge"
import {
  buildGooglePlacesDiscoveryQueries,
  googlePlacesIcpInputs,
} from "@/lib/growth/real-world-discovery/providers/google-places-query-expansion"

function placesDiagnostics(
  input: GrowthRealWorldDiscoveryProviderDiagnostics,
): GrowthRealWorldDiscoveryProviderDiagnostics {
  return input
}

/** Google Places Text Search — official API only, multi-query ICP expansion. */
export function createRealWorldGooglePlacesProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "google_places",
    provider_type: "google_places",
    isConfigured: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const icp = googlePlacesIcpInputs(input)
      const expansion = buildGooglePlacesDiscoveryQueries(icp)
      const queries = expansion.queries
      const totalLimit = input.limit ?? 50
      const perQueryLimit = Math.min(20, Math.max(5, Math.ceil(totalLimit / Math.max(queries.length, 1))))
      const started = performance.now()
      const queryResultCounts: number[] = []
      const collected: ReturnType<typeof mapGooglePlaceToCandidate>[] = []

      try {
        for (const textQuery of queries) {
          const places = await searchGooglePlacesText(textQuery, { limit: perQueryLimit })
          queryResultCounts.push(places.length)

          for (const [index, place] of places.entries()) {
            const mapped = mapGooglePlaceToCandidate(place, {
              query: textQuery,
              source_rank: index + 1,
              matched_queries: [textQuery],
            })
            if (mapped) collected.push(mapped)
          }
        }

        const merged = mergeGooglePlacesCandidates(
          collected.filter((row): row is NonNullable<typeof row> => row !== null),
          icp,
        ).slice(0, totalLimit)

        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "success",
          message: merged.length
            ? `${merged.length} merged listing(s) from Google Places across ${queries.length} queries.`
            : `Google Places returned no matches across ${queries.length} expanded queries.`,
          candidates: merged,
          diagnostics: placesDiagnostics({
            provider_executed: true,
            provider_latency_ms: Math.round(performance.now() - started),
            provider_result_count: merged.length,
            provider_fallback_reason: null,
            provider_query_generated: queries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: merged.length,
          }),
        }
      } catch (err) {
        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "failed",
          message: err instanceof Error ? err.message : "Google Places request failed.",
          candidates: [],
          error: err instanceof Error ? err.message : String(err),
          diagnostics: placesDiagnostics({
            provider_executed: true,
            provider_latency_ms: Math.round(performance.now() - started),
            provider_result_count: 0,
            provider_fallback_reason: err instanceof Error ? err.message : "Google Places request failed.",
            provider_query_generated: queries,
            provider_query_result_count: queryResultCounts,
            provider_merged_result_count: 0,
          }),
        }
      }
    },
  }
}
