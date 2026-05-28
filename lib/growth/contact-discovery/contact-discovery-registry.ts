import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderResult,
  GrowthContactDiscoveryProviderType,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { createInternalGrowthContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/internal-growth-provider"
import { createManualFixtureContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/manual-fixture-provider"
import { createWebsitePublicExtractContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/website-public-extract-provider"
import { createPeopleDataLabsContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/people-data-labs-provider"
import {
  createFutureApolloContactProvider,
  createFutureClayContactProvider,
  createFutureProviderContactSlot,
  createFutureSeamlessContactProvider,
} from "@/lib/growth/contact-discovery/providers/future-provider-slots"

export function listContactDiscoveryProviders(
  admin: SupabaseClient,
): GrowthContactDiscoveryProvider[] {
  return [
    createManualFixtureContactDiscoveryProvider(),
    createInternalGrowthContactDiscoveryProvider(admin),
    createWebsitePublicExtractContactDiscoveryProvider(admin),
    createPeopleDataLabsContactDiscoveryProvider(admin),
    createFutureApolloContactProvider(),
    createFutureSeamlessContactProvider(),
    createFutureClayContactProvider(),
    createFutureProviderContactSlot(),
  ]
}

export async function runContactDiscoveryProviders(
  admin: SupabaseClient,
  input: GrowthContactDiscoveryProviderQuery,
  options?: { provider_types?: GrowthContactDiscoveryProviderType[] },
): Promise<GrowthContactDiscoveryProviderResult[]> {
  const all = listContactDiscoveryProviders(admin)
  const requested = options?.provider_types?.length
    ? all.filter((p) => options.provider_types!.includes(p.provider_type))
    : all

  const results: GrowthContactDiscoveryProviderResult[] = []

  for (const provider of requested) {
    if (!provider.isConfigured() && provider.provider_type !== "manual_fixture") {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "skipped",
        message: `${provider.provider_name} not configured.`,
        contacts: [],
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
        contacts: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}
