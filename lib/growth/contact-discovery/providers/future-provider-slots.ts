import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderType,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

function skipped(
  provider_name: string,
  provider_type: GrowthContactDiscoveryProviderType,
): GrowthContactDiscoveryProvider {
  return {
    provider_name,
    provider_type,
    isConfigured: () => false,
    discover: async () => ({
      provider_name,
      provider_type,
      status: "skipped",
      message: `${provider_type} contact provider slot reserved — no external API connected.`,
      contacts: [],
    }),
  }
}

export function createFutureApolloContactProvider(): GrowthContactDiscoveryProvider {
  return skipped("future_apollo", "future_apollo")
}

export function createFutureSeamlessContactProvider(): GrowthContactDiscoveryProvider {
  return skipped("future_seamless", "future_seamless")
}

export function createFuturePeopleDataLabsContactProvider(): GrowthContactDiscoveryProvider {
  return skipped("future_people_data_labs", "future_people_data_labs")
}

export function createFutureClayContactProvider(): GrowthContactDiscoveryProvider {
  return skipped("future_clay", "future_clay")
}

export function createFutureProviderContactSlot(): GrowthContactDiscoveryProvider {
  return skipped("future_provider", "future_provider")
}
