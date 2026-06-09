/** Apollo live pilot provider evidence — client-safe diagnostics. */

import type { GrowthContactDiscoveryProviderResult } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { ApolloRedactedRejectionSample } from "@/lib/growth/providers/apollo/map-apollo-contact"

export const APOLLO_LIVE_PILOT_PROVIDER_EVIDENCE_QA_MARKER =
  "apollo-live-pilot-provider-evidence-v1" as const

export type ApolloLivePilotProviderClassification =
  | "apollo_zero_results"
  | "apollo_results_rejected_by_mapping"
  | "apollo_results_rejected_by_icp_title"
  | "apollo_results_rejected_by_canonical_sync"
  | "apollo_results_rejected_non_person_rows"
  | "apollo_success"

const NON_PERSON_REJECTION_REASONS = new Set([
  "name_not_plausible",
  "map_failed",
  "missing_full_name",
  "company_channel_or_generic",
])

export type ApolloLivePilotProviderEvidence = {
  qa_marker: typeof APOLLO_LIVE_PILOT_PROVIDER_EVIDENCE_QA_MARKER
  apollo_people_returned: number
  apollo_total_matches: number
  apollo_people_mapped: number
  apollo_people_rejected: number
  candidates_stored: number
  company_contacts_synced: number
  canonical_sync_rejected: number
  rejection_reasons: Record<string, number>
  title_bucket_rejections: Record<string, number>
  missing_email_count: number
  missing_phone_count: number
  rejected_sample: ApolloRedactedRejectionSample | null
  classification: ApolloLivePilotProviderClassification
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, number> = {}
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count)) out[key] = count
  }
  return out
}

function readRejectedSample(value: unknown): ApolloRedactedRejectionSample | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.rejection_reason !== "string") return null
  const rawFirstNamePresent = record.raw_first_name_present === true
  const rawLastNamePresent = record.raw_last_name_present === true
  const rawNamePresent =
    record.raw_name_present === true ||
    (record.name_present === true && !rawFirstNamePresent && !rawLastNamePresent)
  const mappedFullNamePresent =
    record.mapped_full_name_present === true ||
    (record.name_present === true && (rawFirstNamePresent || rawLastNamePresent))
  return {
    available_name_keys: Array.isArray(record.available_name_keys)
      ? record.available_name_keys.filter((key): key is string => typeof key === "string")
      : [],
    available_person_keys: Array.isArray(record.available_person_keys)
      ? record.available_person_keys.filter((key): key is string => typeof key === "string")
      : [],
    first_name_present: record.first_name_present === true,
    last_name_present: record.last_name_present === true,
    name_present: record.name_present === true || rawNamePresent,
    full_name_present: record.full_name_present === true || mappedFullNamePresent,
    person_id_present: record.person_id_present === true,
    last_name_obfuscated_present: record.last_name_obfuscated_present === true,
    raw_first_name_present: rawFirstNamePresent,
    raw_last_name_present: rawLastNamePresent,
    raw_name_present: rawNamePresent,
    mapped_full_name_present: mappedFullNamePresent,
    title: typeof record.title === "string" ? record.title : null,
    seniority: typeof record.seniority === "string" ? record.seniority : null,
    organization_domain:
      typeof record.organization_domain === "string" ? record.organization_domain : null,
    email_present: record.email_present === true,
    phone_present: record.phone_present === true,
    rejection_reason: record.rejection_reason,
  }
}

export function isLikelyNonPersonApolloRow(
  sample: ApolloRedactedRejectionSample | null,
  rejection_reasons: Record<string, number>,
): boolean {
  const keys = Object.keys(rejection_reasons)
  if (keys.length === 0) return false
  if (!keys.every((key) => NON_PERSON_REJECTION_REASONS.has(key) || key.startsWith("identity_"))) {
    return false
  }
  if (!sample) return false

  if (
    sample.raw_name_present &&
    !sample.raw_first_name_present &&
    !sample.raw_last_name_present
  ) {
    return true
  }

  if (
    (rejection_reasons.name_not_plausible ?? 0) > 0 &&
    !sample.raw_first_name_present &&
    !sample.raw_last_name_present
  ) {
    return true
  }

  if ((rejection_reasons.map_failed ?? 0) > 0 || (rejection_reasons.missing_full_name ?? 0) > 0) {
    return !sample.raw_first_name_present && !sample.raw_last_name_present && !sample.mapped_full_name_present
  }

  return false
}

