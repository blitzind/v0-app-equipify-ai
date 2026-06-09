/** Apollo tiered people search orchestration — server-only. */

import "server-only"

import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  buildApolloPeopleSearchParamsForTier,
  type ApolloSearchTier,
} from "@/lib/growth/providers/apollo/apollo-query-builder"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonSearchInput, ApolloPersonSearchResult } from "@/lib/growth/providers/apollo/apollo-types"
import {
  emptyApolloTieredPeopleSearchEvidence,
  type ApolloSearchTierAttemptEvidence,
  type ApolloTieredPeopleSearchEvidence,
} from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export type {
  ApolloSearchTierAttemptEvidence,
  ApolloTieredPeopleSearchEvidence,
} from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
export { emptyApolloTieredPeopleSearchEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export type ApolloTieredPeopleSearchOutcome = ApolloPersonSearchResult & {
  mapped_contacts: ReturnType<typeof mapApolloPeopleToContactDiscoveryRaw>["contacts"]
  search_strategy: ApolloTieredPeopleSearchEvidence
}

function mergeRejectionReasons(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [reason, count] of Object.entries(source)) {
    target[reason] = (target[reason] ?? 0) + count
  }
}

export async function searchApolloPeopleWithTierStrategy(
  input: ApolloPersonSearchInput,
  options?: {
    apiKey?: string
    mock?: boolean
    legacy_contactable_count?: number
  },
): Promise<ApolloTieredPeopleSearchOutcome> {
  const mock = options?.mock ?? isApolloMockEnabled()
  const tier_attempts: ApolloSearchTierAttemptEvidence[] = []
  const rejection_reasons: Record<string, number> = {}
  let bestSearch: ApolloPersonSearchResult | null = null
  let bestMapped = mapApolloPeopleToContactDiscoveryRaw({
    people: [],
    company_name: input.company_name,
    domain: input.domain,
    mock,
  })
  let tier_used: ApolloTieredPeopleSearchEvidence["tier_used"] = 1
  let raw_contacts_returned = 0
  let winningPeople = bestMapped.contacts.length > 0 ? [] : bestSearch?.people ?? []

  for (const tier of [1, 2, 3] as ApolloSearchTier[]) {
    const built = buildApolloPeopleSearchParamsForTier(input, tier)
    if (tier === 2 && !built.company_name) continue

    const search = await searchApolloPeopleByCompany(input, {
      apiKey: options?.apiKey,
      mock,
      tier,
    })

    const mapped = mapApolloPeopleToContactDiscoveryRaw({
      people: search.people,
      company_name: input.company_name,
      domain: built.domain,
      mock: search.mock,
    })

    tier_attempts.push({
      tier,
      request_payload: built.request_payload,
      company_domain: built.domain,
      company_name: built.company_name,
      person_titles: built.person_titles,
      person_seniorities: built.person_seniorities,
      domain_exact_only: built.domain_exact_only,
      raw_contacts_returned: search.people.length,
      mapped_contacts: mapped.diagnostics.contacts_mapped,
      mapping_rejections: mapped.diagnostics.contacts_skipped,
      rejection_reasons: mapped.diagnostics.skip_reasons,
      apollo_status: search.status,
      apollo_message: search.message,
    })
    mergeRejectionReasons(rejection_reasons, mapped.diagnostics.skip_reasons)

    if (!bestSearch || search.people.length >= (bestSearch.people.length ?? 0)) {
      bestSearch = search
      raw_contacts_returned = Math.max(raw_contacts_returned, search.people.length)
    }

    if (mapped.diagnostics.contacts_mapped > bestMapped.diagnostics.contacts_mapped) {
      bestMapped = mapped
      tier_used = tier
      winningPeople = search.people
    }

    if (mapped.diagnostics.contacts_mapped > 0) {
      tier_used = tier
      break
    }

    if (mock) break
  }

  const legacy_contactable_count = options?.legacy_contactable_count ?? 0
  let legacy_fallback_used = false
  if (bestMapped.diagnostics.contacts_mapped === 0 && legacy_contactable_count > 0) {
    tier_used = 4
    legacy_fallback_used = true
  }

  if (!bestSearch) {
    bestSearch = {
      qa_marker: "growth-apollo-provider-v1" as const,
      status: "skipped",
      message: "Apollo tiered search produced no attempts.",
      people: [],
      total: 0,
      mock,
      diagnostics: {
        qa_marker: "growth-apollo-provider-v1" as const,
        endpoint: "",
        search_input: {
          company_name: input.company_name,
          domain: input.domain,
          person_titles: [],
          person_seniorities: [],
          per_page: input.limit ?? 10,
        },
        result_count: 0,
        contacts_mapped: 0,
        contacts_skipped: 0,
        skip_reasons: {},
        api_error_category: "none",
        rate_limit_remaining: null,
        credits_consumed_estimate: null,
        enrich_endpoint: null,
        enrich_batch_count: 0,
        mock,
        latency_ms: null,
      },
    }
  }

  const search_strategy: ApolloTieredPeopleSearchEvidence = {
    ...emptyApolloTieredPeopleSearchEvidence(),
    tier_used,
    tier_attempts,
    raw_contacts_returned,
    mapped_contacts: bestMapped.diagnostics.contacts_mapped,
    mapping_rejections: bestMapped.diagnostics.contacts_skipped,
    rejection_reasons,
    legacy_fallback_used,
    legacy_contactable_count,
  }

  return {
    ...bestSearch,
    people: winningPeople,
    mapped_contacts: bestMapped.contacts,
    search_strategy,
  }
}
