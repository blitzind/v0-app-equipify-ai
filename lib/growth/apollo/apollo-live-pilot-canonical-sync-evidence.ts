/** Apollo live pilot — canonical sync diagnostics (client-safe). */

import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export const APOLLO_LIVE_PILOT_CANONICAL_SYNC_EVIDENCE_QA_MARKER =
  "apollo-live-pilot-canonical-sync-evidence-v1" as const

export type ApolloCandidateChannelCounts = {
  candidate_has_name_count: number
  candidate_has_title_count: number
  candidate_has_email_count: number
  candidate_has_phone_count: number
  candidate_has_linkedin_count: number
}

export type ApolloCanonicalSyncStructuralReason =
  | "canonical_company_id_unresolved"
  | "schema_not_ready"
  | "insert_failed"
  | "missing_full_name"

const STRUCTURAL_SYNC_REASONS = new Set<string>([
  "canonical_company_id_unresolved",
  "schema_not_ready",
  "insert_failed",
  "missing_full_name",
  "missing_company_candidate_and_canonical_id",
])

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function summarizeApolloCandidateChannelCounts(
  candidates: GrowthContactCandidate[],
): ApolloCandidateChannelCounts {
  let candidate_has_name_count = 0
  let candidate_has_title_count = 0
  let candidate_has_email_count = 0
  let candidate_has_phone_count = 0
  let candidate_has_linkedin_count = 0

  for (const candidate of candidates) {
    if (asString(candidate.full_name)) candidate_has_name_count += 1
    if (asString(candidate.job_title)) candidate_has_title_count += 1
    if (asString(candidate.email)) candidate_has_email_count += 1
    if (asString(candidate.phone)) candidate_has_phone_count += 1
    if (asString(candidate.linkedin_url)) candidate_has_linkedin_count += 1
  }

  return {
    candidate_has_name_count,
    candidate_has_title_count,
    candidate_has_email_count,
    candidate_has_phone_count,
    candidate_has_linkedin_count,
  }
}

export function candidateHasObservedContactChannel(candidate: GrowthContactCandidate): boolean {
  return Boolean(
    asString(candidate.email) || asString(candidate.phone) || asString(candidate.linkedin_url),
  )
}

export function isApolloSearchOnlyMissingContactChannels(input: {
  candidates_stored: number
  channel_counts: ApolloCandidateChannelCounts
  rejection_reasons: Record<string, number>
}): boolean {
  if (input.candidates_stored <= 0) return false
  if (hasStructuralCanonicalSyncReason(input.rejection_reasons)) return false

  const allNamed =
    input.channel_counts.candidate_has_name_count >= input.candidates_stored
  const noneHaveChannels =
    input.channel_counts.candidate_has_email_count === 0 &&
    input.channel_counts.candidate_has_phone_count === 0 &&
    input.channel_counts.candidate_has_linkedin_count === 0

  if (!allNamed || !noneHaveChannels) return false

  const missingChannelRejections = input.rejection_reasons.missing_contact_channel ?? 0
  return missingChannelRejections > 0
}

export function hasStructuralCanonicalSyncReason(
  rejection_reasons: Record<string, number>,
): boolean {
  return Object.keys(rejection_reasons).some((key) => STRUCTURAL_SYNC_REASONS.has(key))
}

export function mergeCanonicalSyncRejectionReasons(
  resolutionDiagnostics: string[] | null | undefined,
  candidateReasons: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...candidateReasons }
  for (const diagnostic of resolutionDiagnostics ?? []) {
    if (diagnostic.includes("canonical company id could not be resolved")) {
      merged.canonical_company_id_unresolved =
        (merged.canonical_company_id_unresolved ?? 0) + 1
    }
  }
  return merged
}
