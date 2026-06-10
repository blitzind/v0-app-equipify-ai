/** Apollo partial-identity evidence — client-safe acquisition metrics. */

import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { ApolloTieredPeopleSearchEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import {
  APOLLO_IDENTITY_STATUS_ENRICHED,
  APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
  APOLLO_PARTIAL_IDENTITY_QA_MARKER,
  buildApolloPartialIdentityPromotionBlocker,
  canPromoteApolloPartialIdentityCandidate,
  isApolloPartialIdentityMappedContact,
  readApolloPartialIdentityStatus,
} from "@/lib/growth/apollo/apollo-partial-identity"
import type { ApolloVerifiedEmailPromotionEvidence } from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"

export type ApolloPartialIdentityEvidence = {
  qa_marker: typeof APOLLO_PARTIAL_IDENTITY_QA_MARKER
  mapped_partial_identity_contacts: number
  partial_identity_candidates_staged: number
  partial_identity_enrichment_attempted: boolean
  partial_identity_enrichment_resolved: number
  partial_identity_promoted_after_resolution: number
  partial_identity_blockers: string[]
}

export function emptyApolloPartialIdentityEvidence(): ApolloPartialIdentityEvidence {
  return {
    qa_marker: APOLLO_PARTIAL_IDENTITY_QA_MARKER,
    mapped_partial_identity_contacts: 0,
    partial_identity_candidates_staged: 0,
    partial_identity_enrichment_attempted: false,
    partial_identity_enrichment_resolved: 0,
    partial_identity_promoted_after_resolution: 0,
    partial_identity_blockers: [],
  }
}

export function readPartialIdentityCountsFromSearchStrategy(
  strategy: ApolloTieredPeopleSearchEvidence | null | undefined,
): { mapped_partial_identity_contacts: number; mapped_full_identity_contacts: number } {
  return {
    mapped_partial_identity_contacts: strategy?.mapped_partial_identity_contacts ?? 0,
    mapped_full_identity_contacts: strategy?.mapped_full_identity_contacts ?? 0,
  }
}

export function countPartialIdentityCandidates(
  candidates: GrowthContactCandidate[],
): number {
  return candidates.filter((candidate) => isApolloPartialIdentityMappedContact(candidate)).length
}

export function buildApolloPartialIdentityEvidence(input: {
  search_strategy: ApolloTieredPeopleSearchEvidence | null
  candidates: GrowthContactCandidate[]
  apollo_candidate_ids_this_run: string[]
  partial_identity_enrichment_attempted: boolean
  partial_identity_enrichment_resolved: number
  verified_email_promotion: ApolloVerifiedEmailPromotionEvidence | null
}): ApolloPartialIdentityEvidence {
  const counts = readPartialIdentityCountsFromSearchStrategy(input.search_strategy)
  const thisRunIds = new Set(input.apollo_candidate_ids_this_run)
  const partialCandidates = input.candidates.filter(
    (candidate) =>
      isApolloPartialIdentityMappedContact(candidate) && thisRunIds.has(candidate.id),
  )

  const blockers = new Set<string>()
  for (const candidate of partialCandidates) {
    const blocker = buildApolloPartialIdentityPromotionBlocker(candidate)
    if (blocker) blockers.add(blocker)
    const status = readApolloPartialIdentityStatus(candidate)
    if (status === APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT) {
      blockers.add("partial_identity_needs_enrichment")
    }
  }

  let partial_identity_promoted_after_resolution = 0
  if (input.verified_email_promotion) {
    for (const row of input.verified_email_promotion.blockers_by_contact) {
      if (!row.promoted || !row.contact_candidate_id) continue
      const candidate = partialCandidates.find((item) => item.id === row.contact_candidate_id)
      if (!candidate) continue
      if (canPromoteApolloPartialIdentityCandidate(candidate)) {
        partial_identity_promoted_after_resolution += 1
      }
    }
  }

  return {
    qa_marker: APOLLO_PARTIAL_IDENTITY_QA_MARKER,
    mapped_partial_identity_contacts: counts.mapped_partial_identity_contacts,
    partial_identity_candidates_staged: partialCandidates.length,
    partial_identity_enrichment_attempted: input.partial_identity_enrichment_attempted,
    partial_identity_enrichment_resolved: input.partial_identity_enrichment_resolved,
    partial_identity_promoted_after_resolution,
    partial_identity_blockers: [...blockers],
  }
}

export function countPartialIdentityEnrichmentResolved(
  candidates: GrowthContactCandidate[],
): number {
  let resolved = 0
  for (const candidate of candidates) {
    if (!isApolloPartialIdentityMappedContact(candidate)) continue
    const status = readApolloPartialIdentityStatus(candidate)
    if (status === APOLLO_IDENTITY_STATUS_ENRICHED) resolved += 1
  }
  return resolved
}
