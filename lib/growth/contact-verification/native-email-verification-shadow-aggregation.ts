/**
 * GE-EI-IMP-5C — offline aggregation for native vs legacy verification shadow logs.
 * Diagnostic only. No runtime influence.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
  type NativeEmailVerificationShadowLogEntry,
} from "@/lib/growth/contact-verification/native-email-verification-shadow"

export const GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER =
  "native-email-verification-shadow-preview-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

/** Lexical pairs treated as semantically equivalent (legacy|native). */
export const NATIVE_EMAIL_VERIFICATION_EQUIVALENT_PAIRS = new Set([
  "verified|valid",
  "blocked|invalid",
  "risky|risky",
  "unknown|unknown",
  "invalid|invalid",
  "discovered|valid",
  "discovered|unknown",
  "discovered|risky",
])

/** Named comparison tags emitted in drift reports. */
export const NATIVE_EMAIL_VERIFICATION_NAMED_COMPARISON_TAGS = new Set([
  "legacy_verified_native_valid",
  "legacy_verified_native_risky",
  "legacy_verified_native_invalid",
  "legacy_verified_native_unknown",
  "legacy_blocked_native_valid",
  "legacy_blocked_native_invalid",
  "legacy_unknown_native_valid",
  "match_equivalent",
  "other_mismatch",
])

export type NativeEmailVerificationShadowComparisonTag =
  | "legacy_verified_native_valid"
  | "legacy_verified_native_risky"
  | "legacy_verified_native_invalid"
  | "legacy_verified_native_unknown"
  | "legacy_blocked_native_valid"
  | "legacy_blocked_native_invalid"
  | "legacy_unknown_native_valid"
  | "match_equivalent"
  | "other_mismatch"

export type NativeEmailVerificationShadowComparison = {
  tag: NativeEmailVerificationShadowComparisonTag
  is_equivalent: boolean
}

export type NativeEmailVerificationShadowParseResult = {
  entries: NativeEmailVerificationShadowLogEntry[]
  loaded: number
  ignored: number
  warnings: string[]
}

export type NativeEmailVerificationShadowPreviewSummary = {
  total: number
  equivalent_matches: number
  mismatches: number
  match_rate: number
  avg_confidence_delta: number
}

export type NativeEmailVerificationShadowDnsSignals = {
  mx_checked: number
  mx_exists: number
  spf_present: number
  dmarc_present: number
  mismatch_when_mx_missing: number
  mismatch_when_dns_unknown: number
}

