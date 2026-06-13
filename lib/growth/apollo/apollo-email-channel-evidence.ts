/** Apollo email channel evidence — trace email presence through the live promotion path. Client-safe. */

import {
  buildApolloCompanyContactPromotionFields,
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
  readApolloTierUsedFromCandidate,
  resolveApolloCandidatePromotedEmail,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export const APOLLO_EMAIL_CHANNEL_EVIDENCE_QA_MARKER =
  "apollo-email-channel-evidence-v1" as const

export type ApolloEmailSource =
  | "search"
  | "enrichment"
  | "metadata"
  | "person_email"
  | "prior_company_contact"
  | "none"

export type ApolloEmailChannelEvidenceRow = {
  full_name: string
  apollo_person_id: string | null
  apollo_email_status: string | null
  tier_used: number | null
  raw_email_present: boolean
  raw_email: string | null
  mapped_email_present: boolean
  mapped_email: string | null
  candidate_email_present: boolean
  candidate_email: string | null
  candidate_metadata_apollo_email_status: string | null
  enriched_email_present: boolean
  enriched_email: string | null
  canonical_person_email_present: boolean
  canonical_person_email: string | null
  promotion_resolver_email: string | null
  promotion_resolver_email_status: string | null
  company_contact_email_present: boolean
  company_contact_email: string | null
  company_contact_email_status: string | null
  email_source: ApolloEmailSource
  needs_email_enrichment: boolean
  verified_status_without_email: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readCandidateMetadata(candidate: GrowthContactCandidate): Record<string, unknown> {
  return candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as Record<string, unknown>)
    : {}
}

export function readApolloPersonIdFromCandidate(candidate: GrowthContactCandidate): string | null {
  const metadata = readCandidateMetadata(candidate)
  return asString(metadata.apollo_person_id) || null
}

export function readApolloEnrichedEmailFromCandidate(candidate: GrowthContactCandidate): string | null {
  const metadata = readCandidateMetadata(candidate)
  if (asString(metadata.apollo_enriched_email)) return asString(metadata.apollo_enriched_email)
  if (asString(metadata.apollo_enriched_at) && asString(candidate.email)) {
    return asString(candidate.email)
  }
  return null
}

/** True when Apollo reports verified email status but no promotable email value exists yet. */
export function apolloCandidateHasVerifiedStatusWithoutEmail(
  candidate: GrowthContactCandidate,
): boolean {
  if (candidate.provider_type !== "future_apollo") return false
  if (resolveApolloCandidatePromotedEmail(candidate)) return false
  return isApolloVerifiedEmailStatus(readApolloEmailStatusFromCandidate(candidate))
}

/** True when Apollo pilot still lacks a promotable verified email (LinkedIn/phone alone do not count). */
export function apolloCandidateMissingPromotableEmail(
  candidate: GrowthContactCandidate,
): boolean {
  if (candidate.provider_type !== "future_apollo") return false
  if (!readApolloPersonIdFromCandidate(candidate)) return false
  return !resolveApolloCandidatePromotedEmail(candidate)
}

/** Candidates that should receive Apollo bulk_match before verified-email promotion. */
export function apolloCandidateNeedsEmailEnrichment(candidate: GrowthContactCandidate): boolean {
  return apolloCandidateMissingPromotableEmail(candidate)
}

export function resolveApolloEmailSource(input: {
  candidate: GrowthContactCandidate
  company_contact_email?: string | null
  canonical_person_email?: string | null
  raw_email?: string | null
  mapped_email?: string | null
}): ApolloEmailSource {
  const metadata = readCandidateMetadata(input.candidate)
  const enriched = readApolloEnrichedEmailFromCandidate(input.candidate)
  if (enriched) return "enrichment"
  if (resolveApolloCandidatePromotedEmail(input.candidate)) {
    return asString(metadata.apollo_enriched_at) ? "enrichment" : "search"
  }
  if (asString(input.canonical_person_email)) return "person_email"
  if (asString(input.company_contact_email)) return "prior_company_contact"
  if (asString(input.mapped_email)) return "search"
  if (asString(input.raw_email)) return "search"
  if (isApolloVerifiedEmailStatus(readApolloEmailStatusFromCandidate(input.candidate))) return "metadata"
  return "none"
}

export function buildApolloEmailChannelEvidenceRow(input: {
  candidate: GrowthContactCandidate
  raw_email?: string | null
  mapped_email?: string | null
  company_contact?: Record<string, unknown> | null
  canonical_person_email?: string | null
}): ApolloEmailChannelEvidenceRow {
  const promotionFields = buildApolloCompanyContactPromotionFields({
    candidate: input.candidate,
    prior_email: asString(input.company_contact?.email) || null,
    prior_email_status:
      (asString(input.company_contact?.email_status) as
        | "unknown"
        | "discovered"
        | "verified"
        | "risky"
        | "invalid"
        | "blocked"
        | null) ?? null,
  })

  const candidateEmail = asString(input.candidate.email) || null
  const enrichedEmail = readApolloEnrichedEmailFromCandidate(input.candidate)
  const companyContactEmail = asString(input.company_contact?.email) || null
  const apolloEmailStatus = readApolloEmailStatusFromCandidate(input.candidate)

  return {
    full_name: input.candidate.full_name,
    apollo_person_id: readApolloPersonIdFromCandidate(input.candidate),
    apollo_email_status: apolloEmailStatus,
    tier_used: readApolloTierUsedFromCandidate(input.candidate),
    raw_email_present: Boolean(asString(input.raw_email)),
    raw_email: asString(input.raw_email) || null,
    mapped_email_present: Boolean(asString(input.mapped_email)),
    mapped_email: asString(input.mapped_email) || null,
    candidate_email_present: Boolean(candidateEmail),
    candidate_email: candidateEmail,
    candidate_metadata_apollo_email_status: apolloEmailStatus,
    enriched_email_present: Boolean(enrichedEmail),
    enriched_email: enrichedEmail,
    canonical_person_email_present: Boolean(asString(input.canonical_person_email)),
    canonical_person_email: asString(input.canonical_person_email) || null,
    promotion_resolver_email: promotionFields.email,
    promotion_resolver_email_status: promotionFields.email_status,
    company_contact_email_present: Boolean(companyContactEmail),
    company_contact_email: companyContactEmail,
    company_contact_email_status: asString(input.company_contact?.email_status) || null,
    email_source: resolveApolloEmailSource({
      candidate: input.candidate,
      company_contact_email: companyContactEmail,
      canonical_person_email: input.canonical_person_email,
      raw_email: input.raw_email,
      mapped_email: input.mapped_email,
    }),
    needs_email_enrichment: apolloCandidateNeedsEmailEnrichment(input.candidate),
    verified_status_without_email: apolloCandidateHasVerifiedStatusWithoutEmail(input.candidate),
  }
}
