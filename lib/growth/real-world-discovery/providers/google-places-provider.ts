import "server-only"

import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import { searchGooglePlacesText } from "@/lib/growth/real-world-discovery/providers/google-places-client"
import { mapGooglePlaceToCandidate } from "@/lib/growth/real-world-discovery/providers/google-places-mapper"
import { buildGooglePlacesDiscoveryQuery } from "@/lib/growth/real-world-discovery/providers/google-places-query-builder"

/** Google Places Text Search — official API only, no scraping. */
export function createRealWorldGooglePlacesProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "google_places",
    provider_type: "google_places",
    isConfigured: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const textQuery = buildGooglePlacesDiscoveryQuery(input)
      const limit = input.limit ?? 20

      try {
        const places = await searchGooglePlacesText(textQuery, { limit })
        const candidates = places
          .map((place, index) =>
            mapGooglePlaceToCandidate(place, { query: textQuery, source_rank: index + 1 }),
          )
          .filter((row): row is NonNullable<typeof row> => row !== null)

        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "success",
          message: candidates.length
            ? `${candidates.length} listing(s) from Google Places.`
            : `Google Places returned no matches for "${textQuery}".`,
          candidates,
        }
      } catch (err) {
        return {
          provider_name: "google_places",
          provider_type: "google_places",
          status: "failed",
          message: err instanceof Error ? err.message : "Google Places request failed.",
          candidates: [],
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}
