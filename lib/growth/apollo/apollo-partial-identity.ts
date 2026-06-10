/** Apollo partial-identity staging — strong org match with initial-only names. Client-safe. */

import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { personOrganizationMatchesTarget } from "@/lib/growth/providers/apollo/apollo-org-match"
import { isApolloObfuscatedLastNameToken } from "@/lib/growth/providers/apollo/apollo-search-person-normalize"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import {
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { ApolloPeopleMappingContext } from "@/lib/growth/providers/apollo/map-apollo-contact"

export const APOLLO_PARTIAL_IDENTITY_QA_MARKER = "apollo-partial-identity-v1" as const

export const APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY = "partial_identity" as const
export const APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT = "needs_identity_enrichment" as const
export const APOLLO_IDENTITY_STATUS_ENRICHED = "identity_enriched" as const
export const APOLLO_IDENTITY_STATUS_UNRESOLVED = "identity_partial_unresolved" as const
export const APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON = "strong_org_partial_person" as const

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

export function isApolloPartialInitialOnlyName(
  full_name: string,
  person?: ApolloPersonRecord | null,
): boolean {
  const words = full_name.trim().split(/\s+/).filter(Boolean)
  if (words.length !== 2) return false

  const first = words[0]!
  const second = words[1]!
  if (!/^[A-Za-z][A-Za-z.'-]*$/.test(first) || first.length < 2) return false

  if (/^[A-Za-z]\.?$/.test(second)) return true
  if (person && isApolloObfuscatedLastNameToken(second)) return true
  return false
}

export function hasApolloStrongOrganizationDomainMatch(
  person: ApolloPersonRecord,
  input: Pick<ApolloPeopleMappingContext, "domain" | "company_name">,
): boolean {
  return (
    personOrganizationMatchesTarget(person, input.domain, input.company_name) === true
  )
}

export function hasApolloRealTitle(person: ApolloPersonRecord): boolean {
  return Boolean(asTrimmedString(person.title) ?? asTrimmedString(person.headline))
}

export function evaluateApolloPartialIdentityStaging(input: {
  person: ApolloPersonRecord
  mapped: GrowthContactDiscoveryProviderRawContact
  context: ApolloPeopleMappingContext
  rejection_reason: string | null
}): { eligible: boolean; reason: string | null } {
  if (!hasApolloRealTitle(input.person)) {
    return { eligible: false, reason: "missing_title" }
  }
  if (!hasApolloStrongOrganizationDomainMatch(input.person, input.context)) {
    return { eligible: false, reason: "organization_not_confirmed" }
  }
  if (!isApolloPartialInitialOnlyName(input.mapped.full_name, input.person)) {
    return { eligible: false, reason: "not_partial_initial_name" }
  }

  const allowedRejections = new Set([
    "name_not_plausible",
    "missing_full_name",
  ])
  if (
    input.rejection_reason &&
    !allowedRejections.has(input.rejection_reason) &&
    !input.rejection_reason.startsWith("identity_")
  ) {
    return { eligible: false, reason: input.rejection_reason }
  }

  return { eligible: true, reason: null }
}

export function applyApolloPartialIdentityToMappedContact(
  mapped: GrowthContactDiscoveryProviderRawContact,
): GrowthContactDiscoveryProviderRawContact {
  return {
    ...mapped,
    metadata: {
      ...(mapped.metadata && typeof mapped.metadata === "object" ? mapped.metadata : {}),
      qa_marker: APOLLO_PARTIAL_IDENTITY_QA_MARKER,
      candidate_quality: APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY,
      identity_status: APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
      apollo_match_strength: APOLLO_MATCH_STRENGTH_STRONG_ORG_PARTIAL_PERSON,
      contactable: false,
      sequence_ready: false,
      apollo_partial_identity_staged: true,
      eligible_for_canonical_person: false,
      eligible_for_committee: false,
    },
  }
}

export function isApolloPartialIdentityMappedContact(
  contact: GrowthContactDiscoveryProviderRawContact | GrowthContactCandidate,
): boolean {
  const metadata =
    contact.metadata && typeof contact.metadata === "object"
      ? (contact.metadata as Record<string, unknown>)
      : {}
  return (
    metadata.candidate_quality === APOLLO_CANDIDATE_QUALITY_PARTIAL_IDENTITY ||
    metadata.apollo_partial_identity_staged === true
  )
}

export function readApolloPartialIdentityStatus(
  candidate: GrowthContactCandidate | Record<string, unknown>,
): string | null {
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  return asTrimmedString(metadata.identity_status)
}

export function isApolloPartialIdentityNameResolved(full_name: string): boolean {
  return isPlausiblePersonName(full_name)
}

export function isApolloPartialIdentityCandidateResolved(
  candidate: GrowthContactCandidate,
): boolean {
  if (!isApolloPartialIdentityMappedContact(candidate)) return true
  if (isApolloPartialIdentityNameResolved(candidate.full_name)) return true
  const status = readApolloPartialIdentityStatus(candidate)
  return status === APOLLO_IDENTITY_STATUS_ENRICHED
}

export function canPromoteApolloPartialIdentityCandidate(
  candidate: GrowthContactCandidate,
): boolean {
  if (!isApolloPartialIdentityMappedContact(candidate)) return true
  if (isApolloPartialIdentityCandidateResolved(candidate)) return true
  const email = asTrimmedString(candidate.email)
  const status = readApolloEmailStatusFromCandidate(candidate)
  if (email && isApolloVerifiedEmailStatus(status)) return true
  return false
}

export function resolveIdentityFromLinkedInSlug(linkedin_url: string): string | null {
  const match = linkedin_url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (!match?.[1]) return null

  const slug = decodeURIComponent(match[1])
    .replace(/%[0-9a-f]{2}/gi, " ")
    .replace(/[-_]+/g, " ")
    .trim()
  if (!slug) return null

  const normalized = slug
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ")

  return isPlausiblePersonName(normalized) ? normalized : null
}

export function buildApolloPartialIdentityPromotionBlocker(
  candidate: GrowthContactCandidate,
): string | null {
  if (!isApolloPartialIdentityMappedContact(candidate)) return null
  if (canPromoteApolloPartialIdentityCandidate(candidate)) return null
  return "partial_identity_unresolved"
}
