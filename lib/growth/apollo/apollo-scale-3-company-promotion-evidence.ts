/** Apollo Scale-3 company promotion evidence — client-safe mapping from acquisition evidence. */

import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type { ApolloAcquisitionSearchEvidence } from "@/lib/growth/apollo/apollo-acquisition-search-evidence"
import {
  buildApolloMapperRejectionEvidenceFromTierAttempts,
  buildApolloTierAttemptsCompactSummaries,
  type ApolloMapperRejectionEvidence,
  type ApolloTierAttemptCompactSummary,
} from "@/lib/growth/apollo/apollo-search-diagnostic-evidence"
import type { ApolloCompanyEnrichmentEvidence } from "@/lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import { emptyApolloCompanyEnrichmentEvidence } from "@/lib/growth/apollo/apollo-mapped-contact-enrichment-evidence"
import { buildApolloCohortCompanySearchDebug } from "@/lib/growth/apollo/apollo-cohort-company-search-debug"
import {
  emptyApolloPartialIdentityEvidence,
  type ApolloPartialIdentityEvidence,
} from "@/lib/growth/apollo/apollo-partial-identity-evidence"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloCurrentRunCandidateAttributionRow } from "@/lib/growth/apollo/apollo-current-run-attribution"
import type { ApolloScale3CompanyCertificationFailReason } from "@/lib/growth/apollo/apollo-scale-3-certification-assessment"

export const APOLLO_SCALE_3_COMPANY_PROMOTION_EVIDENCE_QA_MARKER =
  "apollo-scale-3-company-promotion-evidence-v1" as const

export type ApolloScale3CompanyEvidenceBaseRow = {
  company_candidate_id: string
  company_name: string
  domain: string
  search_attempted: boolean
  contacts_found: number
  contacts_enriched: number
  contacts_promoted: number
  contactable_contacts: number
  sequence_ready_contacts: number
  blockers: string[]
  error: string | null
  failed: boolean
}

export type ApolloScale3MappedCompanyEvidenceRow = ApolloScale3CompanyEvidenceBaseRow & {
  tier_used: number | null
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  mapper_rejection_evidence: ApolloMapperRejectionEvidence | null
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  tier_attempts_compact: ApolloTierAttemptCompactSummary[]
  contactable: number
  sequence_ready: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
  certification_fail_reasons: ApolloScale3CompanyCertificationFailReason[]
  partial_identity_evidence: ApolloPartialIdentityEvidence
  cohort_search_debug: ApolloCohortCompanySearchDebug | null
  enrichment_evidence: ApolloCompanyEnrichmentEvidence
  legacy_fallback_used: boolean
  promotion_evidence: ApolloScale3CompanyPromotionEvidence
  acquisition_evidence: ApolloAcquisitionSearchEvidence | null
}

export type ApolloScale3CompanyPromotionEvidence = {
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  enrichment_attempted: boolean
  enrichment_skipped_reason: string | null
  verified_status_without_email_selected: number
  email_enrichment_candidates_selected: number
  email_enrichment_candidates_updated: number
  email_enrichment_error: string | null
  email_enrichment_error_stage: string | null
  verified_email_contacts: number
  company_contacts_promoted: number
  contactable_after_promotion: number
  sequence_ready_after_promotion: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
  historical_apollo_verified_email_contacts: number
  legacy_contactable_contacts: number
  search_verified_email_contacts: number
  enrichment_verified_email_contacts: number
  promotion_attempted: boolean
  promotion_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
  contactability_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
  sequence_readiness_blockers_by_candidate: ApolloCurrentRunCandidateAttributionRow[]
}

