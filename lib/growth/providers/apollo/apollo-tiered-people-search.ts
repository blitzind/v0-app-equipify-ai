/** Apollo tiered people search orchestration — server-only. */

import "server-only"

import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  APOLLO_SEARCH_TIER_NAMES,
  buildApolloPeopleSearchParamsForTier,
  shouldSkipApolloSearchTier,
  type ApolloSearchTier,
} from "@/lib/growth/providers/apollo/apollo-query-builder"
import { classifyApolloRunGuardrailMessage } from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { resolveApolloTierMappingPolicy } from "@/lib/growth/providers/apollo/apollo-tier-mapping-policy"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonSearchInput, ApolloPersonSearchResult } from "@/lib/growth/providers/apollo/apollo-types"
import {
  emptyApolloTieredPeopleSearchEvidence,
  type ApolloSearchTierAttemptEvidence,
  type ApolloSearchTierStopReason,
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

const APOLLO_SEARCH_TIERS: ApolloSearchTier[] = [1, 2, 3, 4, 5]

function mergeRejectionReasons(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [reason, count] of Object.entries(source)) {
    target[reason] = (target[reason] ?? 0) + count
  }
}

function resolveLastAttemptedTier(
  tier_attempts: ApolloSearchTierAttemptEvidence[],
): { tier: ApolloSearchTier; tier_name: string } | null {
  for (let index = tier_attempts.length - 1; index >= 0; index -= 1) {
    const attempt = tier_attempts[index]!
    if (attempt.skipped_reason?.startsWith("skipped:")) continue
    return { tier: attempt.tier, tier_name: attempt.tier_name }
  }
  return null
}

function isSearchGuardrailSkip(message: string | null): boolean {
  if (!message) return false
  return classifyApolloRunGuardrailMessage(message) != null
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
    city: input.city,
    state: input.state,
  })
  let tier_used: ApolloTieredPeopleSearchEvidence["tier_used"] = null
  let raw_contacts_returned = 0
  let winningPeople = bestSearch?.people ?? []
  let stop_reason: ApolloSearchTierStopReason | null = null

  for (const tier of APOLLO_SEARCH_TIERS) {
    const skipReason = shouldSkipApolloSearchTier(tier, input)
    if (skipReason) {
      tier_attempts.push({
        tier,
        tier_name: APOLLO_SEARCH_TIER_NAMES[tier],
        request_payload: {},
        request_payload_summary: `skipped:${skipReason}`,
        company_domain: input.domain,
        company_name: input.company_name.trim(),
        organization_location: null,
        person_titles: [],
        person_seniorities: [],
        domain_exact_only: false,
        title_filter_applied: false,
        raw_contacts_returned: 0,
        mapped_contacts: 0,
        mapping_rejections: 0,
        rejection_reasons: {},
        apollo_status: "skipped",
        apollo_message: skipReason,
        skipped_reason: `skipped:${skipReason}`,
      })
      continue
    }

    const built = buildApolloPeopleSearchParamsForTier(input, tier)
    const mappingPolicy = resolveApolloTierMappingPolicy(tier, {
      domain: built.domain,
      state: input.state ?? null,
    })

    const search = await searchApolloPeopleByCompany(input, {
      apiKey: options?.apiKey,
      mock,
      tier,
    })

    if (search.status === "skipped" && isSearchGuardrailSkip(search.message)) {
      tier_attempts.push({
        tier,
        tier_name: built.tier_name,
        request_payload: built.request_payload,
        request_payload_summary: built.summary,
        company_domain: built.domain,
        company_name: built.company_name,
        organization_location: built.organization_location,
        person_titles: built.person_titles,
        person_seniorities: built.person_seniorities,
        domain_exact_only: built.domain_exact_only,
        title_filter_applied: built.title_filter_applied,
        raw_contacts_returned: 0,
        mapped_contacts: 0,
        mapping_rejections: 0,
        rejection_reasons: {},
        apollo_status: search.status,
        apollo_message: search.message,
        skipped_reason: search.message,
      })
      stop_reason = "search_api_budget_exhausted"
      break
    }

    const mapped = mapApolloPeopleToContactDiscoveryRaw({
      people: search.people,
      company_name: input.company_name,
      domain: built.domain,
      mock: search.mock,
      city: input.city,
      state: input.state,
      search_tier: tier,
      mapping_policy: mappingPolicy,
    })

    tier_attempts.push({
      tier,
      tier_name: built.tier_name,
      request_payload: built.request_payload,
      request_payload_summary: built.summary,
      company_domain: built.domain,
      company_name: built.company_name,
      organization_location: built.organization_location,
      person_titles: built.person_titles,
      person_seniorities: built.person_seniorities,
      domain_exact_only: built.domain_exact_only,
      title_filter_applied: built.title_filter_applied,
      raw_contacts_returned: search.people.length,
      mapped_contacts: mapped.diagnostics.contacts_mapped,
      mapping_rejections: mapped.diagnostics.contacts_skipped,
      rejection_reasons: mapped.diagnostics.skip_reasons,
      apollo_status: search.status,
      apollo_message: search.message,
      skipped_reason: null,
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
      stop_reason = "mapped_contacts_found"
      break
    }

    if (mock) {
      stop_reason = "mock_single_tier"
      break
    }
  }

  if (!stop_reason) {
    stop_reason = "exhausted_all_tiers"
  }

  const lastAttempted = resolveLastAttemptedTier(tier_attempts)
  const chosen_tier = tier_used ?? lastAttempted?.tier ?? null
  const chosen_tier_name =
    (chosen_tier ? APOLLO_SEARCH_TIER_NAMES[chosen_tier] : null) ??
    lastAttempted?.tier_name ??
    null

  const legacy_contactable_count = options?.legacy_contactable_count ?? 0
  let legacy_fallback_used = false
  if (bestMapped.diagnostics.contacts_mapped === 0 && legacy_contactable_count > 0) {
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
    chosen_tier,
    chosen_tier_name,
    last_attempted_tier: lastAttempted?.tier ?? null,
    last_attempted_tier_name: lastAttempted?.tier_name ?? null,
    stop_reason,
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
