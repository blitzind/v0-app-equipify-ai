import type { GrowthExternalDiscoveryProvider } from "@/lib/growth/external-discovery/external-discovery-provider-types"

/** SERP provider slot — env-ready, not required for v1. */
export function createSerpExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return {
    provider_name: "serp",
    provider_type: "serp",
    isConfigured: () =>
      Boolean(process.env.SERP_API_KEY?.trim() || process.env.SERPAPI_API_KEY?.trim()),
    discover: async () => ({
      provider_name: "serp",
      provider_type: "serp",
      status: "skipped",
      message: "SERP provider slot reserved — set SERP_API_KEY when ready (no on-page scraping).",
      candidates: [],
    }),
  }
}