export function buildApolloScale3CompanyPromotionEvidence(
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null,
): ApolloScale3CompanyPromotionEvidence {
  const emailEnrichment = acquisition?.email_enrichment
  const verifiedPromotion = acquisition?.verified_email_promotion
  const currentRun = acquisition?.current_run_attribution

  return {
    apollo_search_attempted: acquisition?.apollo_search_attempted ?? false,
    apollo_search_skipped_reason: acquisition?.apollo_search_skipped_reason ?? null,
    enrichment_attempted: acquisition?.enrichment_attempted ?? false,
    enrichment_skipped_reason: acquisition?.enrichment_skipped_reason ?? null,
    verified_status_without_email_selected:
      emailEnrichment?.verified_status_without_email_selected ?? 0,
    email_enrichment_candidates_selected: emailEnrichment?.candidates_selected ?? 0,
    email_enrichment_candidates_updated:
      emailEnrichment?.candidates_updated ?? acquisition?.enrichment_candidates_updated ?? 0,
    email_enrichment_error: emailEnrichment?.error ?? null,
    email_enrichment_error_stage: emailEnrichment?.error_stage ?? null,
    verified_email_contacts: verifiedPromotion?.verified_email_contacts ?? 0,
    company_contacts_promoted:
      verifiedPromotion?.company_contacts_promoted ?? acquisition?.promoted_contacts ?? 0,
    contactable_after_promotion:
      verifiedPromotion?.contactable_after_promotion ?? acquisition?.contactable_contacts ?? 0,
    sequence_ready_after_promotion:
      verifiedPromotion?.sequence_ready_after_promotion ?? acquisition?.sequence_ready_contacts ?? 0,
    current_run_apollo_verified_email_contacts:
      currentRun?.current_run_apollo_verified_email_contacts ?? 0,
    current_run_apollo_promoted_contacts: currentRun?.current_run_apollo_promoted_contacts ?? 0,
    current_run_apollo_contactable_contacts:
      currentRun?.current_run_apollo_contactable_contacts ?? 0,
    current_run_apollo_sequence_ready_contacts:
      currentRun?.current_run_apollo_sequence_ready_contacts ?? 0,
    historical_apollo_verified_email_contacts:
      currentRun?.historical_apollo_verified_email_contacts ?? 0,
    legacy_contactable_contacts:
      currentRun?.legacy_contactable_contacts ?? acquisition?.existing_contactable_before ?? 0,
    search_verified_email_contacts: currentRun?.search_verified_email_contacts ?? 0,
    enrichment_verified_email_contacts: currentRun?.enrichment_verified_email_contacts ?? 0,
    promotion_attempted: currentRun?.promotion_attempted ?? false,
    promotion_blockers_by_candidate: currentRun?.promotion_blockers_by_candidate ?? [],
    contactability_blockers_by_candidate: currentRun?.contactability_blockers_by_candidate ?? [],
    sequence_readiness_blockers_by_candidate:
      currentRun?.sequence_readiness_blockers_by_candidate ?? [],
  }
}

export function isApolloScale3LegacyTier4OnlyFallback(input: {
  tier_used: number | null
  legacy_fallback_used: boolean
  mapped_contacts: number
  promotion: ApolloScale3CompanyPromotionEvidence
}): boolean {
  return (
    input.legacy_fallback_used &&
    input.mapped_contacts === 0 &&
    input.promotion.verified_email_contacts === 0 &&
    input.promotion.company_contacts_promoted === 0
  )
}

/** Scale-5 PASS-shaped acquisition should not collapse to tier-4/no-channel in Scale-3 evidence. */
export function assertApolloScale3CompanyMatchesScale5PromotionPath(input: {
  company_name: string
  tier_used: number | null
  legacy_fallback_used: boolean
  mapped_contacts: number
  promotion: ApolloScale3CompanyPromotionEvidence
  blockers: string[]
}): string | null {
  if (input.promotion.verified_email_contacts <= 0) return null
  if (input.promotion.company_contacts_promoted <= 0) {
    return `${input.company_name}: verified_email_contacts>0 but company_contacts_promoted=0`
  }
  if (input.promotion.verified_email_contacts > 0 && input.legacy_fallback_used && input.mapped_contacts === 0) {
    return `${input.company_name}: Scale-5 promotion path regressed to legacy-only fallback`
  }
  if (isApolloScale3LegacyTier4OnlyFallback({ ...input, promotion: input.promotion })) {
    return `${input.company_name}: Scale-5 promotion path regressed to tier-4-only fallback`
  }
  if (input.blockers.includes("no_enriched_candidates_with_contact_channel")) {
    return `${input.company_name}: no_enriched_candidates_with_contact_channel despite verified emails`
  }
  return null
}

