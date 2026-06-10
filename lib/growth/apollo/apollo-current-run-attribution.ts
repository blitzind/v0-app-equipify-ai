/** Apollo current-run vs historical attribution — client-safe Scale-3 metrics. */

import type { ApolloVerifiedEmailPromotionEvidence } from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import {
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"

export const APOLLO_CURRENT_RUN_ATTRIBUTION_QA_MARKER = "apollo-current-run-attribution-v1" as const

export type ApolloCurrentRunAttribution = {
  qa_marker: typeof APOLLO_CURRENT_RUN_ATTRIBUTION_QA_MARKER
  current_run_apollo_mapped_contacts: number
  current_run_apollo_persisted_contacts: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
  historical_apollo_verified_email_contacts: number
  legacy_contactable_contacts: number
  apollo_candidate_ids_this_run: string[]
  has_current_run_search_yield: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

function isVerifiedApolloCandidate(candidate: GrowthContactCandidate): boolean {
  const status = readApolloEmailStatusFromCandidate(candidate)
  return isApolloVerifiedEmailStatus(status) && Boolean(asString(candidate.email))
}

export function resolveApolloCandidateIdsThisRun(input: {
  before: Set<string>
  after: Set<string>
}): string[] {
  const ids: string[] = []
  for (const id of input.after) {
    if (!input.before.has(id)) ids.push(id)
  }
  return ids
}

export function resolveApolloCurrentRunAttribution(input: {
  apollo_mapped_this_run: number
  apollo_persisted_this_run: number
  apollo_candidate_ids_before: Set<string>
  apollo_candidates_after: GrowthContactCandidate[]
  verified_email_promotion: ApolloVerifiedEmailPromotionEvidence | null
  existing_contactable_before: number
  company_contacts: Record<string, unknown>[]
}): ApolloCurrentRunAttribution {
  const afterIds = new Set(
    input.apollo_candidates_after.map((candidate) => asString(candidate.id)).filter(Boolean),
  )
  const apollo_candidate_ids_this_run = resolveApolloCandidateIdsThisRun({
    before: input.apollo_candidate_ids_before,
    after: afterIds,
  })
  const thisRunIdSet = new Set(apollo_candidate_ids_this_run)

  const has_current_run_search_yield =
    input.apollo_mapped_this_run > 0 ||
    input.apollo_persisted_this_run > 0 ||
    apollo_candidate_ids_this_run.length > 0

  let current_run_apollo_verified_email_contacts = 0
  let historical_apollo_verified_email_contacts = 0

  for (const candidate of input.apollo_candidates_after) {
    if (!isVerifiedApolloCandidate(candidate)) continue
    const id = asString(candidate.id)
    if (has_current_run_search_yield && thisRunIdSet.has(id)) {
      current_run_apollo_verified_email_contacts += 1
    } else {
      historical_apollo_verified_email_contacts += 1
    }
  }

  let current_run_apollo_promoted_contacts = 0
  let current_run_apollo_contactable_contacts = 0
  let current_run_apollo_sequence_ready_contacts = 0

  if (has_current_run_search_yield) {
    for (const row of input.company_contacts) {
      const candidateId = asString(row.contact_candidate_id)
      if (!candidateId || !thisRunIdSet.has(candidateId)) continue
      current_run_apollo_promoted_contacts += 1
      if (isContactableCompanyContact(row)) current_run_apollo_contactable_contacts += 1
      if (isSequenceReadyCompanyContact(row)) current_run_apollo_sequence_ready_contacts += 1
    }
  }

  if (!has_current_run_search_yield) {
    current_run_apollo_verified_email_contacts = 0
    current_run_apollo_promoted_contacts = 0
    current_run_apollo_contactable_contacts = 0
    current_run_apollo_sequence_ready_contacts = 0
  }

  return {
    qa_marker: APOLLO_CURRENT_RUN_ATTRIBUTION_QA_MARKER,
    current_run_apollo_mapped_contacts: has_current_run_search_yield
      ? input.apollo_mapped_this_run
      : 0,
    current_run_apollo_persisted_contacts: has_current_run_search_yield
      ? input.apollo_persisted_this_run
      : 0,
    current_run_apollo_verified_email_contacts,
    current_run_apollo_promoted_contacts,
    current_run_apollo_contactable_contacts,
    current_run_apollo_sequence_ready_contacts,
    historical_apollo_verified_email_contacts,
    legacy_contactable_contacts: input.existing_contactable_before,
    apollo_candidate_ids_this_run,
    has_current_run_search_yield,
  }
}

export function assertApolloCurrentRunMetricsConsistent(input: {
  apollo_mapped_this_run: number
  apollo_persisted_this_run: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_sequence_ready_contacts: number
}): string[] {
  const blockers: string[] = []
  const noSearchYield =
    input.apollo_mapped_this_run === 0 && input.apollo_persisted_this_run === 0

  if (noSearchYield) {
    if (input.current_run_apollo_verified_email_contacts > 0) {
      blockers.push("current_run_metric_leak:verified_email_without_search_yield")
    }
    if (input.current_run_apollo_promoted_contacts > 0) {
      blockers.push("current_run_metric_leak:promoted_without_search_yield")
    }
    if (input.current_run_apollo_sequence_ready_contacts > 0) {
      blockers.push("current_run_metric_leak:sequence_ready_without_search_yield")
    }
  }

  return blockers
}
