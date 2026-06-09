import "server-only"

import {
  buildContactAcquisitionProviderDiagnostics,
  type GrowthContactAcquisitionProviderAdapter,
} from "@/lib/growth/contact-discovery/contact-acquisition-provider-adapter-types"
import { createApolloContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/apollo-contact-discovery-provider"

export function createApolloContactAcquisitionAdapter(): GrowthContactAcquisitionProviderAdapter {
  const base = createApolloContactDiscoveryProvider()
  return {
    ...base,
    vendor: "apollo",
    buildDiagnostics(result, input) {
      return buildContactAcquisitionProviderDiagnostics(base, result, input)
    },
  }
}
