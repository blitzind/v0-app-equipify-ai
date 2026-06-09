/** Default provider chain for operator-triggered contact discovery. Client-safe. */

import type { GrowthContactDiscoveryProviderType } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import {
  isApolloPrimaryContactAcquisitionEnabled,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import {
  isApolloApiConfigured,
  isApolloMockEnabled,
  isApolloProviderConfigured,
} from "@/lib/growth/providers/apollo/apollo-config"

function isApolloChainAvailable(env: NodeJS.ProcessEnv): boolean {
  return isApolloApiConfigured(env) || isApolloMockEnabled(env) || isApolloProviderConfigured(env)
}

/** Internal sources first, public website second, PDL augmentation third. Apollo is opt-in. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE = [
  "internal_growth",
  "website_public_extract",
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** Apollo-Primary-1 — internal first, Apollo as primary external source, then website/PDL. */
export const APOLLO_PRIMARY_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  "internal_growth",
  "future_apollo",
  "website_public_extract",
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** @deprecated Use resolveOperatorContactDiscoveryProviderTypes() for Apollo-aware chain. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  ...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE,
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** Operator chain including Apollo when enabled + configured (or mock). */
export function resolveOperatorContactDiscoveryProviderTypes(
  env: NodeJS.ProcessEnv = process.env,
): GrowthContactDiscoveryProviderType[] {
  const apolloConfigured = isApolloChainAvailable(env)
  const primaryEnabled = isApolloPrimaryContactAcquisitionEnabled(env)

  if (primaryEnabled && apolloConfigured) {
    return [...APOLLO_PRIMARY_CONTACT_DISCOVERY_PROVIDER_TYPES]
  }

  const types: GrowthContactDiscoveryProviderType[] = [
    ...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES_BASE,
  ]
  if (apolloConfigured) {
    types.push("future_apollo")
  }
  return types
}

/** PDL-only augmentation chain — used after internal overlay during people-first search. */
export const PDL_CONTACT_ACQUISITION_PROVIDER_TYPES = [
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]
