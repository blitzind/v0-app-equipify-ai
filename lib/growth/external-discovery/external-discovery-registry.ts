import "server-only"

import type {
  GrowthExternalDiscoveryProvider,
  GrowthExternalDiscoveryProviderResult,
  GrowthExternalDiscoveryProviderType,
  GrowthExternalDiscoveryQuery,
} from "@/lib/growth/external-discovery/external-discovery-provider-types"
import {
  createFutureApolloExternalDiscoveryProvider,
  createFutureClayExternalDiscoveryProvider,
  createFuturePeopleDataLabsExternalDiscoveryProvider,
  createFutureSeamlessExternalDiscoveryProvider,
} from "@/lib/growth/external-discovery/providers/future-provider-slots"
import { createGooglePlacesExternalDiscoveryProvider } from "@/lib/growth/external-discovery/providers/google-places-provider"
import { createManualImportExternalDiscoveryProvider } from "@/lib/growth/external-discovery/providers/manual-import-provider"
import { createSerpExternalDiscoveryProvider } from "@/lib/growth/external-discovery/providers/serp-provider"

export function listExternalDiscoveryProviders(): GrowthExternalDiscoveryProvider[] {
  return [
    createManualImportExternalDiscoveryProvider(),
    createGooglePlacesExternalDiscoveryProvider(),
    createSerpExternalDiscoveryProvider(),
    createFutureApolloExternalDiscoveryProvider(),
    createFutureSeamlessExternalDiscoveryProvider(),
    createFutureClayExternalDiscoveryProvider(),
    createFuturePeopleDataLabsExternalDiscoveryProvider(),
  ]
}

export function getExternalDiscoveryProvider(
  providerType: GrowthExternalDiscoveryProviderType,
): GrowthExternalDiscoveryProvider | null {
  return (
    listExternalDiscoveryProviders().find((p) => p.provider_type === providerType) ?? null
  )
}

/** Run configured providers; failures isolated per provider. */
export async function runExternalDiscoveryProviders(
  input: GrowthExternalDiscoveryQuery,
  options?: { provider_types?: GrowthExternalDiscoveryProviderType[] },
): Promise<GrowthExternalDiscoveryProviderResult[]> {
  const all = listExternalDiscoveryProviders()
  const requested = options?.provider_types?.length
    ? all.filter((p) => options.provider_types!.includes(p.provider_type))
    : all

  const results: GrowthExternalDiscoveryProviderResult[] = []

  for (const provider of requested) {
    if (!provider.isConfigured() && provider.provider_type !== "manual_import") {
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
      const result = await provider.discover(input)
      results.push(result)
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
