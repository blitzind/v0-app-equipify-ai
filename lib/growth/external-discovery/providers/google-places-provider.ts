import type { GrowthExternalDiscoveryProvider } from "@/lib/growth/external-discovery/external-discovery-provider-types"

/** Google Places / Maps-style slot — env-ready, not required for v1. */
export function createGooglePlacesExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return {
    provider_name: "google_places",
    provider_type: "google_places",
    isConfigured: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    discover: async () => ({
      provider_name: "google_places",
      provider_type: "google_places",
      status: "skipped",
      message:
        "Google Places provider slot reserved — set GOOGLE_PLACES_API_KEY when ready (no scraping).",
      candidates: [],
    }),
  }
}
