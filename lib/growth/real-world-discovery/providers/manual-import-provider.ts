import type { GrowthRealWorldDiscoveryProvider } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"

/**
 * Manual import path — returns no rows until operator import pipeline is wired.
 * Distinct from fixture fallback (used only when no live provider env is set).
 */
export function createRealWorldManualImportProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "manual_import",
    provider_type: "manual_import",
    isConfigured: () => Boolean(process.env.GROWTH_REAL_WORLD_MANUAL_IMPORT_ENABLED === "1"),
    discover: async () => ({
      provider_name: "manual_import",
      provider_type: "manual_import",
      status: "skipped",
      message:
        "Manual import not enabled — set GROWTH_REAL_WORLD_MANUAL_IMPORT_ENABLED=1 when import feed is ready.",
      candidates: [],
    }),
  }
}