export function mapApolloScale3CompanyEvidenceRow(input: {
  base: ApolloScale3CompanyEvidenceBaseRow
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
}): ApolloScale3MappedCompanyEvidenceRow {
  const strategy = input.acquisition?.search_strategy
  const promotion_evidence = buildApolloScale3CompanyPromotionEvidence(input.acquisition)
  const apollo_contactable = promotion_evidence.current_run_apollo_contactable_contacts
  const apollo_sequence_ready = promotion_evidence.current_run_apollo_sequence_ready_contacts
  const tier_attempts = strategy?.tier_attempts ?? []
  const mapper_rejection_evidence = buildApolloMapperRejectionEvidenceFromTierAttempts(tier_attempts)
  const mergedBlockers = [
    ...new Set([
      ...input.base.blockers,
      ...(input.acquisition?.apollo_search_evidence?.apollo_search_blockers ?? []),
      ...(input.acquisition?.blockers ?? []),
    ]),
  ]

  return {
    ...input.base,
    blockers: mergedBlockers,
    tier_used:
      strategy?.chosen_tier ??
      strategy?.last_attempted_tier ??
      input.acquisition?.apollo_search_evidence?.chosen_tier ??
      input.acquisition?.apollo_search_evidence?.last_attempted_tier ??
      strategy?.tier_used ??
      null,
    raw_contacts_returned:
      strategy?.raw_contacts_returned ??
      input.acquisition?.apollo_search_evidence?.apollo_raw_people_count ??
      0,
    mapped_contacts:
      strategy?.mapped_contacts ??
      input.acquisition?.apollo_search_evidence?.apollo_mapped_people_count ??
      input.base.contacts_found,
    mapping_rejections: strategy?.mapping_rejections ?? 0,
    rejection_reasons:
      strategy?.rejection_reasons ??
      input.acquisition?.apollo_search_evidence?.mapper_rejection_reasons ??
      {},
    mapper_rejection_evidence,
    tier_attempts,
    tier_attempts_compact: buildApolloTierAttemptsCompactSummaries(tier_attempts),
    partial_identity_evidence:
      input.acquisition?.partial_identity_evidence ?? emptyApolloPartialIdentityEvidence(),
    cohort_search_debug:
      input.acquisition?.search_debug ??
      buildApolloCohortCompanySearchDebug({
        company_candidate_id: input.base.company_candidate_id,
        company_name: input.base.company_name,
        domain: input.base.domain,
        search_path: "scale3_evidence_only",
        search_strategy: strategy,
        acquisition: input.acquisition,
      }),
    contacts_enriched: promotion_evidence.email_enrichment_candidates_updated,
    contacts_promoted: promotion_evidence.current_run_apollo_promoted_contacts,
    contactable: apollo_contactable,
    sequence_ready: apollo_sequence_ready,
    current_run_apollo_verified_email_contacts:
      promotion_evidence.current_run_apollo_verified_email_contacts,
    current_run_apollo_promoted_contacts: promotion_evidence.current_run_apollo_promoted_contacts,
    current_run_apollo_contactable_contacts:
      promotion_evidence.current_run_apollo_contactable_contacts,
    current_run_apollo_sequence_ready_contacts:
      promotion_evidence.current_run_apollo_sequence_ready_contacts,
    certification_fail_reasons: [] as ApolloScale3CompanyCertificationFailReason[],
    contactable_contacts: apollo_contactable,
    sequence_ready_contacts: apollo_sequence_ready,
    legacy_fallback_used: strategy?.legacy_fallback_used ?? false,
    promotion_evidence: {
      ...promotion_evidence,
      contactable_after_promotion: apollo_contactable,
      sequence_ready_after_promotion: apollo_sequence_ready,
    },
    acquisition_evidence: input.acquisition?.apollo_search_evidence ?? null,
    enrichment_evidence:
      input.acquisition?.enrichment_evidence ?? emptyApolloCompanyEnrichmentEvidence(),
  }
}
