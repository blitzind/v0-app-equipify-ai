/**
 * GE-EI-IMP-4E — Email Learning shadow vs reconstruction parity (diagnostic only).
 * Compares historical reconstructed observations against live shadow observations.
 * Client-safe. No persistence. No runtime influence.
 */

import {
  buildEmailLearningDedupeKey,
  GROWTH_EMAIL_LEARNING_QA_MARKER,
  type EmailLearningEventSource,
  type EmailLearningObservation,
  type EmailLearningOutcomeType,
} from "@/lib/growth/contact-verification/email-learning"
import type { EmailLearningShadowLogEntry } from "@/lib/growth/contact-verification/email-learning-shadow"

export const GROWTH_EMAIL_LEARNING_PARITY_QA_MARKER = "growth-email-learning-parity-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export type EmailLearningShadowParityInput = EmailLearningObservation | EmailLearningShadowLogEntry

export type EmailLearningParityCoverageSlice = {
  reconstructed_count: number
  shadow_count: number
  matched_count: number
  missing_from_shadow: number
  extra_in_shadow: number
}

export type EmailLearningParityFuzzyMatch = {
  reconstructed_observation_id: string
  shadow_observation_id: string
  match_key: string
}

export type EmailLearningParityComparison = {
  reconstructed_count: number
  shadow_count: number
  strict_matched_count: number
  fuzzy_matched_count: number
  matched_count: number
  missing_from_shadow: number
  extra_in_shadow: number
  strict_matched_observation_ids: string[]
  missing_observation_ids: string[]
  extra_observation_ids: string[]
  fuzzy_matches: EmailLearningParityFuzzyMatch[]
  warnings: string[]
}

export type EmailLearningParityReport = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_PARITY_QA_MARKER
  reconstructed_count: number
  shadow_count: number
  matched_count: number
  missing_from_shadow: number
  extra_in_shadow: number
  event_type_coverage: Record<string, EmailLearningParityCoverageSlice>
  domain_coverage: Record<string, EmailLearningParityCoverageSlice>
  source_coverage: Record<string, EmailLearningParityCoverageSlice>
  warnings: string[]
  context?: Record<string, unknown>
  comparison: EmailLearningParityComparison
}

type ParitySide = "reconstructed" | "shadow"

type NormalizedParityRecord = {
  side: ParitySide
  observation_id: string
  dedupe_key: string
  event_type: string
  domain: string | null
  source: string
  timestamp_bucket: string | null
  fuzzy_key: string
}

function isShadowLogEntry(input: EmailLearningShadowParityInput): input is EmailLearningShadowLogEntry {
  return "shadow" in input && input.shadow === "email_learning_observation"
}

function bucketTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return null
  const date = new Date(parsed)
  date.setUTCMinutes(0, 0, 0)
  return date.toISOString()
}

function buildFuzzyKey(input: {
  eventType: string
  domain: string | null
  source: string
  timestampBucket: string | null
  includeTimestamp?: boolean
}): string {
  return [
    input.eventType.trim().toLowerCase(),
    input.domain?.trim().toLowerCase() ?? "_",
    input.source.trim().toLowerCase(),
    input.includeTimestamp === false ? "_" : (input.timestampBucket ?? "_"),
  ].join("|")
}

function fuzzyKeysForRecord(row: NormalizedParityRecord): string[] {
  const withTimestamp = row.fuzzy_key
  const withoutTimestamp = buildFuzzyKey({
    eventType: row.event_type,
    domain: row.domain,
    source: row.source,
    timestampBucket: row.timestamp_bucket,
    includeTimestamp: false,
  })
  if (withTimestamp === withoutTimestamp) return [withTimestamp]
  return [withTimestamp, withoutTimestamp]
}

function dedupeKeyForObservation(observation: EmailLearningObservation): string {
  const metadataDedupeKey =
    typeof observation.metadata.dedupe_key === "string" ? observation.metadata.dedupe_key : null
  return buildEmailLearningDedupeKey({
    normalizedEmail: observation.normalized_email,
    eventType: observation.event_type,
    eventTimestamp: observation.event_timestamp,
    source: observation.source,
    dedupeKey: metadataDedupeKey,
    campaignId: observation.campaign_id,
    contactId: observation.contact_id,
  })
}

export function normalizeEmailLearningObservationForParity(
  input: EmailLearningObservation,
  side: ParitySide,
): NormalizedParityRecord {
  const dedupeKey = dedupeKeyForObservation(input)
  const timestampBucket = bucketTimestamp(input.event_timestamp)
  return {
    side,
    observation_id: input.observation_id,
    dedupe_key: dedupeKey,
    event_type: input.event_type,
    domain: input.domain,
    source: input.source,
    timestamp_bucket: timestampBucket,
    fuzzy_key: buildFuzzyKey({
      eventType: input.event_type,
      domain: input.domain,
      source: input.source,
      timestampBucket,
    }),
  }
}

