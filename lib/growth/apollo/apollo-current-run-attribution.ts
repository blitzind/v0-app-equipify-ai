/** Apollo current-run vs historical attribution — client-safe Scale-3 metrics. */

import { readApolloPersonIdFromCandidate } from "@/lib/growth/apollo/apollo-email-channel-evidence"
import type { ApolloVerifiedEmailPromotionEvidence } from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import {
  evaluateApolloVerifiedEmailPromotionBlocker,
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"

export const APOLLO_CURRENT_RUN_ATTRIBUTION_QA_MARKER = "apollo-current-run-attribution-v2" as const

export type ApolloVerifiedEmailSource = "search" | "enrichment" | null

export type ApolloCurrentRunCandidateAttributionRow = {
  contact_candidate_id: string | null
  full_name: string
  apollo_person_id: string | null
  verified_email_source: ApolloVerifiedEmailSource
  attributed_this_run: boolean
  promotion_blocker: string | null
  contactability_blocker: string | null
  sequence_readiness_blocker: string | null
  promoted: boolean
  contactable: boolean
  sequence_ready: boolean
}

export type ApolloCurrentRunAttribution = {
  qa_marker: typeof APOLLO_CURRENT_RUN_ATTRIBUTION_QA_MARKER
  current_run_apollo_mapped_contacts: number
  current_run_apollo_persisted_contacts: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
  search_verified_email_contacts: number
  enrichment_verified_email_contacts: number
  historical_apollo_verified_email_contacts: number
  legacy_contactable_contacts: number
  apollo_candidate_ids_this_run: string[]
  apollo_candidate_ids_attributed_this_run: string[]
  apollo_person_ids_mapped_this_run: string[]
  has_current_run_search_yield: boolean
  promotion_attempted: boolean
  promotion_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
  contactability_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
  sequence_readiness_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readCandidateMetadata(candidate: GrowthContactCandidate): Record<string, unknown> {
  return candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as Record<string, unknown>)
    : {}
}

export function resolveApolloVerifiedEmailSource(
  candidate: GrowthContactCandidate,
): ApolloVerifiedEmailSource {
  if (!isVerifiedApolloCandidate(candidate)) return null
  const metadata = readCandidateMetadata(candidate)
  if (asString(metadata.apollo_enriched_at) || asString(metadata.apollo_email_enrichment_source)) {
    return "enrichment"
  }
  return "search"
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

export function readApolloPersonIdsFromProviderContacts(
  contacts: GrowthContactDiscoveryProviderRawContact[] | null | undefined,
): string[] {
  const ids = new Set<string>()
  for (const contact of contacts ?? []) {
    const metadata =
      contact.metadata && typeof contact.metadata === "object"
        ? (contact.metadata as Record<string, unknown>)
        : {}
    const personId =
      asString(metadata.apollo_person_id) || asString(contact.external_provider_contact_id)
    if (personId) ids.add(personId)
  }
  return [...ids]
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

/** Current-run yield includes newly inserted rows and existing rows mapped again this search. */
export function resolveApolloCandidateIdsAttributedThisRun(input: {
  before: Set<string>
  apollo_candidates: GrowthContactCandidate[]
  apollo_person_ids_mapped_this_run: string[]
}): string[] {
  const attributed = new Set<string>()
  const personIds = new Set(input.apollo_person_ids_mapped_this_run.map((id) => id.trim()).filter(Boolean))
  const afterIds = new Set(
    input.apollo_candidates.map((candidate) => asString(candidate.id)).filter(Boolean),
  )

  for (const id of resolveApolloCandidateIdsThisRun({ before: input.before, after: afterIds })) {
    attributed.add(id)
  }

  for (const candidate of input.apollo_candidates) {
    if (candidate.provider_type !== "future_apollo") continue
    const candidateId = asString(candidate.id)
    const personId = readApolloPersonIdFromCandidate(candidate)
    if (candidateId && personId && personIds.has(personId)) {
      attributed.add(candidateId)
    }
  }

  return [...attributed]
}

function resolveContactabilityBlocker(row: Record<string, unknown>): string | null {
  if (isContactableCompanyContact(row)) return null
  if (!asString(row.email) && !asString(row.phone)) return "missing_contact_channel"
  if (asString(row.email_status) === "blocked") return "email_blocked"
  if (asString(row.phone_status) === "blocked") return "phone_blocked"
  return "not_contactable"
}

function resolveSequenceReadinessBlocker(row: Record<string, unknown>): string | null {
  if (isSequenceReadyCompanyContact(row)) return null
  const contactabilityBlocker = resolveContactabilityBlocker(row)
  if (contactabilityBlocker) return contactabilityBlocker
  if (!asString(row.canonical_person_id)) return "missing_canonical_person_id"
  return "sequence_not_ready"
}

export function buildApolloCurrentRunCandidateAttributionRows(input: {
  apollo_candidates: GrowthContactCandidate[]
  attributed_this_run: Set<string>
  company_contacts_by_candidate_id: Map<string, Record<string, unknown>>
}): ApolloCurrentRunCandidateAttributionRow[] {
  return input.apollo_candidates
    .filter((candidate) => candidate.provider_type === "future_apollo")
    .map((candidate) => {
      const candidateId = asString(candidate.id) || null
      const companyContact = candidateId
        ? input.company_contacts_by_candidate_id.get(candidateId) ?? null
        : null
      const promotion_blocker = evaluateApolloVerifiedEmailPromotionBlocker(candidate)
      const contactability_blocker = companyContact
        ? resolveContactabilityBlocker(companyContact)
        : promotion_blocker
          ? "not_promoted"
          : "missing_company_contact"
      const sequence_readiness_blocker = companyContact
        ? resolveSequenceReadinessBlocker(companyContact)
        : contactability_blocker

      return {
        contact_candidate_id: candidateId,
        full_name: candidate.full_name,
        apollo_person_id: readApolloPersonIdFromCandidate(candidate),
        verified_email_source: resolveApolloVerifiedEmailSource(candidate),
        attributed_this_run: candidateId ? input.attributed_this_run.has(candidateId) : false,
        promotion_blocker,
        contactability_blocker,
        sequence_readiness_blocker,
        promoted: Boolean(companyContact),
        contactable: companyContact ? isContactableCompanyContact(companyContact) : false,
        sequence_ready: companyContact ? isSequenceReadyCompanyContact(companyContact) : false,
      }
    })
}

export function resolveApolloCurrentRunAttribution(input: {
  apollo_mapped_this_run: number
  apollo_persisted_this_run: number
  apollo_candidate_ids_before: Set<string>
  apollo_candidates_after: GrowthContactCandidate[]
  apollo_person_ids_mapped_this_run?: string[]
  verified_email_promotion: ApolloVerifiedEmailPromotionEvidence | null
  existing_contactable_before: number
  company_contacts: Record<string, unknown>[]
  promotion_attempted?: boolean
}): ApolloCurrentRunAttribution {
  const apollo_person_ids_mapped_this_run = input.apollo_person_ids_mapped_this_run ?? []
  const apollo_candidate_ids_this_run = resolveApolloCandidateIdsThisRun({
    before: input.apollo_candidate_ids_before,
    after: new Set(
      input.apollo_candidates_after.map((candidate) => asString(candidate.id)).filter(Boolean),
    ),
  })
  const apollo_candidate_ids_attributed_this_run = resolveApolloCandidateIdsAttributedThisRun({
    before: input.apollo_candidate_ids_before,
    apollo_candidates: input.apollo_candidates_after,
    apollo_person_ids_mapped_this_run,
  })
  const thisRunIdSet = new Set(apollo_candidate_ids_attributed_this_run)

  const has_current_run_search_yield =
    input.apollo_mapped_this_run > 0 ||
    input.apollo_persisted_this_run > 0 ||
    apollo_candidate_ids_attributed_this_run.length > 0 ||
    apollo_person_ids_mapped_this_run.length > 0

  let current_run_apollo_verified_email_contacts = 0
  let search_verified_email_contacts = 0
  let enrichment_verified_email_contacts = 0
  let historical_apollo_verified_email_contacts = 0

  for (const candidate of input.apollo_candidates_after) {
    if (!isVerifiedApolloCandidate(candidate)) continue
    const id = asString(candidate.id)
    const source = resolveApolloVerifiedEmailSource(candidate)
    if (has_current_run_search_yield && thisRunIdSet.has(id)) {
      current_run_apollo_verified_email_contacts += 1
      if (source === "enrichment") enrichment_verified_email_contacts += 1
      else search_verified_email_contacts += 1
    } else {
      historical_apollo_verified_email_contacts += 1
    }
  }

  let current_run_apollo_promoted_contacts = 0
  let current_run_apollo_contactable_contacts = 0
  let current_run_apollo_sequence_ready_contacts = 0

  const companyContactsByCandidateId = new Map<string, Record<string, unknown>>()
  for (const row of input.company_contacts) {
    const candidateId = asString(row.contact_candidate_id)
    if (candidateId) companyContactsByCandidateId.set(candidateId, row)
  }

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
    search_verified_email_contacts = 0
    enrichment_verified_email_contacts = 0
    current_run_apollo_promoted_contacts = 0
    current_run_apollo_contactable_contacts = 0
    current_run_apollo_sequence_ready_contacts = 0
  }

  const promotion_blockers_by_candidate = buildApolloCurrentRunCandidateAttributionRows({
    apollo_candidates: input.apollo_candidates_after,
    attributed_this_run: thisRunIdSet,
    company_contacts_by_candidate_id: companyContactsByCandidateId,
  })

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
    search_verified_email_contacts,
    enrichment_verified_email_contacts,
    historical_apollo_verified_email_contacts,
    legacy_contactable_contacts: input.existing_contactable_before,
    apollo_candidate_ids_this_run,
    apollo_candidate_ids_attributed_this_run,
    apollo_person_ids_mapped_this_run,
    has_current_run_search_yield,
    promotion_attempted: input.promotion_attempted ?? false,
    promotion_blockers_by_candidate: promotion_blockers_by_candidate.filter(
      (row) => row.attributed_this_run && row.promotion_blocker,
    ),
    contactability_blockers_by_candidate: promotion_blockers_by_candidate.filter(
      (row) => row.attributed_this_run && row.contactability_blocker,
    ),
    sequence_readiness_blockers_by_candidate: promotion_blockers_by_candidate.filter(
      (row) => row.attributed_this_run && row.sequence_readiness_blocker,
    ),
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
