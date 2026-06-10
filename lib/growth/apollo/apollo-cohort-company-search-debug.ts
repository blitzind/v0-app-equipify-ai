/** Apollo cohort company search debug evidence — client-safe Pulse/cohort diff aid. */

import { buildApolloTierAttemptsCompactSummaries } from "@/lib/growth/apollo/apollo-search-diagnostic-evidence"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type {
  ApolloSearchTierAttemptEvidence,
  ApolloTieredPeopleSearchEvidence,
} from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export const APOLLO_COHORT_COMPANY_SEARCH_DEBUG_QA_MARKER =
  "apollo-cohort-company-search-debug-v1" as const

export type ApolloCohortCompanySearchDebug = {
  qa_marker: typeof APOLLO_COHORT_COMPANY_SEARCH_DEBUG_QA_MARKER
  company_candidate_id: string
  company_name: string
  domain: string | null
  city: string | null
  state: string | null
  website_url: string | null
  contact_limit: number | null
  search_path: string
  guardrails_before_search: Record<string, number> | null
  guardrails_after_search: Record<string, number> | null
  tier_attempts_compact: ReturnType<typeof buildApolloTierAttemptsCompactSummaries>
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  search_strategy_summary: {
    chosen_tier: number | null
    chosen_tier_name: string | null
    stop_reason: string | null
    raw_contacts_returned: number
    mapped_contacts: number
    mapped_partial_identity_contacts: number
    mapped_full_identity_contacts: number
  } | null
}

export function isApolloCohortSearchDebugTarget(company_name: string): boolean {
  const normalized = company_name.trim().toLowerCase()
  return normalized.includes("pulse biomedical")
}

export function buildApolloCohortCompanySearchDebug(input: {
  company_candidate_id: string
  company_name: string
  domain: string | null
  city?: string | null
  state?: string | null
  website_url?: string | null
  contact_limit?: number | null
  search_path: string
  guardrails_before_search?: Record<string, number> | null
  guardrails_after_search?: Record<string, number> | null
  search_strategy?: ApolloTieredPeopleSearchEvidence | null
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
}): ApolloCohortCompanySearchDebug | null {
  if (!isApolloCohortSearchDebugTarget(input.company_name)) return null

  const strategy = input.search_strategy ?? input.acquisition?.search_strategy ?? null
  const tier_attempts = strategy?.tier_attempts ?? []

  return {
    qa_marker: APOLLO_COHORT_COMPANY_SEARCH_DEBUG_QA_MARKER,
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    domain: input.domain,
    city: input.city ?? null,
    state: input.state ?? null,
    website_url: input.website_url ?? null,
    contact_limit: input.contact_limit ?? null,
    search_path: input.search_path,
    guardrails_before_search: input.guardrails_before_search ?? null,
    guardrails_after_search: input.guardrails_after_search ?? null,
    tier_attempts_compact: buildApolloTierAttemptsCompactSummaries(tier_attempts),
    tier_attempts,
    search_strategy_summary: strategy
      ? {
          chosen_tier: strategy.chosen_tier,
          chosen_tier_name: strategy.chosen_tier_name,
          stop_reason: strategy.stop_reason,
          raw_contacts_returned: strategy.raw_contacts_returned,
          mapped_contacts: strategy.mapped_contacts,
          mapped_partial_identity_contacts: strategy.mapped_partial_identity_contacts,
          mapped_full_identity_contacts: strategy.mapped_full_identity_contacts,
        }
      : null,
  }
}
