/** Apollo EN-3 promotion evidence helpers — client-safe. */

import {
  apolloCandidateHasVerifiedPromotableChannel,
  countApolloVerifiedEmailCandidates,
  selectApolloVerifiedEmailCandidatesForPromotion,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

export const APOLLO_ENRICHMENT_CERT_PROMOTION_EVIDENCE_QA_MARKER =
  "apollo-enrichment-cert-promotion-evidence-en-3-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function countEnrichedCandidateChannels(
  candidates: GrowthContactCandidate[],
): { with_email: number; with_linkedin: number; with_channel: number } {
  let with_email = 0
  let with_linkedin = 0
  let with_channel = 0
  for (const candidate of candidates) {
    if (asString(candidate.email)) with_email += 1
    if (asString(candidate.linkedin_url)) with_linkedin += 1
    if (candidateHasObservedContactChannel(candidate)) with_channel += 1
  }
  return { with_email, with_linkedin, with_channel }
}

export function selectApolloCandidatesForPromotion(
  candidates: GrowthContactCandidate[],
): GrowthContactCandidate[] {
  const apollo = candidates.filter((candidate) => candidate.provider_type === "future_apollo")
  if (apollo.length > 0) {
    return selectApolloVerifiedEmailCandidatesForPromotion(candidates)
  }
  return candidates.filter((candidate) => candidateHasObservedContactChannel(candidate))
}

export function countVerifiedApolloCandidateChannels(
  candidates: GrowthContactCandidate[],
): { with_verified_email: number; with_linkedin: number; with_channel: number } {
  let with_linkedin = 0
  let with_channel = 0
  for (const candidate of candidates) {
    if (asString(candidate.linkedin_url)) with_linkedin += 1
    if (apolloCandidateHasVerifiedPromotableChannel(candidate)) with_channel += 1
  }
  return {
    with_verified_email: countApolloVerifiedEmailCandidates(candidates),
    with_linkedin,
    with_channel,
  }
}

export function buildApolloEnrichmentPromotionBlockers(input: {
  canonical_company_id: string | null
  candidates_with_channel: number
  resolution_diagnostics?: string[] | null
  rejection_reasons: Record<string, number>
}): string[] {
  const blockers: string[] = []
  if (!input.canonical_company_id) {
    blockers.push("canonical_company_id_unresolved")
    for (const diagnostic of input.resolution_diagnostics ?? []) {
      if (diagnostic && !blockers.includes(diagnostic)) blockers.push(diagnostic)
    }
  }
  if (input.candidates_with_channel === 0) {
    blockers.push("no_enriched_candidates_with_contact_channel")
  }
  for (const [reason, count] of Object.entries(input.rejection_reasons)) {
    if (count <= 0) continue
    blockers.push(`${reason}:${count}`)
  }
  return blockers
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

export function isSequenceReadyCompanyContact(row: Record<string, unknown>): boolean {
  if (!isContactableCompanyContact(row)) return false
  if (!asString(row.canonical_person_id)) return false

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {}
  const classification = asString(metadata.identity_classification)
  if (classification === "company_channel" || classification === "generic_placeholder") {
    return false
  }
  if (metadata.eligible_for_canonical_person === false) return false

  const identity = classifyContactIdentity({
    full_name: asString(row.full_name),
    title: asString(row.title) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    source_type: "public_record",
  })
  return identity.eligible_for_canonical_person && identity.eligible_for_committee !== false
}

export function apolloContactDiscoverySourceType(providerType: string): "public_record" | "manual" {
  if (providerType.includes("apollo")) return "public_record"
  return "manual"
}
