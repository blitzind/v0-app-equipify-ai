/** Apollo Scale-3 company promotion evidence — client-safe mapping from acquisition evidence. */

import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

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
  tier_used: number
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  contactable: number
  sequence_ready: number
  legacy_fallback_used: boolean
  promotion_evidence: ApolloScale3CompanyPromotionEvidence
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
}

export function buildApolloScale3CompanyPromotionEvidence(
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null,
): ApolloScale3CompanyPromotionEvidence {
  const emailEnrichment = acquisition?.email_enrichment
  const verifiedPromotion = acquisition?.verified_email_promotion

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
  }
}

export function isApolloScale3LegacyTier4OnlyFallback(input: {
  tier_used: number
  legacy_fallback_used: boolean
  mapped_contacts: number
  promotion: ApolloScale3CompanyPromotionEvidence
}): boolean {
  return (
    input.legacy_fallback_used &&
    input.tier_used === 4 &&
    input.mapped_contacts === 0 &&
    input.promotion.verified_email_contacts === 0 &&
    input.promotion.company_contacts_promoted === 0
  )
}

/** Scale-5 PASS-shaped acquisition should not collapse to tier-4/no-channel in Scale-3 evidence. */
export function assertApolloScale3CompanyMatchesScale5PromotionPath(input: {
  company_name: string
  tier_used: number
  legacy_fallback_used: boolean
  mapped_contacts: number
  promotion: ApolloScale3CompanyPromotionEvidence
  blockers: string[]
}): string | null {
  if (input.promotion.verified_email_contacts <= 0) return null
  if (input.promotion.company_contacts_promoted <= 0) {
    return `${input.company_name}: verified_email_contacts>0 but company_contacts_promoted=0`
  }
  if (input.promotion.verified_email_contacts > 0 && input.tier_used === 4 && input.legacy_fallback_used) {
    return `${input.company_name}: Scale-5 promotion path regressed to tier-4 fallback`
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

  return {
    ...input.base,
    tier_used: strategy?.tier_used ?? 0,
    raw_contacts_returned: strategy?.raw_contacts_returned ?? 0,
    mapped_contacts: strategy?.mapped_contacts ?? input.base.contacts_found,
    mapping_rejections: strategy?.mapping_rejections ?? 0,
    rejection_reasons: strategy?.rejection_reasons ?? {},
    tier_attempts: strategy?.tier_attempts ?? [],
    contacts_enriched: promotion_evidence.email_enrichment_candidates_updated,
    contacts_promoted: promotion_evidence.company_contacts_promoted,
    contactable: promotion_evidence.contactable_after_promotion,
    sequence_ready: promotion_evidence.sequence_ready_after_promotion,
    contactable_contacts: promotion_evidence.contactable_after_promotion,
    sequence_ready_contacts: promotion_evidence.sequence_ready_after_promotion,
    legacy_fallback_used: strategy?.legacy_fallback_used ?? false,
    promotion_evidence,
  }
}
