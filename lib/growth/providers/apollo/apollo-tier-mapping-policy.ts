/** Apollo tier mapping policy — client-safe per-tier match strictness. */

import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"

export type ApolloTierMappingPolicy = {
  require_organization_match: boolean
  require_location_match: boolean
  match_strength: "strong" | "weak"
  max_mapped_contacts: number | null
}

export function resolveApolloTierMappingPolicy(
  tier: ApolloSearchTier,
  input: { domain: string | null; state: string | null },
): ApolloTierMappingPolicy {
  switch (tier) {
    case 1:
      return {
        require_organization_match: true,
        require_location_match: false,
        match_strength: "strong",
        max_mapped_contacts: null,
      }
    case 2:
      return {
        require_organization_match: true,
        require_location_match: !input.domain && Boolean(input.state?.trim()),
        match_strength: "strong",
        max_mapped_contacts: null,
      }
    case 3:
      return {
        require_organization_match: true,
        require_location_match: !input.domain && Boolean(input.state?.trim()),
        match_strength: "strong",
        max_mapped_contacts: null,
      }
    case 4:
      return {
        require_organization_match: true,
        require_location_match: !input.domain && Boolean(input.state?.trim()),
        match_strength: "weak",
        max_mapped_contacts: null,
      }
    case 5:
      return {
        require_organization_match: true,
        require_location_match: !input.domain && Boolean(input.state?.trim()),
        match_strength: "weak",
        max_mapped_contacts: 5,
      }
    default:
      return {
        require_organization_match: true,
        require_location_match: false,
        match_strength: "strong",
        max_mapped_contacts: null,
      }
  }
}
