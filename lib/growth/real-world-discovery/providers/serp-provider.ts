import "server-only"

import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderDiagnostics,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import { isSerpApiConfigured, searchSerpGoogleMaps } from "@/lib/growth/real-world-discovery/providers/serp-client"
import { mapSerpLocalResultToCandidate } from "@/lib/growth/real-world-discovery/providers/serp-mapper"
import { buildSerpDiscoveryQuery } from "@/lib/growth/real-world-discovery/providers/serp-query-builder"

function serpDiagnostics(
  input: Omit<GrowthRealWorldDiscoveryProviderDiagnostics, "provider_result_count"> & {
    provider_result_count: number
  },
): GrowthRealWorldDiscoveryProviderDiagnostics {
  return input
}

/** SerpAPI Google Maps — official API only, no on-page scraping. */
export function createRealWorldSerpProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "serp",
    provider_type: "serp",
    isConfigured: () => isSerpApiConfigured(),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const textQuery = buildSerpDiscoveryQuery(input)
      const limit = input.limit ?? 20
      const started = performance.now()

      try {
        const rows = await searchSerpGoogleMaps(textQuery, { limit })
        const candidates = rows
          .map((row, index) =>
            mapSerpLocalResultToCandidate(row, { query: textQuery, source_rank: index + 1 }),
          )
          .filter((row): row is NonNullable<typeof row> => row !== null)

        return {
          provider_name: "serp",
          provider_type: "serp",
          status: "success",
          message: candidates.length
            ? `${candidates.length} listing(s) from SerpAPI Google Maps.`
            : `SerpAPI returned no matches for "${textQuery}".`,
          candidates,
          diagnostics: serpDiagnostics({
            provider_executed: true,
            provider_latency_ms: Math.round(performance.now() - started),
            provider_result_count: candidates.length,
            provider_fallback_reason: null,
          }),
        }
      } catch (err) {
        return {
          provider_name: "serp",
          provider_type: "serp",
          status: "failed",
          message: err instanceof Error ? err.message : "SerpAPI request failed.",
          candidates: [],
          error: err instanceof Error ? err.message : String(err),
          diagnostics: serpDiagnostics({
            provider_executed: true,
            provider_latency_ms: Math.round(performance.now() - started),
            provider_result_count: 0,
            provider_fallback_reason: err instanceof Error ? err.message : "SerpAPI request failed.",
          }),
        }
      }
    },
  }
}
