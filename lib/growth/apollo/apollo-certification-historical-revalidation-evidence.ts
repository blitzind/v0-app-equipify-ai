/** Apollo certification historical revalidation evidence — client-safe. */

import { readApolloPersonIdFromCandidate } from "@/lib/growth/apollo/apollo-email-channel-evidence"
import type { ApolloCurrentRunAttributionSource } from "@/lib/growth/apollo/apollo-search-domain-aliases"
import {
  isApolloVerifiedEmailStatus,
  readApolloEmailStatusFromCandidate,
} from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export const APOLLO_CERTIFICATION_HISTORICAL_REVALIDATION_QA_MARKER =
  "apollo-certification-historical-revalidation-v1" as const

export type ApolloScale3CertificationMode = "greenfield" | "certification_winners_revalidation"

export type ApolloHistoricalRevalidationCandidate = {
  contact_candidate_id: string
  full_name: string
  apollo_person_id: string
  email: string
  attribution_source: "historical_revalidated_apollo_candidate"
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isApolloHistoricalRevalidationCandidate(
  candidate: GrowthContactCandidate,
): boolean {
  if (candidate.provider_type !== "future_apollo") return false
  if (!readApolloPersonIdFromCandidate(candidate)) return false
  const status = readApolloEmailStatusFromCandidate(candidate)
  return isApolloVerifiedEmailStatus(status) && Boolean(asString(candidate.email))
}

export function readApolloHistoricalRevalidationPersonIds(
  candidates: ApolloHistoricalRevalidationCandidate[],
): string[] {
  return [...new Set(candidates.map((candidate) => candidate.apollo_person_id).filter(Boolean))]
}

export function resolveApolloCurrentRunAttributionSource(input: {
  fresh_search_contacts_found: number
  historical_revalidated_contacts_found: number
}): ApolloCurrentRunAttributionSource | null {
  const fresh = input.fresh_search_contacts_found > 0
  const historical = input.historical_revalidated_contacts_found > 0
  if (fresh && historical) return "mixed"
  if (fresh) return "fresh_search"
  if (historical) return "historical_revalidated"
  return null
}

export function resolveApolloScale3CertificationMode(input: {
  cohort_preset?: string | null
  certification_mode?: ApolloScale3CertificationMode | null
}): ApolloScale3CertificationMode {
  if (input.certification_mode) return input.certification_mode
  if (input.cohort_preset === "certification_winners") {
    return "certification_winners_revalidation"
  }
  return "greenfield"
}

export type { ApolloCurrentRunAttributionSource }