export type NativeEmailVerificationShadowPreviewReport = {
  qa_marker: typeof GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER
  mode: "fixture" | "file" | "stdin"
  logs_loaded: number
  logs_ignored: number
  summary: NativeEmailVerificationShadowPreviewSummary
  by_tag: Record<string, number>
  by_native_status: Record<string, number>
  dns_signals: NativeEmailVerificationShadowDnsSignals
  warnings: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeLegacyStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function normalizeNativeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function buildNativeEmailVerificationComparisonTag(
  legacyStatus: string,
  nativeStatus: string,
): NativeEmailVerificationShadowComparison {
  const legacy = normalizeLegacyStatus(legacyStatus)
  const native = normalizeNativeStatus(nativeStatus)
  const pairKey = `${legacy}|${native}`
  const specificTag = `legacy_${legacy}_native_${native}` as NativeEmailVerificationShadowComparisonTag

  if (NATIVE_EMAIL_VERIFICATION_NAMED_COMPARISON_TAGS.has(specificTag)) {
    return {
      tag: specificTag,
      is_equivalent: NATIVE_EMAIL_VERIFICATION_EQUIVALENT_PAIRS.has(pairKey),
    }
  }

  if (NATIVE_EMAIL_VERIFICATION_EQUIVALENT_PAIRS.has(pairKey)) {
    return { tag: "match_equivalent", is_equivalent: true }
  }

  return { tag: "other_mismatch", is_equivalent: false }
}

export function normalizeNativeEmailVerificationShadowLogRecord(
  raw: unknown,
): NativeEmailVerificationShadowLogEntry | null {
  if (!isRecord(raw)) return null
  if (raw.shadow !== "native_email_verification") return null

  const legacyStatus = normalizeLegacyStatus(raw.legacy_status)
  const nativeStatus = normalizeNativeStatus(raw.native_status)
  if (!legacyStatus || !nativeStatus) return null

  const legacyConfidence =
    typeof raw.legacy_confidence === "number" && Number.isFinite(raw.legacy_confidence)
      ? roundScore(raw.legacy_confidence)
      : null
  const nativeConfidence =
    typeof raw.native_confidence === "number" && Number.isFinite(raw.native_confidence)
      ? roundScore(raw.native_confidence)
      : 0

  const delta =
    typeof raw.delta === "number" && Number.isFinite(raw.delta)
      ? roundScore(raw.delta)
      : legacyConfidence === null
        ? null
        : roundScore(legacyConfidence - nativeConfidence)

  return {
    qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
    shadow: "native_email_verification",
    legacy_status: legacyStatus,
    native_status: nativeStatus,
    legacy_confidence: legacyConfidence,
    native_confidence: nativeConfidence,
    delta,
    native_mx_checked: raw.native_mx_checked === true,
    native_mx_exists:
      typeof raw.native_mx_exists === "boolean" ? raw.native_mx_exists : null,
    native_spf_present:
      typeof raw.native_spf_present === "boolean" ? raw.native_spf_present : null,
    native_dmarc_present:
      typeof raw.native_dmarc_present === "boolean" ? raw.native_dmarc_present : null,
    legacy_provider_present: raw.legacy_provider_present === true,
    email_present: raw.email_present === true,
    context: isRecord(raw.context) ? raw.context : undefined,
  }
}

function parseJsonShadowRecords(raw: unknown): NativeEmailVerificationShadowLogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeNativeEmailVerificationShadowLogRecord)
    .filter((row): row is NativeEmailVerificationShadowLogEntry => Boolean(row))
}

export function parseNativeEmailVerificationShadowLogText(
  raw: string,
): NativeEmailVerificationShadowParseResult {
  const warnings: string[] = []
  const trimmed = raw.trim()
  if (!trimmed) {
    return { entries: [], loaded: 0, ignored: 0, warnings: ["shadow_logs_empty"] }
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      const entries = parseJsonShadowRecords(parsed)
      return {
        entries,
        loaded: entries.length,
        ignored: Math.max(0, parsed.length - entries.length),
        warnings,
      }
    }
  } catch {
    // Fall through to NDJSON parsing.
  }

  const entries: NativeEmailVerificationShadowLogEntry[] = []
  let ignored = 0
  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim()
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate) as unknown
      const normalized = normalizeNativeEmailVerificationShadowLogRecord(parsed)
      if (normalized) entries.push(normalized)
      else ignored += 1
    } catch {
      ignored += 1
    }
  }

  if (entries.length === 0 && ignored > 0) {
    warnings.push("shadow_logs_unrecognized")
  }

  return { entries, loaded: entries.length, ignored, warnings }
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

function isDnsUnknown(entry: NativeEmailVerificationShadowLogEntry): boolean {
  return (
    !entry.native_mx_checked ||
    entry.native_mx_exists === null ||
    entry.native_spf_present === null ||
    entry.native_dmarc_present === null
  )
}

export function aggregateNativeEmailVerificationShadowLogs(
  entries: NativeEmailVerificationShadowLogEntry[],
): Omit<
  NativeEmailVerificationShadowPreviewReport,
  "qa_marker" | "mode" | "logs_loaded" | "logs_ignored" | "warnings"
