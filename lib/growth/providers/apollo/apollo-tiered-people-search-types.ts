/** Apollo tiered people search evidence types — client-safe. */

import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import type { ApolloPersonSearchResult } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER = "apollo-tiered-people-search-v2" as const

export type ApolloSearchTierStopReason =
  | "mapped_contacts_found"
  | "exhausted_all_tiers"
  | "search_api_budget_exhausted"
  | "mock_single_tier"
  | "tier_skipped"

/** Winning search tier (1–5). Legacy fallback is tracked separately. */
export type ApolloSearchTierUsed = ApolloSearchTier | null

export type ApolloMapperRejectionPersonSample = {
  name: string | null
  title: string | null
  organization_name: string | null
  organization_domain: string | null
  city: string | null
  state: string | null
  linkedin_url: string | null
  email_status: string | null
  accepted: boolean
  rejection_reason: string | null
}

export type ApolloSearchTierAttemptEvidence = {
  tier: ApolloSearchTier
  tier_name: string
  request_payload: Record<string, unknown>
  request_payload_summary: string
  company_domain: string | null
  company_name: string
  organization_location: string | null
  person_titles: readonly string[]
  person_seniorities: readonly string[]
  domain_exact_only: boolean
  title_filter_applied: boolean
  raw_contacts_returned: number
  mapped_contacts: number
  mapped_partial_identity_contacts?: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  mapper_rejection_samples: ApolloMapperRejectionPersonSample[]
  apollo_status: ApolloPersonSearchResult["status"]
  apollo_message: string | null
  skipped_reason: string | null
}

export type ApolloTieredPeopleSearchEvidence = {
  qa_marker: typeof APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER
  tier_used: ApolloSearchTierUsed
  chosen_tier: ApolloSearchTier | null
  chosen_tier_name: string | null
  last_attempted_tier: ApolloSearchTier | null
  last_attempted_tier_name: string | null
  stop_reason: ApolloSearchTierStopReason | null
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  legacy_fallback_used: boolean
  legacy_contactable_count: number
  mapped_partial_identity_contacts: number
  mapped_full_identity_contacts: number
}

export function emptyApolloTieredPeopleSearchEvidence(): ApolloTieredPeopleSearchEvidence {
  return {
    qa_marker: APOLLO_TIERED_PEOPLE_SEARCH_QA_MARKER,
    tier_used: null,
    chosen_tier: null,
    chosen_tier_name: null,
    last_attempted_tier: null,
    last_attempted_tier_name: null,
    stop_reason: null,
    tier_attempts: [],
    raw_contacts_returned: 0,
    mapped_contacts: 0,
    mapping_rejections: 0,
    rejection_reasons: {},
    legacy_fallback_used: false,
    legacy_contactable_count: 0,
    mapped_partial_identity_contacts: 0,
    mapped_full_identity_contacts: 0,
  }
}
