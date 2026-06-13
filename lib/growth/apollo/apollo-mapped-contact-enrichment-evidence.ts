/** Apollo mapped-contact enrichment evidence — client-safe diagnostics. */

import {
  apolloCandidateHasVerifiedStatusWithoutEmail,
  apolloCandidateNeedsEmailEnrichment,
  buildApolloEmailChannelEvidenceRow,
  readApolloPersonIdFromCandidate,
} from "@/lib/growth/apollo/apollo-email-channel-evidence"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import type { ApolloCandidateEmailEnrichmentResult } from "@/lib/growth/apollo/apollo-candidate-email-enrichment"
import { resolveApolloVerifiedEmailSource } from "@/lib/growth/apollo/apollo-current-run-attribution"
import {
  evaluateApolloVerifiedEmailPromotionBlocker,
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
  resolveApolloCandidatePromotedEmail,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import {
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_MAPPED_CONTACT_ENRICHMENT_EVIDENCE_QA_MARKER =
  "apollo-mapped-contact-enrichment-evidence-v1" as const

export const APOLLO_ENRICHMENT_BLOCKERS = [
  "enrichment_not_attempted",
  "enrichment_provider_disabled",
  "enrichment_budget_exhausted",
  "enrichment_returned_no_email",
  "enrichment_returned_unverified_email",
  "enrichment_email_present_but_not_persisted",
  "email_status_verified_without_email",
  "no_candidates_need_email_enrichment",
  "no_apollo_person_ids_for_enrichment",
  "enrichment_gates_blocked",
  "linkedin_only_skips_bulk_match",
  "missing_apollo_person_id",
] as const

export type ApolloEnrichmentBlocker = (typeof APOLLO_ENRICHMENT_BLOCKERS)[number]

export type ApolloMappedContactEnrichmentRow = {
  contact_candidate_id: string | null
  full_name: string
  title: string | null
  apollo_person_id: string | null
  search_email: string | null
  search_email_status: string | null
  candidate_email: string | null
  candidate_email_status: string | null
  has_observed_channel: boolean
  needs_email_enrichment: boolean
  enrichment_eligibility_blocker: string | null
  verified_promotion_blocker: string | null
  verified_email_source: "search" | "enrichment" | null
}

export type ApolloCompanyEnrichmentEvidence = {
  qa_marker: typeof APOLLO_MAPPED_CONTACT_ENRICHMENT_EVIDENCE_QA_MARKER
  mapped_contacts_count: number
  mapped_contacts_requiring_enrichment: number
  enrichment_attempted: boolean
  enrichment_provider: "apollo_bulk_match" | null
  enrichment_candidates_selected: number
  enrichment_candidates_updated: number
  search_verified_email_contacts: number
  enrichment_verified_email_contacts: number
  enrichment_no_email_count: number
  enrichment_unverified_email_count: number
  enrichment_blockers: ApolloEnrichmentBlocker[]
  enrichment_credit_guardrail_status: {
    enrichment_batches_consumed: number
    enrichment_batches_limit: number
    blocked: boolean
  }
  enrichment_request_summary: string | null
  enrichment_response_summary: string | null
  config: {
    enrich_emails_enabled: boolean
    enrich_emails_ack: boolean
    mock_mode: boolean
    search_only_mode: boolean
    apollo_discovery_enabled: boolean
  }
  mapped_contacts: ApolloMappedContactEnrichmentRow[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readMetadata(candidate: GrowthContactCandidate): Record<string, unknown> {
  return candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as Record<string, unknown>)
    : {}
}

export function resolveApolloMappedContactEnrichmentEligibilityBlocker(
  candidate: GrowthContactCandidate,
): string | null {
  if (candidate.provider_type !== "future_apollo") return "not_apollo_candidate"
  if (!readApolloPersonIdFromCandidate(candidate)) return "missing_apollo_person_id"
  if (apolloCandidateNeedsEmailEnrichment(candidate)) return null
  if (resolveApolloCandidatePromotedEmail(candidate)) return "verified_email_already_present"
  if (apolloCandidateHasVerifiedStatusWithoutEmail(candidate)) {
    return "email_status_verified_without_email"
  }
  if (asString(candidate.email)) {
    const status = readApolloEmailStatusFromCandidate(candidate)
    if (status && !isApolloVerifiedEmailStatus(status)) return "enrichment_returned_unverified_email"
  }
  return "no_candidates_need_email_enrichment"
}

export function buildApolloMappedContactEnrichmentRow(
  candidate: GrowthContactCandidate,
): ApolloMappedContactEnrichmentRow {
  const metadata = readMetadata(candidate)
  const channel = buildApolloEmailChannelEvidenceRow({ candidate })
  const searchEmail =
    asString(metadata.apollo_search_raw_email) ||
    asString(metadata.apollo_search_mapped_email) ||
    null

  return {
    contact_candidate_id: candidate.id ?? null,
    full_name: candidate.full_name,
    title: candidate.job_title ?? null,
    apollo_person_id: readApolloPersonIdFromCandidate(candidate),
    search_email: searchEmail,
    search_email_status: asString(metadata.apollo_email_status) || channel.apollo_email_status,
    candidate_email: asString(candidate.email) || null,
    candidate_email_status: readApolloEmailStatusFromCandidate(candidate),
    has_observed_channel: candidateHasObservedContactChannel(candidate),
    needs_email_enrichment: apolloCandidateNeedsEmailEnrichment(candidate),
    enrichment_eligibility_blocker: resolveApolloMappedContactEnrichmentEligibilityBlocker(candidate),
    verified_promotion_blocker: evaluateApolloVerifiedEmailPromotionBlocker(candidate),
    verified_email_source: resolveApolloVerifiedEmailSource(candidate),
  }
}

function countVerifiedEmailOutcomesBySource(candidates: GrowthContactCandidate[]): {
  search_verified_email_contacts: number
  enrichment_verified_email_contacts: number
  enrichment_no_email_count: number
  enrichment_unverified_email_count: number
} {
  let search_verified_email_contacts = 0
  let enrichment_verified_email_contacts = 0
  let enrichment_no_email_count = 0
  let enrichment_unverified_email_count = 0

  for (const candidate of candidates) {
    const source = resolveApolloVerifiedEmailSource(candidate)
    if (source === "search") {
      search_verified_email_contacts += 1
      continue
    }
    if (source === "enrichment") {
      enrichment_verified_email_contacts += 1
      continue
    }

    const email = asString(candidate.email)
    const status = readApolloEmailStatusFromCandidate(candidate)
    if (!email) {
      enrichment_no_email_count += 1
    } else if (!isApolloVerifiedEmailStatus(status)) {
      enrichment_unverified_email_count += 1
    }
  }

  return {
    search_verified_email_contacts,
    enrichment_verified_email_contacts,
    enrichment_no_email_count,
    enrichment_unverified_email_count,
  }
}

function mapSkippedReasonToBlockers(input: {
  skipped_reason: string | null
  error: string | null
  enrichment_attempted: boolean
  enrich_emails_enabled: boolean
  candidates_requiring_enrichment: number
  search_verified_email_contacts: number
}): ApolloEnrichmentBlocker[] {
  const blockers: ApolloEnrichmentBlocker[] = []
  if (!input.enrich_emails_enabled) {
    blockers.push("enrichment_provider_disabled")
    blockers.push("enrichment_gates_blocked")
  }
  if (!input.enrichment_attempted && input.search_verified_email_contacts === 0) {
    blockers.push("enrichment_not_attempted")
  }
  if (input.skipped_reason === "no_candidates_need_email_enrichment") {
    blockers.push("no_candidates_need_email_enrichment")
    if (input.candidates_requiring_enrichment > 0) {
      blockers.push("linkedin_only_skips_bulk_match")
    }
  }
  if (input.skipped_reason === "enrichment_gates_blocked") {
    blockers.push("enrichment_gates_blocked")
    blockers.push("enrichment_provider_disabled")
  }
  if (input.skipped_reason === "no_apollo_person_ids_for_enrichment") {
    blockers.push("no_apollo_person_ids_for_enrichment")
    blockers.push("missing_apollo_person_id")
  }
  if (input.error?.includes("max enrichment API calls")) {
    blockers.push("enrichment_budget_exhausted")
  }
  if (input.skipped_reason === "candidate_persistence_partial_failure") {
    blockers.push("enrichment_email_present_but_not_persisted")
  }
  return [...new Set(blockers)]
}

export function buildApolloCompanyEnrichmentEvidence(input: {
  candidates: GrowthContactCandidate[]
  env?: NodeJS.ProcessEnv
  enrichment_attempted?: boolean
  enrichment_result?: ApolloCandidateEmailEnrichmentResult | null
  guardrails?: { bulk_match_batches?: number } | null
}): ApolloCompanyEnrichmentEvidence {
  const env = input.env ?? process.env
  const limits = resolveApolloCreditLimits(env)
  const enrich_emails_enabled = isApolloEmailEnrichmentEnabled(env)
  const mapped_contacts = input.candidates
    .filter((candidate) => candidate.provider_type === "future_apollo")
    .map(buildApolloMappedContactEnrichmentRow)

  const mapped_contacts_requiring_enrichment = mapped_contacts.filter(
    (row) => row.needs_email_enrichment,
  ).length
  const linkedinOnlyCount = mapped_contacts.filter(
    (row) => row.enrichment_eligibility_blocker === "linkedin_only_skips_bulk_match",
  ).length

  const enrichment_attempted = input.enrichment_attempted ?? false
  const enrichment_result = input.enrichment_result
  const emailOutcomes = countVerifiedEmailOutcomesBySource(input.candidates)

  const blockers = mapSkippedReasonToBlockers({
    skipped_reason: enrichment_result?.skipped_reason ?? null,
    error: enrichment_result?.error ?? null,
    enrichment_attempted,
    enrich_emails_enabled,
    candidates_requiring_enrichment: linkedinOnlyCount,
    search_verified_email_contacts: emailOutcomes.search_verified_email_contacts,
  })

  if (
    enrichment_attempted &&
    (enrichment_result?.candidates_updated ?? 0) === 0 &&
    (enrichment_result?.candidates_selected ?? 0) > 0 &&
    !enrichment_result?.error
  ) {
    blockers.push("enrichment_returned_no_email")
  }

  for (const row of mapped_contacts) {
    if (row.enrichment_eligibility_blocker === "email_status_verified_without_email") {
      blockers.push("email_status_verified_without_email")
    }
  }

  const batches = input.guardrails?.bulk_match_batches ?? enrichment_result?.bulk_match_batches ?? 0

  return {
    qa_marker: APOLLO_MAPPED_CONTACT_ENRICHMENT_EVIDENCE_QA_MARKER,
    mapped_contacts_count: mapped_contacts.length,
    mapped_contacts_requiring_enrichment,
    enrichment_attempted,
    enrichment_provider:
      enrichment_attempted && enrich_emails_enabled ? "apollo_bulk_match" : null,
    enrichment_candidates_selected: enrichment_result?.candidates_selected ?? 0,
    enrichment_candidates_updated: enrichment_result?.candidates_updated ?? 0,
    search_verified_email_contacts: emailOutcomes.search_verified_email_contacts,
    enrichment_verified_email_contacts: emailOutcomes.enrichment_verified_email_contacts,
    enrichment_no_email_count: emailOutcomes.enrichment_no_email_count,
    enrichment_unverified_email_count: emailOutcomes.enrichment_unverified_email_count,
    enrichment_blockers: [...new Set(blockers)],
    enrichment_credit_guardrail_status: {
      enrichment_batches_consumed: batches,
      enrichment_batches_limit: limits.max_enrichment_batches_per_run,
      blocked: batches >= limits.max_enrichment_batches_per_run,
    },
    enrichment_request_summary: enrichment_result?.enrichment_request_summary ?? null,
    enrichment_response_summary: enrichment_result?.enrichment_response_summary ?? null,
    config: {
      enrich_emails_enabled,
      enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
      mock_mode: isApolloMockEnabled(env),
      search_only_mode: !enrich_emails_enabled,
      apollo_discovery_enabled: env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED === "true",
    },
    mapped_contacts,
  }
}

export function emptyApolloCompanyEnrichmentEvidence(
  env?: NodeJS.ProcessEnv,
): ApolloCompanyEnrichmentEvidence {
  return buildApolloCompanyEnrichmentEvidence({ candidates: [], env })
}
