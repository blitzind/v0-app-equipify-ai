/** Default provider chain for operator-triggered contact discovery. Client-safe. */

import type { GrowthContactDiscoveryProviderType } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { isApolloProviderConfigured } from "@/lib/growth/providers/apollo/apollo-config"

/** Internal sources first, public website second, PDL augmentation third. Apollo is opt-in. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE = [
  "internal_growth",
  "website_public_extract",
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** @deprecated Use resolveOperatorContactDiscoveryProviderTypes() for Apollo-aware chain. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  ...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE,
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** Operator chain including Apollo when enabled + configured (or mock). */
export function resolveOperatorContactDiscoveryProviderTypes(): GrowthContactDiscoveryProviderType[] {
  const types: GrowthContactDiscoveryProviderType[] = [
    ...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE,
  ]
  if (isApolloProviderConfigured()) {
    types.push("future_apollo")
  }
  return types
}

/** PDL-only augmentation chain — used after internal overlay during people-first search. */
export const PDL_CONTACT_ACQUISITION_PROVIDER_TYPES = [
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]
