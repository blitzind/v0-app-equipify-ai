import type { GrowthRealWorldDiscoveryProvider } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"

/** SERP / search API slot — env-ready, no on-page scraping. */
export function createRealWorldSerpProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "serp",
    provider_type: "serp",
    isConfigured: () =>
      Boolean(process.env.SERP_API_KEY?.trim() || process.env.SERPAPI_API_KEY?.trim()),
    discover: async () => ({
      provider_name: "serp",
      provider_type: "serp",
      status: "skipped",
      message: "SERP slot reserved — set SERP_API_KEY when ready (no terms-violating scraping).",
      candidates: [],
    }),
  }
}
