/** Default provider chain for operator-triggered contact discovery. Client-safe. */

import type { GrowthContactDiscoveryProviderType } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

/** Internal sources first, public website second, PDL augmentation third. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  "internal_growth",
  "website_public_extract",
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]

/** PDL-only augmentation chain — used after internal overlay during people-first search. */
export const PDL_CONTACT_ACQUISITION_PROVIDER_TYPES = [
  "future_people_data_labs",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]
