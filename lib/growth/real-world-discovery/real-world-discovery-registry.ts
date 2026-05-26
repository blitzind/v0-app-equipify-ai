import "server-only"

import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderResult,
  GrowthRealWorldDiscoveryProviderType,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import { GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type {
  GrowthRealWorldProviderStatusLabel,
  GrowthRealWorldProviderStatusSummary,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import { createRealWorldBusinessDirectoryProvider } from "@/lib/growth/real-world-discovery/providers/business-directory-provider"
import { createRealWorldFixtureProvider } from "@/lib/growth/real-world-discovery/providers/fixture-provider"
import { createRealWorldGooglePlacesProvider } from "@/lib/growth/real-world-discovery/providers/google-places-provider"
import { createRealWorldManualImportProvider } from "@/lib/growth/real-world-discovery/providers/manual-import-provider"
import { createRealWorldSerpProvider } from "@/lib/growth/real-world-discovery/providers/serp-provider"

export function listRealWorldDiscoveryProviders(): GrowthRealWorldDiscoveryProvider[] {
  return [
    createRealWorldGooglePlacesProvider(),
    createRealWorldSerpProvider(),
    createRealWorldBusinessDirectoryProvider(),
    createRealWorldManualImportProvider(),
    createRealWorldFixtureProvider(),
  ]
}

export function getRealWorldDiscoveryProvider(
  providerType: GrowthRealWorldDiscoveryProviderType,
): GrowthRealWorldDiscoveryProvider | null {
  return listRealWorldDiscoveryProviders().find((p) => p.provider_type === providerType) ?? null
}

function anyLiveProviderConfigured(): boolean {
  return listRealWorldDiscoveryProviders()
    .filter((p) => GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(p.provider_type as never))
    .some((p) => p.isConfigured())
}

export function summarizeRealWorldProviderStatus(
  results: GrowthRealWorldDiscoveryProviderResult[],
): GrowthRealWorldProviderStatusSummary {
  const liveConfigured = anyLiveProviderConfigured()
  const liveActive = results.some(
    (r) =>
      GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(r.provider_type as never) &&
      r.status === "success" &&
      r.candidates.length > 0,
  )
  const fixtureActive = results.some(
    (r) => r.provider_type === "fixture" && r.status === "success" && r.candidates.length > 0,
  )
  const live_providers = results
    .filter(
      (r) =>
        GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(r.provider_type as never) &&
        r.status === "success",
    )
    .map((r) => r.provider_name)

  let label: GrowthRealWorldProviderStatusLabel = "no_provider_configured"
  let message = "No live provider configured — enable API keys or use fixture fallback."

  if (liveActive) {
    label = "live_provider_active"
    message = `Live provider active: ${live_providers.join(", ") || "configured"}.`
  } else if (fixtureActive) {
    label = "fixture_fallback_active"
    message = "Fixture fallback active — no live public-source API configured."
  } else if (liveConfigured) {
    label = "live_provider_active"
    message = "Live provider configured but returned no matches for this query."
  }

  return {
    label,
    message,
    live_providers,
    fixture_active: fixtureActive,
  }
}

/** Run providers; failures isolated. Fixture only when no live provider is configured. */
export async function runRealWorldDiscoveryProviders(
  input: GrowthRealWorldDiscoveryQuery,
): Promise<GrowthRealWorldDiscoveryProviderResult[]> {
  const all = listRealWorldDiscoveryProviders()
  const useFixtureFallback = !anyLiveProviderConfigured()

  const toRun = all.filter((p) => {
    if (p.provider_type === "fixture") return useFixtureFallback
    return GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(p.provider_type as never)
  })

  const results: GrowthRealWorldDiscoveryProviderResult[] = []

  for (const provider of toRun) {
    if (!provider.isConfigured() && provider.provider_type !== "fixture") {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "skipped",
        message: `${provider.provider_name} not configured.`,
        candidates: [],
      })
      continue
    }

    try {
      results.push(await provider.discover(input))
    } catch (err) {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "failed",
        message: err instanceof Error ? err.message : "Provider failed.",
        candidates: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}
