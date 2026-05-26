import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthEnrichmentProvider,
  GrowthEnrichmentProviderQuery,
  GrowthEnrichmentProviderResult,
  GrowthEnrichmentProviderType,
} from "@/lib/growth/enrichment/enrichment-provider-types"
import { createInternalGrowthEnrichmentProvider } from "@/lib/growth/enrichment/providers/internal-growth-provider"
import { createManualFixtureEnrichmentProvider } from "@/lib/growth/enrichment/providers/manual-fixture-provider"
import {
  createFutureClayEnrichmentProvider,
  createFutureClearbitEnrichmentProvider,
  createFutureHunterEnrichmentProvider,
  createFuturePeopleDataLabsEnrichmentProvider,
  createFutureProviderEnrichmentSlot,
} from "@/lib/growth/enrichment/providers/future-provider-slots"

export function listEnrichmentProviders(admin: SupabaseClient): GrowthEnrichmentProvider[] {
  return [
    createManualFixtureEnrichmentProvider(),
    createInternalGrowthEnrichmentProvider(admin),
    createFutureHunterEnrichmentProvider(),
    createFuturePeopleDataLabsEnrichmentProvider(),
    createFutureClearbitEnrichmentProvider(),
    createFutureClayEnrichmentProvider(),
    createFutureProviderEnrichmentSlot(),
  ]
}

export async function runEnrichmentProviders(
  admin: SupabaseClient,
  input: GrowthEnrichmentProviderQuery,
  options?: { provider_types?: GrowthEnrichmentProviderType[] },
): Promise<GrowthEnrichmentProviderResult[]> {
  const all = listEnrichmentProviders(admin)
  const requested = options?.provider_types?.length
    ? all.filter((p) => options.provider_types!.includes(p.provider_type))
    : all

  const results: GrowthEnrichmentProviderResult[] = []
  for (const provider of requested) {
    if (!provider.isConfigured() && provider.provider_type !== "manual_fixture") {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "skipped",
        message: `${provider.provider_name} not configured.`,
        contact_verifications: [],
        company_enrichments: [],
      })
      continue
    }
    try {
      results.push(await provider.enrich(input))
    } catch (err) {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "failed",
        message: err instanceof Error ? err.message : "Provider failed.",
        contact_verifications: [],
        company_enrichments: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}