export function normalizeEmailLearningShadowLogForParity(
  input: EmailLearningShadowLogEntry,
): NormalizedParityRecord {
  const timestampBucket = null
  return {
    side: "shadow",
    observation_id: input.observation_id,
    dedupe_key: input.observation_id,
    event_type: input.event_type,
    domain: input.domain,
    source: input.source,
    timestamp_bucket: timestampBucket,
    fuzzy_key: buildFuzzyKey({
      eventType: input.event_type,
      domain: input.domain,
      source: input.source,
      timestampBucket,
    }),
  }
}

export function normalizeEmailLearningShadowParityInput(
  input: EmailLearningShadowParityInput,
  side: ParitySide,
): NormalizedParityRecord {
  if (isShadowLogEntry(input)) return normalizeEmailLearningShadowLogForParity(input)
  return normalizeEmailLearningObservationForParity(input, side)
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function buildCoverageMap(
  reconstructed: readonly NormalizedParityRecord[],
  shadow: readonly NormalizedParityRecord[],
  matchedReconstructedIds: ReadonlySet<string>,
  matchedShadowIds: ReadonlySet<string>,
  keySelector: (row: NormalizedParityRecord) => string,
): Record<string, EmailLearningParityCoverageSlice> {
  const keys = sortStrings([
    ...new Set([...reconstructed, ...shadow].map(keySelector)),
  ])
  const coverage: Record<string, EmailLearningParityCoverageSlice> = {}

  for (const key of keys) {
    const reconstructedRows = reconstructed.filter((row) => keySelector(row) === key)
    const shadowRows = shadow.filter((row) => keySelector(row) === key)
    const matchedReconstructed = reconstructedRows.filter((row) => matchedReconstructedIds.has(row.observation_id))
    const matchedShadow = shadowRows.filter((row) => matchedShadowIds.has(row.observation_id))
    const matchedCount = Math.min(matchedReconstructed.length, matchedShadow.length)

    coverage[key] = {
      reconstructed_count: reconstructedRows.length,
      shadow_count: shadowRows.length,
      matched_count: matchedCount,
      missing_from_shadow: Math.max(0, reconstructedRows.length - matchedReconstructed.length),
      extra_in_shadow: Math.max(0, shadowRows.length - matchedShadow.length),
    }
  }

  return coverage
}

export function compareEmailLearningObservationSets(input: {
  reconstructed: readonly EmailLearningObservation[]
  shadow: readonly EmailLearningShadowParityInput[]
}): EmailLearningParityComparison {
  const warnings: string[] = []
  const reconstructed = input.reconstructed.map((row) =>
    normalizeEmailLearningObservationForParity(row, "reconstructed"),
  )
  const shadow = input.shadow.map((row) => normalizeEmailLearningShadowParityInput(row, "shadow"))

  if (reconstructed.length === 0 && shadow.length === 0) {
    warnings.push("empty_observation_sets")
  }

  const shadowByObservationId = new Map(shadow.map((row) => [row.observation_id, row]))
  const shadowByDedupeKey = new Map(shadow.map((row) => [row.dedupe_key, row]))
  const matchedShadowIds = new Set<string>()
  const matchedReconstructedIds = new Set<string>()
  const strictMatchedIds: string[] = []
  const fuzzyMatches: EmailLearningParityFuzzyMatch[] = []

  for (const reconstructedRow of reconstructed) {
    const strictShadow =
      shadowByObservationId.get(reconstructedRow.observation_id) ??
      shadowByDedupeKey.get(reconstructedRow.dedupe_key) ??
      null

    if (strictShadow && !matchedShadowIds.has(strictShadow.observation_id)) {
      matchedShadowIds.add(strictShadow.observation_id)
      matchedReconstructedIds.add(reconstructedRow.observation_id)
      strictMatchedIds.push(reconstructedRow.observation_id)
    }
  }

  const unmatchedReconstructed = reconstructed.filter(
    (row) => !matchedReconstructedIds.has(row.observation_id),
  )
  const unmatchedShadow = shadow.filter((row) => !matchedShadowIds.has(row.observation_id))

  const shadowByFuzzyKey = new Map<string, NormalizedParityRecord[]>()
  for (const row of unmatchedShadow) {
    for (const fuzzyKey of fuzzyKeysForRecord(row)) {
      const bucket = shadowByFuzzyKey.get(fuzzyKey) ?? []
      if (!bucket.includes(row)) bucket.push(row)
      shadowByFuzzyKey.set(fuzzyKey, bucket)
    }
  }

  for (const reconstructedRow of unmatchedReconstructed) {
    const candidateKeys = fuzzyKeysForRecord(reconstructedRow)
    let candidate: NormalizedParityRecord | undefined
    let matchKey: string | undefined

    for (const fuzzyKey of candidateKeys) {
      const candidates = shadowByFuzzyKey.get(fuzzyKey) ?? []
      candidate = candidates.find((row) => !matchedShadowIds.has(row.observation_id))
      if (candidate) {
        matchKey = fuzzyKey
        break
      }
    }

    if (!candidate || !matchKey) continue

    matchedShadowIds.add(candidate.observation_id)
    matchedReconstructedIds.add(reconstructedRow.observation_id)
    fuzzyMatches.push({
      reconstructed_observation_id: reconstructedRow.observation_id,
      shadow_observation_id: candidate.observation_id,
      match_key: matchKey,
    })
  }

  fuzzyMatches.sort(
    (a, b) =>
      a.match_key.localeCompare(b.match_key) ||
      a.reconstructed_observation_id.localeCompare(b.reconstructed_observation_id) ||
      a.shadow_observation_id.localeCompare(b.shadow_observation_id),
  )

  const missingObservationIds = sortStrings(
    reconstructed
      .filter((row) => !matchedReconstructedIds.has(row.observation_id))
      .map((row) => row.observation_id),
  )
  const extraObservationIds = sortStrings(
    shadow
      .filter((row) => !matchedShadowIds.has(row.observation_id))
      .map((row) => row.observation_id),
  )

  if (fuzzyMatches.length > 0) {
    warnings.push("fuzzy_matches_applied")
  }
  if (missingObservationIds.length > 0) {
    warnings.push("missing_from_shadow")
  }
  if (extraObservationIds.length > 0) {
    warnings.push("extra_in_shadow")
  }

  const strictMatchedCount = strictMatchedIds.length
  const fuzzyMatchedCount = fuzzyMatches.length
  const matchedCount = strictMatchedCount + fuzzyMatchedCount

  return {
    reconstructed_count: reconstructed.length,
    shadow_count: shadow.length,
    strict_matched_count: strictMatchedCount,
    fuzzy_matched_count: fuzzyMatchedCount,
    matched_count: matchedCount,
    missing_from_shadow: missingObservationIds.length,
    extra_in_shadow: extraObservationIds.length,
    strict_matched_observation_ids: sortStrings(strictMatchedIds),
    missing_observation_ids: missingObservationIds,
    extra_observation_ids: extraObservationIds,
    fuzzy_matches: fuzzyMatches,
    warnings: sortStrings([...new Set(warnings)]),
  }
}

export function summarizeEmailLearningParity(
  comparison: EmailLearningParityComparison,
): Pick<
  EmailLearningParityReport,
  | "reconstructed_count"
  | "shadow_count"
  | "matched_count"
  | "missing_from_shadow"
  | "extra_in_shadow"
  | "warnings"
> {
  return {
    reconstructed_count: comparison.reconstructed_count,
    shadow_count: comparison.shadow_count,
    matched_count: comparison.matched_count,
    missing_from_shadow: comparison.missing_from_shadow,
    extra_in_shadow: comparison.extra_in_shadow,
    warnings: comparison.warnings,
  }
}

export function buildEmailLearningParityReport(input: {
  reconstructed: readonly EmailLearningObservation[]
  shadow: readonly EmailLearningShadowParityInput[]
  context?: Record<string, unknown>
}): EmailLearningParityReport {
  const comparison = compareEmailLearningObservationSets(input)
  const reconstructedRecords = input.reconstructed.map((row) =>
    normalizeEmailLearningObservationForParity(row, "reconstructed"),
  )
  const shadowRecords = input.shadow.map((row) => normalizeEmailLearningShadowParityInput(row, "shadow"))

  const matchedReconstructedIds = new Set([
    ...comparison.strict_matched_observation_ids,
    ...comparison.fuzzy_matches.map((row) => row.reconstructed_observation_id),
  ])
  const matchedShadowIds = new Set([
    ...comparison.strict_matched_observation_ids,
    ...comparison.fuzzy_matches.map((row) => row.shadow_observation_id),
  ])

  const summary = summarizeEmailLearningParity(comparison)

  return {
    qa_marker: GROWTH_EMAIL_LEARNING_PARITY_QA_MARKER,
    ...summary,
    event_type_coverage: buildCoverageMap(
      reconstructedRecords,
      shadowRecords,
      matchedReconstructedIds,
      matchedShadowIds,
      (row) => row.event_type,
    ),
    domain_coverage: buildCoverageMap(
      reconstructedRecords,
      shadowRecords,
      matchedReconstructedIds,
      matchedShadowIds,
      (row) => row.domain ?? "_unknown",
    ),
    source_coverage: buildCoverageMap(
      reconstructedRecords,
      shadowRecords,
      matchedReconstructedIds,
      matchedShadowIds,
      (row) => row.source,
    ),
    context: input.context,
    comparison,
  }
}

export function assertEmailLearningParityReportHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}

export function isFullEmailLearningObservation(
  input: EmailLearningShadowParityInput,
): input is EmailLearningObservation {
  return !isShadowLogEntry(input) && input.qa_marker === GROWTH_EMAIL_LEARNING_QA_MARKER
}

export type { EmailLearningOutcomeType, EmailLearningEventSource }
