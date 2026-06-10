/** Apollo verified-email promotion evidence — client-safe. */

import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

export const APOLLO_VERIFIED_EMAIL_PROMOTION_EVIDENCE_QA_MARKER =
  "apollo-verified-email-promotion-evidence-v1" as const

const NON_CONTACTABLE_APOLLO_EMAIL_STATUSES = new Set([
  "unavailable",
  "invalid",
  "guessed",
  "extrapolated",
])

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readCandidateMetadata(candidate: GrowthContactCandidate): Record<string, unknown> {
  return candidate.metadata && typeof candidate.metadata === "object"
    ? (candidate.metadata as Record<string, unknown>)
    : {}
}

function isContactablePromotionRow(row: Record<string, unknown>): boolean {
  const hasEmail =
    Boolean(asString(row.email)) &&
    asString(row.email_status) !== "blocked" &&
    asString(row.email_status) !== "unknown"
  const hasPhone =
    Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

export function readApolloEmailStatusFromCandidate(
  candidate: GrowthContactCandidate,
): string | null {
  const metadata = readCandidateMetadata(candidate)
  return asString(metadata.apollo_email_status) || null
}

export function readApolloTierUsedFromCandidate(candidate: GrowthContactCandidate): number | null {
  const metadata = readCandidateMetadata(candidate)
  const direct = metadata.apollo_tier_used
  if (typeof direct === "number" && Number.isFinite(direct)) return direct
  const strategy = metadata.apollo_search_strategy
  if (strategy && typeof strategy === "object") {
    const tier = (strategy as Record<string, unknown>).tier_used
    if (typeof tier === "number" && Number.isFinite(tier)) return tier
  }
  return null
}

export function isApolloVerifiedEmailStatus(status: string | null | undefined): boolean {
  return asString(status).toLowerCase() === "verified"
}

export function apolloCandidateHasVerifiedPromotableChannel(
  candidate: GrowthContactCandidate,
): boolean {
  if (candidate.provider_type !== "future_apollo") {
    return candidateHasObservedContactChannel(candidate)
  }

  const email = asString(candidate.email)
  if (email) {
    const status = readApolloEmailStatusFromCandidate(candidate)
    if (!status) return false
    if (isApolloVerifiedEmailStatus(status)) return true
    if (NON_CONTACTABLE_APOLLO_EMAIL_STATUSES.has(status.toLowerCase())) return false
    return false
  }

  return Boolean(asString(candidate.phone) || asString(candidate.linkedin_url))
}

export function resolveApolloCandidateCompanyContactEmailStatus(
  candidate: GrowthContactCandidate,
): GrowthCompanyContact["email_status"] {
  const email = asString(candidate.email)
  if (!email) return "unknown"

  const status = readApolloEmailStatusFromCandidate(candidate)
  if (isApolloVerifiedEmailStatus(status)) return "verified"
  if (status && NON_CONTACTABLE_APOLLO_EMAIL_STATUSES.has(status.toLowerCase())) return "unknown"
  return "discovered"
}

export type ApolloVerifiedEmailPromotionContactBlocker = {
  contact_candidate_id: string | null
  apollo_person_id: string | null
  full_name: string
  email_status: string | null
  tier_used: number | null
  blocker: string | null
  promoted: boolean
  contactable: boolean
  sequence_ready: boolean
  canonical_person_id: string | null
}

export type ApolloVerifiedEmailPromotionEvidence = {
  qa_marker: typeof APOLLO_VERIFIED_EMAIL_PROMOTION_EVIDENCE_QA_MARKER
  verified_email_contacts: number
  canonical_person_created: number
  canonical_person_matched: number
  company_contacts_promoted: number
  contactable_after_promotion: number
  sequence_ready_after_promotion: number
  blockers_by_contact: ApolloVerifiedEmailPromotionContactBlocker[]
}

export function evaluateApolloVerifiedEmailPromotionBlocker(
  candidate: GrowthContactCandidate,
): string | null {
  if (!asString(candidate.full_name)) return "missing_full_name"
  if (!apolloCandidateHasVerifiedPromotableChannel(candidate)) {
    const status = readApolloEmailStatusFromCandidate(candidate)
    if (asString(candidate.email) && !isApolloVerifiedEmailStatus(status)) {
      return status ? `apollo_email_${status}` : "no_verified_email_available"
    }
    return "missing_contact_channel"
  }

  const identity = classifyContactIdentity({
    full_name: candidate.full_name,
    title: candidate.job_title,
    email: candidate.email,
    phone: candidate.phone,
    linkedin_url: candidate.linkedin_url,
    source_type: "public_record",
  })
  if (!identity.eligible_for_canonical_person) return `identity_${identity.classification}`
  return null
}

export function buildApolloVerifiedEmailPromotionContactRow(input: {
  candidate: GrowthContactCandidate
  company_contact?: Record<string, unknown> | null
}): ApolloVerifiedEmailPromotionContactBlocker {
  const metadata = readCandidateMetadata(input.candidate)
  const companyContact = input.company_contact ?? null
  const companyMetadata =
    companyContact?.metadata && typeof companyContact.metadata === "object"
      ? (companyContact.metadata as Record<string, unknown>)
      : {}

  const rowForReadiness =
    companyContact ??
    ({
      full_name: input.candidate.full_name,
      title: input.candidate.job_title,
      email: input.candidate.email,
      phone: input.candidate.phone,
      email_status: resolveApolloCandidateCompanyContactEmailStatus(input.candidate),
      phone_status: input.candidate.phone ? "unknown" : "unknown",
      linkedin_url: input.candidate.linkedin_url,
      canonical_person_id: null,
      metadata: {
        identity_classification: metadata.identity_classification,
        eligible_for_canonical_person: metadata.eligible_for_canonical_person,
        eligible_for_committee: metadata.eligible_for_committee,
      },
    } satisfies Record<string, unknown>)

  const blocker =
    companyContact == null
      ? evaluateApolloVerifiedEmailPromotionBlocker(input.candidate)
      : !asString(companyContact.canonical_person_id) && isSequenceReadyCompanyContact(rowForReadiness) === false
        ? "missing_canonical_person_id"
        : null

  const contactable = isContactablePromotionRow(rowForReadiness)

  return {
    contact_candidate_id: input.candidate.id ?? null,
    apollo_person_id: asString(metadata.apollo_person_id) || null,
    full_name: input.candidate.full_name,
    email_status: readApolloEmailStatusFromCandidate(input.candidate),
    tier_used: readApolloTierUsedFromCandidate(input.candidate),
    blocker,
    promoted: Boolean(companyContact),
    contactable,
    sequence_ready: isSequenceReadyCompanyContact(rowForReadiness),
    canonical_person_id: asString(companyContact?.canonical_person_id) || null,
  }
}

export function countApolloVerifiedEmailCandidates(
  candidates: GrowthContactCandidate[],
): number {
  let verified = 0
  for (const candidate of candidates) {
    if (
      candidate.provider_type === "future_apollo" &&
      isApolloVerifiedEmailStatus(readApolloEmailStatusFromCandidate(candidate)) &&
      asString(candidate.email)
    ) {
      verified += 1
    }
  }
  return verified
}

export function selectApolloVerifiedEmailCandidatesForPromotion(
  candidates: GrowthContactCandidate[],
): GrowthContactCandidate[] {
  return candidates.filter((candidate) => apolloCandidateHasVerifiedPromotableChannel(candidate))
}
