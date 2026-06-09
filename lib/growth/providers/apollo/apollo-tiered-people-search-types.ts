/** Apollo tiered people search evidence types — client-safe. */

import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import type { ApolloPersonSearchResult } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER = "apollo-tiered-people-search-v1" as const

export type ApolloSearchTierUsed = ApolloSearchTier | 4

export type ApolloSearchTierAttemptEvidence = {
  tier: ApolloSearchTier
  request_payload: Record<string, unknown>
  company_domain: string | null
  company_name: string
  person_titles: readonly string[]
  person_seniorities: readonly string[]
  domain_exact_only: boolean
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  apollo_status: ApolloPersonSearchResult["status"]
  apollo_message: string | null
}

export type ApolloTieredPeopleSearchEvidence = {
  qa_marker: typeof APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER
  tier_used: ApolloSearchTierUsed
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  legacy_fallback_used: boolean
  legacy_contactable_count: number
}

export function emptyApolloTieredPeopleSearchEvidence(): ApolloTieredPeopleSearchEvidence {
  return {
    qa_marker: APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER,
    tier_used: 1,
    tier_attempts: [],
    raw_contacts_returned: 0,
    mapped_contacts: 0,
    mapping_rejections: 0,
    rejection_reasons: {},
    legacy_fallback_used: false,
    legacy_contactable_count: 0,
  }
}
