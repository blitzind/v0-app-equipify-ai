/** Default provider chain for operator-triggered contact discovery. Client-safe. */

import type { GrowthContactDiscoveryProviderType } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

/** Providers run when an operator clicks Find contacts — no paid APIs, no fixture role slots. */
export const OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  "internal_growth",
  "website_public_extract",
] as const satisfies readonly GrowthContactDiscoveryProviderType[]
