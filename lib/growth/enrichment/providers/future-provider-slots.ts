import type {
  GrowthEnrichmentProvider,
  GrowthEnrichmentProviderType,
} from "@/lib/growth/enrichment/enrichment-provider-types"

function skipped(
  provider_name: string,
  provider_type: GrowthEnrichmentProviderType,
): GrowthEnrichmentProvider {
  return {
    provider_name,
    provider_type,
    isConfigured: () => false,
    enrich: async () => ({
      provider_name,
      provider_type,
      status: "skipped",
      message: `${provider_type} enrichment slot reserved — no external API connected.`,
      contact_verifications: [],
      company_enrichments: [],
    }),
  }
}

export function createFutureHunterEnrichmentProvider(): GrowthEnrichmentProvider {
  return skipped("future_hunter", "future_hunter")
}

export function createFuturePeopleDataLabsEnrichmentProvider(): GrowthEnrichmentProvider {
  return skipped("future_people_data_labs", "future_people_data_labs")
}

export function createFutureClearbitEnrichmentProvider(): GrowthEnrichmentProvider {
  return skipped("future_clearbit", "future_clearbit")
}

export function createFutureClayEnrichmentProvider(): GrowthEnrichmentProvider {
  return skipped("future_clay", "future_clay")
}

export function createFutureProviderEnrichmentSlot(): GrowthEnrichmentProvider {
  return skipped("future_provider", "future_provider")
}