> {
  const byTag: Record<string, number> = {}
  const byNativeStatus: Record<string, number> = {}
  const dnsSignals: NativeEmailVerificationShadowDnsSignals = {
    mx_checked: 0,
    mx_exists: 0,
    spf_present: 0,
    dmarc_present: 0,
    mismatch_when_mx_missing: 0,
    mismatch_when_dns_unknown: 0,
  }

  let equivalentMatches = 0
  let mismatches = 0
  let deltaSum = 0
  let deltaCount = 0

  for (const entry of entries) {
    const comparison = buildNativeEmailVerificationComparisonTag(
      entry.legacy_status,
      entry.native_status,
    )
    incrementCount(byTag, comparison.tag)
    incrementCount(byNativeStatus, entry.native_status)

    if (comparison.is_equivalent) equivalentMatches += 1
    else mismatches += 1

    if (typeof entry.delta === "number" && Number.isFinite(entry.delta)) {
      deltaSum += entry.delta
      deltaCount += 1
    }

    if (entry.native_mx_checked) dnsSignals.mx_checked += 1
    if (entry.native_mx_exists === true) dnsSignals.mx_exists += 1
    if (entry.native_spf_present === true) dnsSignals.spf_present += 1
    if (entry.native_dmarc_present === true) dnsSignals.dmarc_present += 1

    if (!comparison.is_equivalent) {
      if (entry.native_mx_exists === false) dnsSignals.mismatch_when_mx_missing += 1
      if (isDnsUnknown(entry)) dnsSignals.mismatch_when_dns_unknown += 1
    }
  }

  const total = entries.length
  const avgConfidenceDelta =
    deltaCount > 0 ? roundScore(deltaSum / deltaCount) : 0
  const matchRate = total > 0 ? roundScore(equivalentMatches / total) : 0

  const sortedByTag = Object.fromEntries(
    Object.entries(byTag).sort(([a], [b]) => a.localeCompare(b)),
  )
  const sortedByNativeStatus = Object.fromEntries(
    Object.entries(byNativeStatus).sort(([a], [b]) => a.localeCompare(b)),
  )

  return {
    summary: {
      total,
      equivalent_matches: equivalentMatches,
      mismatches,
      match_rate: matchRate,
      avg_confidence_delta: avgConfidenceDelta,
    },
    by_tag: sortedByTag,
    by_native_status: sortedByNativeStatus,
    dns_signals: dnsSignals,
  }
}

export function buildNativeEmailVerificationShadowPreviewReport(input: {
  mode: NativeEmailVerificationShadowPreviewReport["mode"]
  parseResult: NativeEmailVerificationShadowParseResult
  extraWarnings?: string[]
}): NativeEmailVerificationShadowPreviewReport {
  const aggregation = aggregateNativeEmailVerificationShadowLogs(input.parseResult.entries)
  const warnings = [...new Set([...input.parseResult.warnings, ...(input.extraWarnings ?? [])])].sort(
    (a, b) => a.localeCompare(b),
  )

  return {
    qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
    mode: input.mode,
    logs_loaded: input.parseResult.loaded,
    logs_ignored: input.parseResult.ignored,
    warnings,
    ...aggregation,
  }
}

export function assertNativeEmailVerificationShadowPreviewHasNoPlaintextEmails(
  output: unknown,
): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}

export function buildNativeEmailVerificationShadowPreviewFixtures(): NativeEmailVerificationShadowLogEntry[] {
  return [
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "valid",
      legacy_confidence: 0.95,
      native_confidence: 0.95,
      delta: 0,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: true,
      legacy_provider_present: true,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "blocked",
      native_status: "invalid",
      legacy_confidence: 0.1,
      native_confidence: 0.05,
      delta: 0.05,
      native_mx_checked: true,
      native_mx_exists: false,
      native_spf_present: false,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "risky",
      legacy_confidence: 0.95,
      native_confidence: 0.72,
      delta: 0.23,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "invalid",
      legacy_confidence: 0.95,
      native_confidence: 0.12,
      delta: 0.83,
      native_mx_checked: true,
      native_mx_exists: false,
      native_spf_present: null,
      native_dmarc_present: null,
      legacy_provider_present: true,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "unknown",
      native_status: "valid",
      legacy_confidence: null,
      native_confidence: 0.88,
      delta: null,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: true,
      legacy_provider_present: false,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "discovered",
      native_status: "unknown",
      legacy_confidence: 0.55,
      native_confidence: 0.5,
      delta: 0.05,
      native_mx_checked: false,
      native_mx_exists: null,
      native_spf_present: null,
      native_dmarc_present: null,
      legacy_provider_present: false,
      email_present: true,
    },
    {
      qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
      shadow: "native_email_verification",
      legacy_status: "risky",
      native_status: "risky",
      legacy_confidence: 0.62,
      native_confidence: 0.6,
      delta: 0.02,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: false,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
    },
  ]
}
