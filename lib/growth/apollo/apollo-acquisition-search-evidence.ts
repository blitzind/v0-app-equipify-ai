/** Apollo acquisition search evidence — audit raw vs mapped Apollo search results. Client-safe. */

import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export const APOLLO_ACQUISITION_SEARCH_EVIDENCE_QA_MARKER =
  "apollo-acquisition-search-evidence-v1" as const

export type ApolloAcquisitionSearchOutcome =
  | "success"
  | "zero_raw"
  | "mapper_rejected"
  | "search_skipped"
  | "search_failed"
  | "provider_disabled"
  | "not_attempted"

export type ApolloAcquisitionSearchEvidence = {
  qa_marker: typeof APOLLO_ACQUISITION_SEARCH_EVIDENCE_QA_MARKER
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  apollo_provider_mode: "live" | "mock" | "disabled"
  apollo_provider_ready: boolean
  apollo_provider_issue_codes: string[]
  company_name: string
  company_domain: string | null
  apollo_raw_people_count: number
  apollo_mapped_people_count: number
  apollo_persisted_this_run: number
  apollo_search_blockers: string[]
  apollo_query_summary: {
    tier_used: number | null
    tier_name?: string | null
    request_payload_summary?: string | null
    company_domain: string | null
    company_name: string
    organization_location?: string | null
    person_titles: readonly string[]
    person_seniorities: readonly string[]
    domain_exact_only: boolean
    title_filter_applied?: boolean
    request_payload: Record<string, unknown> | null
  } | null
  mapper_rejection_reasons: Record<string, number>
  search_outcome: ApolloAcquisitionSearchOutcome
  tier_used: number | null
  chosen_tier?: number | null
  chosen_tier_name?: string | null
  last_attempted_tier?: number | null
  last_attempted_tier_name?: string | null
  stop_reason?: string | null
  legacy_fallback_used: boolean
  legacy_contactable_count: number
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function pickQueryAttempt(
  tier_attempts: ApolloSearchTierAttemptEvidence[],
  tier_used: number | null,
): ApolloSearchTierAttemptEvidence | null {
  if (tier_attempts.length === 0) return null
  if (tier_used != null) {
    const match = tier_attempts.find((attempt) => attempt.tier === tier_used)
    if (match) return match
  }
  return tier_attempts[tier_attempts.length - 1] ?? null
}

export function resolveApolloAcquisitionSearchOutcome(input: {
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  apollo_raw_people_count: number
  apollo_mapped_people_count: number
  provider_ready: boolean
  search_blockers: string[]
}): ApolloAcquisitionSearchOutcome {
  if (!input.provider_ready) return "provider_disabled"
  if (!input.apollo_search_attempted) {
    return input.apollo_search_skipped_reason ? "search_skipped" : "not_attempted"
  }
  if (input.search_blockers.some((blocker) => blocker.includes("apollo_search_failed"))) {
    return "search_failed"
  }
  if (input.apollo_mapped_people_count > 0) return "success"
  if (input.apollo_raw_people_count > 0) return "mapper_rejected"
  return "zero_raw"
}

export function normalizeApolloAcquisitionSearchBlockers(input: {
  blockers: string[]
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  apollo_raw_people_count: number
  apollo_mapped_people_count: number
}): string[] {
  const blockers = [...input.blockers]

  if (!input.apollo_search_attempted) {
    if (input.apollo_search_skipped_reason) {
      const skipBlocker = `apollo_search_skipped:${input.apollo_search_skipped_reason}`
      if (!blockers.includes(skipBlocker)) blockers.push(skipBlocker)
    }
    return blockers
  }

  if (input.apollo_mapped_people_count === 0) {
    if (input.apollo_raw_people_count > 0 && !blockers.includes("apollo_mapper_rejected_all")) {
      blockers.push("apollo_mapper_rejected_all")
    }
    if (!blockers.includes("apollo_zero_contacts_mapped")) {
      blockers.push("apollo_zero_contacts_mapped")
    }
  }

  return blockers
}

export function buildApolloAcquisitionSearchEvidence(input: {
  company_name: string
  company_domain: string | null
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  apollo_persisted_this_run: number
  existing_contactable_before: number
  blockers: string[]
  search_strategy: ApolloPrimaryContactAcquisitionCompanyEvidence["search_strategy"]
  env?: NodeJS.ProcessEnv
}): {
  apollo_search_evidence: ApolloAcquisitionSearchEvidence
  apollo_mapped_people_count: number
  apollo_search_blockers: string[]
} {
  const diagnostics = diagnoseApolloContactDiscoveryConfig(input.env ?? process.env)
  const strategy = input.search_strategy
  const apollo_raw_people_count = strategy?.raw_contacts_returned ?? 0
  const apollo_mapped_people_count = strategy?.mapped_contacts ?? input.apollo_persisted_this_run ?? 0
  const tier_used = strategy?.chosen_tier ?? strategy?.tier_used ?? null
  const chosen_tier_name =
    strategy?.chosen_tier_name ??
    strategy?.last_attempted_tier_name ??
    null
  const queryAttempt = pickQueryAttempt(strategy?.tier_attempts ?? [], tier_used ?? strategy?.last_attempted_tier ?? null)
  const provider_mode = diagnostics.apollo_disabled_flag || !diagnostics.apollo_enabled
    ? "disabled"
    : diagnostics.mock_mode
      ? "mock"
      : "live"

  const apollo_search_blockers = normalizeApolloAcquisitionSearchBlockers({
    blockers: input.blockers,
    apollo_search_attempted: input.apollo_search_attempted,
    apollo_search_skipped_reason: input.apollo_search_skipped_reason,
    apollo_raw_people_count,
    apollo_mapped_people_count,
  })

  const search_outcome = resolveApolloAcquisitionSearchOutcome({
    apollo_search_attempted: input.apollo_search_attempted,
    apollo_search_skipped_reason: input.apollo_search_skipped_reason,
    apollo_raw_people_count,
    apollo_mapped_people_count,
    provider_ready: diagnostics.ready_for_live_search || diagnostics.mock_mode,
    search_blockers: apollo_search_blockers,
  })

  return {
    apollo_mapped_people_count,
    apollo_search_blockers,
    apollo_search_evidence: {
      qa_marker: APOLLO_ACQUISITION_SEARCH_EVIDENCE_QA_MARKER,
      apollo_search_attempted: input.apollo_search_attempted,
      apollo_search_skipped_reason: input.apollo_search_skipped_reason,
      apollo_provider_mode: provider_mode,
      apollo_provider_ready: diagnostics.ready_for_live_search || diagnostics.mock_mode,
      apollo_provider_issue_codes: diagnostics.issues.map((issue) => issue.code),
      company_name: input.company_name,
      company_domain: input.company_domain,
      apollo_raw_people_count,
      apollo_mapped_people_count,
      apollo_persisted_this_run: input.apollo_persisted_this_run,
      apollo_search_blockers,
      apollo_query_summary: queryAttempt
        ? {
            tier_used,
            tier_name: queryAttempt.tier_name,
            request_payload_summary: queryAttempt.request_payload_summary,
            company_domain: queryAttempt.company_domain,
            company_name: queryAttempt.company_name,
            organization_location: queryAttempt.organization_location,
            person_titles: queryAttempt.person_titles,
            person_seniorities: queryAttempt.person_seniorities,
            domain_exact_only: queryAttempt.domain_exact_only,
            title_filter_applied: queryAttempt.title_filter_applied,
            request_payload: queryAttempt.request_payload,
          }
        : input.company_domain || input.company_name
          ? {
              tier_used,
              tier_name: strategy?.chosen_tier_name ?? null,
              request_payload_summary: strategy?.stop_reason ?? null,
              company_domain: input.company_domain,
              company_name: input.company_name,
              organization_location: null,
              person_titles: [],
              person_seniorities: [],
              domain_exact_only: true,
              title_filter_applied: true,
              request_payload: null,
            }
          : null,
      mapper_rejection_reasons: strategy?.rejection_reasons ?? {},
      search_outcome,
      tier_used,
      chosen_tier: strategy?.chosen_tier ?? tier_used,
      chosen_tier_name,
      last_attempted_tier: strategy?.last_attempted_tier ?? null,
      last_attempted_tier_name: strategy?.last_attempted_tier_name ?? null,
      stop_reason: strategy?.stop_reason ?? null,
      legacy_fallback_used: strategy?.legacy_fallback_used ?? false,
      legacy_contactable_count:
        strategy?.legacy_contactable_count ?? input.existing_contactable_before,
    },
  }
}

export function resolveApolloAttributedContactableCounts(input: {
  company_contacts: Record<string, unknown>[]
  apollo_candidate_ids: Set<string>
}): { apollo_contactable: number; legacy_contactable: number } {
  let apollo_contactable = 0
  let legacy_contactable = 0

  for (const row of input.company_contacts) {
    const candidateId = asString(row.contact_candidate_id)
    const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
    const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
    if (!hasEmail && !hasPhone) continue

    if (candidateId && input.apollo_candidate_ids.has(candidateId)) {
      apollo_contactable += 1
    } else {
      legacy_contactable += 1
    }
  }

  return { apollo_contactable, legacy_contactable }
}
