import type {
  GrowthExternalDiscoveryProvider,
  GrowthExternalDiscoveryProviderType,
} from "@/lib/growth/external-discovery/external-discovery-provider-types"

function createSkippedFutureProvider(
  provider_name: string,
  provider_type: GrowthExternalDiscoveryProviderType,
): GrowthExternalDiscoveryProvider {
  return {
    provider_name,
    provider_type,
    isConfigured: () => false,
    discover: async () => ({
      provider_name,
      provider_type,
      status: "skipped",
      message: `${provider_type} provider slot reserved — no external API connected.`,
      candidates: [],
    }),
  }
}

export function createFutureApolloExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return createSkippedFutureProvider("future_apollo", "future_apollo")
}

export function createFutureSeamlessExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return createSkippedFutureProvider("future_seamless", "future_seamless")
}

export function createFutureClayExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return createSkippedFutureProvider("future_clay", "future_clay")
}

export function createFuturePeopleDataLabsExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return createSkippedFutureProvider("future_people_data_labs", "future_people_data_labs")
}
