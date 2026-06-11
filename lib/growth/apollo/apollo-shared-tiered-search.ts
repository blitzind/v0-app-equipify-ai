/** Shared Apollo tiered people search entry — single implementation surface. Server-only. */

import "server-only"

import { searchApolloPeopleWithTierStrategy } from "@/lib/growth/providers/apollo/apollo-tiered-people-search"
import type { ApolloTieredPeopleSearchOutcome } from "@/lib/growth/providers/apollo/apollo-tiered-people-search"
import type { ApolloPersonSearchInput } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_SHARED_TIERED_SEARCH_QA_MARKER = "apollo-shared-tiered-search-v1" as const

export type ApolloSharedTieredSearchInput = ApolloPersonSearchInput & {
  legacy_contactable_count?: number
  organization_domains?: string[]
}

export async function runApolloSharedTieredPeopleSearch(
  input: ApolloSharedTieredSearchInput,
  options?: {
    apiKey?: string
    mock?: boolean
  },
): Promise<ApolloTieredPeopleSearchOutcome> {
  return searchApolloPeopleWithTierStrategy(
    {
      company_name: input.company_name,
      domain: input.domain,
      website_url: input.website_url,
      industry: input.industry,
      city: input.city,
      state: input.state,
      limit: input.limit,
      organization_domains: input.organization_domains,
    },
    {
      apiKey: options?.apiKey,
      mock: options?.mock,
      legacy_contactable_count: input.legacy_contactable_count ?? 0,
    },
  )
}