export function buildApolloLivePilotProviderEvidence(input: {
  provider_result: GrowthContactDiscoveryProviderResult | null
  candidates_stored: number
  company_contacts_synced: number
  canonical_sync_rejected: number
}): ApolloLivePilotProviderEvidence {
  const metadata =
    input.provider_result?.metadata && typeof input.provider_result.metadata === "object"
      ? (input.provider_result.metadata as Record<string, unknown>)
      : {}
  const diagnostics =
    metadata.apollo_diagnostics && typeof metadata.apollo_diagnostics === "object"
      ? (metadata.apollo_diagnostics as Record<string, unknown>)
      : {}

  const apollo_people_returned = asNumber(
    metadata.apollo_people_returned,
    asNumber(diagnostics.result_count, input.provider_result?.contacts.length ?? 0),
  )
  const apollo_total_matches = asNumber(metadata.apollo_total_matches, asNumber(metadata.apollo_total))
  const apollo_people_mapped = asNumber(
    metadata.apollo_people_mapped,
    input.provider_result?.contacts.length ?? 0,
  )
  const apollo_people_rejected = asNumber(
    metadata.apollo_people_rejected,
    Math.max(0, apollo_people_returned - apollo_people_mapped),
  )

  const rejection_reasons = asRecord(metadata.rejection_reasons ?? diagnostics.skip_reasons)
  const title_bucket_rejections = asRecord(metadata.title_bucket_rejections)

  const evidence: ApolloLivePilotProviderEvidence = {
    qa_marker: APOLLO_LIVE_PILOT_PROVIDER_EVIDENCE_QA_MARKER,
    apollo_people_returned,
    apollo_total_matches,
    apollo_people_mapped,
    apollo_people_rejected,
    candidates_stored: input.candidates_stored,
    company_contacts_synced: input.company_contacts_synced,
    canonical_sync_rejected: input.canonical_sync_rejected,
    rejection_reasons,
    title_bucket_rejections,
    missing_email_count: asNumber(metadata.missing_email_count),
    missing_phone_count: asNumber(metadata.missing_phone_count),
    rejected_sample: readRejectedSample(metadata.apollo_rejected_sample),
    classification: "apollo_success",
  }

  evidence.classification = classifyApolloLivePilotProviderEvidence(evidence)
  return evidence
}

export function classifyApolloLivePilotProviderEvidence(
  evidence: ApolloLivePilotProviderEvidence,
): ApolloLivePilotProviderClassification {
  if (evidence.apollo_people_returned === 0) {
    return "apollo_zero_results"
  }

  if (evidence.apollo_people_mapped === 0) {
    if ((evidence.rejection_reasons.irrelevant_title ?? 0) > 0) {
      return "apollo_results_rejected_by_icp_title"
    }
    if (isLikelyNonPersonApolloRow(evidence.rejected_sample, evidence.rejection_reasons)) {
      return "apollo_results_rejected_non_person_rows"
    }
    return "apollo_results_rejected_by_mapping"
  }

  if (
    evidence.candidates_stored > 0 &&
    evidence.company_contacts_synced === 0 &&
    evidence.canonical_sync_rejected > 0
  ) {
    return "apollo_results_rejected_by_canonical_sync"
  }

  if (
    evidence.apollo_people_mapped > 0 &&
    evidence.candidates_stored === 0
  ) {
    return "apollo_results_rejected_by_mapping"
  }

  if (
    evidence.candidates_stored > 0 &&
    evidence.company_contacts_synced < evidence.candidates_stored &&
    evidence.canonical_sync_rejected > 0
  ) {
    return "apollo_results_rejected_by_canonical_sync"
  }

  return "apollo_success"
}

export function buildApolloLivePilotProviderDiscoveryError(
  evidence: ApolloLivePilotProviderEvidence,
): string | null {
  switch (evidence.classification) {
    case "apollo_zero_results":
      return `[contact_discovery_apollo_zero_results] ApolloZeroResults: Apollo returned zero people (${evidence.apollo_total_matches} total matches).`
    case "apollo_results_rejected_by_mapping":
      return `[contact_discovery_apollo_results_rejected_by_mapping] ApolloResultsRejectedByMapping: Apollo returned ${evidence.apollo_people_returned} people but mapped ${evidence.apollo_people_mapped}; rejection_reasons=${JSON.stringify(evidence.rejection_reasons)}`
    case "apollo_results_rejected_by_icp_title":
      return `[contact_discovery_apollo_results_rejected_by_icp_title] ApolloResultsRejectedByIcpTitle: Apollo returned ${evidence.apollo_people_returned} people but ICP/title filters rejected all; title_bucket_rejections=${JSON.stringify(evidence.title_bucket_rejections)}`
    case "apollo_results_rejected_by_canonical_sync":
      return `[contact_discovery_apollo_results_rejected_by_canonical_sync] ApolloResultsRejectedByCanonicalSync: Mapped ${evidence.apollo_people_mapped} but synced ${evidence.company_contacts_synced}; canonical_sync_rejected=${evidence.canonical_sync_rejected}`
    case "apollo_results_rejected_non_person_rows":
      return `[contact_discovery_apollo_results_rejected_non_person_rows] ApolloResultsRejectedNonPersonRows: Apollo returned ${evidence.apollo_people_returned} row(s) but all appear to be non-person/company/account records; rejection_reasons=${JSON.stringify(evidence.rejection_reasons)}`
    case "apollo_success":
      return null
  }
}

export function logApolloLivePilotProviderEvidence(
  evidence: ApolloLivePilotProviderEvidence,
): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event: "apollo_live_pilot_provider_evidence",
      ts: new Date().toISOString(),
      classification: evidence.classification,
      apollo_people_returned: evidence.apollo_people_returned,
      apollo_total_matches: evidence.apollo_total_matches,
      apollo_people_mapped: evidence.apollo_people_mapped,
      apollo_people_rejected: evidence.apollo_people_rejected,
      candidates_stored: evidence.candidates_stored,
      company_contacts_synced: evidence.company_contacts_synced,
      rejection_reasons: evidence.rejection_reasons,
      title_bucket_rejections: evidence.title_bucket_rejections,
      missing_email_count: evidence.missing_email_count,
      missing_phone_count: evidence.missing_phone_count,
      rejected_sample: evidence.rejected_sample,
    }),
  )
}
