import type { GrowthRealWorldDiscoveryProvider } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"

/** Google Places / Maps-style slot — env-ready, no scraping. */
export function createRealWorldGooglePlacesProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "google_places",
    provider_type: "google_places",
    isConfigured: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
    discover: async () => ({
      provider_name: "google_places",
      provider_type: "google_places",
      status: "skipped",
      message:
        "Google Places slot reserved — set GOOGLE_PLACES_API_KEY when ready (official API only).",
      candidates: [],
    }),
  }
}
