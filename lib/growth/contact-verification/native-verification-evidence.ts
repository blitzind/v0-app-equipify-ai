/**
 * GE-EI-IMP-5D — deterministic evidence aggregation from native verification shadow logs.
 * Diagnostic only. No runtime influence.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  buildNativeEmailVerificationComparisonTag,
  type NativeEmailVerificationShadowPreviewReport,
} from "@/lib/growth/contact-verification/native-email-verification-shadow-aggregation"
import type { NativeEmailVerificationShadowLogEntry } from "@/lib/growth/contact-verification/native-email-verification-shadow"

export const GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER =
  "native-verification-evidence-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

const MIN_PILOT_SAMPLE_SIZE = 100
const MIN_SHADOW_SAMPLE_SIZE = 10

export type NativeVerificationEvidenceFilters = {
  legacy_status?: string[]
  native_status?: string[]
  legacy_provider_present?: boolean
  min_abs_confidence_delta?: number
  max_abs_confidence_delta?: number
}

export type NativeVerificationEvidenceOverall = {
  total_verifications: number
  equivalent_matches: number
  mismatches: number
  match_rate: number
  average_confidence_delta: number
}

export type NativeVerificationEvidenceByDomainType = {
  business_domains: number
  free_domains: number
  disposable_domains: number
  role_accounts: number
  unknown_domain_type: number
}

export type NativeVerificationEvidenceByStatus = {
  native: Record<string, number>
  legacy: Record<string, number>
}

export type NativeVerificationEvidenceByMismatch = {
  verified_to_risky: number
  verified_to_invalid: number
  blocked_to_valid: number
  blocked_to_risky: number
  dns_timeout: number
  mx_missing: number
  free_domain_downgrade: number
  role_downgrade: number
  other: number
}

export type NativeVerificationEvidenceDnsSummary = {
  mx_checked: number
  mx_exists_rate: number
  spf_rate: number
  dmarc_rate: number
  dns_timeout_rate: number
}

export type NativeVerificationEvidenceAggregation = {
  overall: NativeVerificationEvidenceOverall
  by_domain_type: NativeVerificationEvidenceByDomainType
  by_status: NativeVerificationEvidenceByStatus
  by_mismatch: NativeVerificationEvidenceByMismatch
  dns_summary: NativeVerificationEvidenceDnsSummary
}

export type NativeVerificationEvidenceSummary = NativeVerificationEvidenceAggregation & {
  qa_marker: typeof GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER
  readiness_score: number
  recommendation: string
  warnings: string[]
}

type DomainTypeHints = {
  business_domain: boolean
  free_email: boolean
  disposable: boolean
  role_account: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase()
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

function sortedCountRecord(map: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
}

function readContextBoolean(context: Record<string, unknown> | undefined, key: string): boolean {
  return context?.[key] === true
}

export function extractDomainTypeHints(
  entry: NativeEmailVerificationShadowLogEntry,
): DomainTypeHints {
  const context = entry.context
  const business =
    readContextBoolean(context, "business_domain") ||
    readContextBoolean(context, "business_domains")
  const free = readContextBoolean(context, "free_email") || readContextBoolean(context, "free_domains")
  const disposable =
    readContextBoolean(context, "disposable") || readContextBoolean(context, "disposable_domains")
  const role =
    readContextBoolean(context, "role_account") || readContextBoolean(context, "role_accounts")

  return {
    business_domain: business,
    free_email: free,
    disposable,
    role_account: role,
  }
}

function isDnsTimeout(entry: NativeEmailVerificationShadowLogEntry): boolean {
  return (
    !entry.native_mx_checked ||
    entry.native_mx_exists === null ||
    entry.native_spf_present === null ||
    entry.native_dmarc_present === null
  )
}

function passesFilters(
  entry: NativeEmailVerificationShadowLogEntry,
  filters: NativeVerificationEvidenceFilters | undefined,
): boolean {
  if (!filters) return true

  const legacy = normalizeStatus(entry.legacy_status)
  const native = normalizeStatus(entry.native_status)

  if (filters.legacy_status?.length && !filters.legacy_status.map(normalizeStatus).includes(legacy)) {
    return false
  }
  if (filters.native_status?.length && !filters.native_status.map(normalizeStatus).includes(native)) {
    return false
  }
  if (
    typeof filters.legacy_provider_present === "boolean" &&
    entry.legacy_provider_present !== filters.legacy_provider_present
  ) {
    return false
  }

  const delta =
    typeof entry.delta === "number" && Number.isFinite(entry.delta)
      ? Math.abs(entry.delta)
      : null
  if (delta !== null) {
    if (
      typeof filters.min_abs_confidence_delta === "number" &&
      delta < filters.min_abs_confidence_delta
    ) {
      return false
    }
    if (
      typeof filters.max_abs_confidence_delta === "number" &&
      delta > filters.max_abs_confidence_delta
    ) {
      return false
    }
  }

  return true
}

function classifyMismatch(entry: NativeEmailVerificationShadowLogEntry): keyof NativeVerificationEvidenceByMismatch {
  const legacy = normalizeStatus(entry.legacy_status)
  const native = normalizeStatus(entry.native_status)
  const comparison = buildNativeEmailVerificationComparisonTag(legacy, native)
  if (comparison.is_equivalent) return "other"

  const domainHints = extractDomainTypeHints(entry)

  if (legacy === "verified" && native === "risky") {
    if (domainHints.free_email) return "free_domain_downgrade"
    if (domainHints.role_account) return "role_downgrade"
    return "verified_to_risky"
  }
  if (legacy === "verified" && native === "invalid") return "verified_to_invalid"
  if (legacy === "blocked" && native === "valid") return "blocked_to_valid"
  if (legacy === "blocked" && native === "risky") return "blocked_to_risky"
  if (entry.native_mx_exists === false) return "mx_missing"
  if (isDnsTimeout(entry)) return "dns_timeout"

  return "other"
}

function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return roundScore(numerator / denominator)
}

export function aggregateNativeVerificationEvidence(
  entries: NativeEmailVerificationShadowLogEntry[],
  filters?: NativeVerificationEvidenceFilters,
): NativeVerificationEvidenceAggregation {
  const filtered = entries.filter((entry) => passesFilters(entry, filters))

  const byNativeStatus: Record<string, number> = {}
  const byLegacyStatus: Record<string, number> = {}
  const byMismatch: NativeVerificationEvidenceByMismatch = {
    verified_to_risky: 0,
    verified_to_invalid: 0,
    blocked_to_valid: 0,
    blocked_to_risky: 0,
    dns_timeout: 0,
    mx_missing: 0,
    free_domain_downgrade: 0,
    role_downgrade: 0,
    other: 0,
  }
  const byDomainType: NativeVerificationEvidenceByDomainType = {
    business_domains: 0,
    free_domains: 0,
    disposable_domains: 0,
    role_accounts: 0,
    unknown_domain_type: 0,
  }

  let equivalentMatches = 0
  let mismatches = 0
  let deltaSum = 0
  let deltaCount = 0
  let mxChecked = 0
  let mxExists = 0
  let spfPresent = 0
  let dmarcPresent = 0
  let dnsTimeout = 0

  for (const entry of filtered) {
    const legacy = normalizeStatus(entry.legacy_status)
    const native = normalizeStatus(entry.native_status)
    incrementCount(byLegacyStatus, legacy)
    incrementCount(byNativeStatus, native)

    const comparison = buildNativeEmailVerificationComparisonTag(legacy, native)
    if (comparison.is_equivalent) equivalentMatches += 1
    else {
      mismatches += 1
      byMismatch[classifyMismatch(entry)] += 1
    }

    if (typeof entry.delta === "number" && Number.isFinite(entry.delta)) {
      deltaSum += entry.delta
      deltaCount += 1
    }

    if (entry.native_mx_checked) mxChecked += 1
    if (entry.native_mx_exists === true) mxExists += 1
    if (entry.native_spf_present === true) spfPresent += 1
    if (entry.native_dmarc_present === true) dmarcPresent += 1
    if (isDnsTimeout(entry)) dnsTimeout += 1

    const domainHints = extractDomainTypeHints(entry)
    if (domainHints.disposable) byDomainType.disposable_domains += 1
    else if (domainHints.role_account) byDomainType.role_accounts += 1
    else if (domainHints.free_email) byDomainType.free_domains += 1
    else if (domainHints.business_domain) byDomainType.business_domains += 1
    else byDomainType.unknown_domain_type += 1
  }

  const total = filtered.length
  const averageConfidenceDelta = deltaCount > 0 ? roundScore(deltaSum / deltaCount) : 0
  const matchRate = total > 0 ? roundScore(equivalentMatches / total) : 0

  return {
    overall: {
      total_verifications: total,
      equivalent_matches: equivalentMatches,
      mismatches,
      match_rate: matchRate,
      average_confidence_delta: averageConfidenceDelta,
    },
    by_domain_type: byDomainType,
    by_status: {
      native: sortedCountRecord(byNativeStatus),
      legacy: sortedCountRecord(byLegacyStatus),
    },
    by_mismatch: byMismatch,
    dns_summary: {
      mx_checked: mxChecked,
      mx_exists_rate: computeRate(mxExists, mxChecked),
      spf_rate: computeRate(spfPresent, mxChecked),
      dmarc_rate: computeRate(dmarcPresent, mxChecked),
      dns_timeout_rate: computeRate(dnsTimeout, total),
    },
  }
}

export function computeNativeVerificationReadinessScore(input: {
  overall: NativeVerificationEvidenceOverall
  by_mismatch: NativeVerificationEvidenceByMismatch
  dns_summary: NativeVerificationEvidenceDnsSummary
}): number {
  let score = 100

  const total = input.overall.total_verifications
  if (total <= 0) return 0

  const mismatchRate =
    total > 0 ? input.overall.mismatches / total : 0
  score -= roundScore(mismatchRate * 40)

  score -= roundScore(input.dns_summary.dns_timeout_rate * 15)

  const driftPenalty = Math.min(20, roundScore(Math.abs(input.overall.average_confidence_delta) * 25))
  score -= driftPenalty

  const severeMismatchRate = computeRate(
    input.by_mismatch.verified_to_invalid + input.by_mismatch.blocked_to_valid,
    total,
  )
  score -= roundScore(severeMismatchRate * 30)

  if (input.overall.match_rate >= 0.9 && total >= MIN_SHADOW_SAMPLE_SIZE) {
    score += 5
  }

  return Math.max(0, Math.min(100, roundScore(score)))
}

export type NativeVerificationEvidenceRecommendation =
  | "Continue shadow collection"
  | "Native engine ready for pilot"
  | "Investigate MX failures"
  | "Investigate free-domain mismatches"
  | "Investigate provider disagreement"

export function deriveNativeVerificationRecommendation(input: {
  overall: NativeVerificationEvidenceOverall
  by_mismatch: NativeVerificationEvidenceByMismatch
  dns_summary: NativeVerificationEvidenceDnsSummary
  readiness_score: number
}): NativeVerificationEvidenceRecommendation {
  const total = input.overall.total_verifications

  if (total < MIN_SHADOW_SAMPLE_SIZE) return "Continue shadow collection"

  const severeDisagreement =
    input.by_mismatch.verified_to_invalid + input.by_mismatch.blocked_to_valid
  if (
    severeDisagreement >= 3 ||
    (total >= MIN_SHADOW_SAMPLE_SIZE && input.overall.match_rate < 0.7)
  ) {
    return "Investigate provider disagreement"
  }

  const mxIssueRate = computeRate(
    input.by_mismatch.mx_missing + input.by_mismatch.dns_timeout,
    total,
  )
  if (mxIssueRate >= 0.15 || input.dns_summary.dns_timeout_rate >= 0.2) {
    return "Investigate MX failures"
  }

  const freeDomainIssues =
    input.by_mismatch.free_domain_downgrade + input.by_mismatch.role_downgrade
  if (freeDomainIssues >= 3) {
    return "Investigate free-domain mismatches"
  }

  if (
    input.readiness_score >= 85 &&
    total >= MIN_PILOT_SAMPLE_SIZE &&
    input.overall.match_rate >= 0.85
  ) {
    return "Native engine ready for pilot"
  }

  return "Continue shadow collection"
}

export function buildNativeVerificationEvidenceSummary(
  entries: NativeEmailVerificationShadowLogEntry[],
  options?: {
    filters?: NativeVerificationEvidenceFilters
    warnings?: string[]
  },
): NativeVerificationEvidenceSummary {
  const aggregation = aggregateNativeVerificationEvidence(entries, options?.filters)
  const readinessScore = computeNativeVerificationReadinessScore(aggregation)
  const recommendation = deriveNativeVerificationRecommendation({
    ...aggregation,
    readiness_score: readinessScore,
  })

  const warnings = [...(options?.warnings ?? [])]
  if (aggregation.overall.total_verifications === 0) {
    warnings.push("no_evidence_records")
  }
  if (aggregation.by_domain_type.unknown_domain_type === aggregation.overall.total_verifications) {
    warnings.push("domain_type_hints_missing")
  }

  return {
    qa_marker: GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER,
    ...aggregation,
    readiness_score: readinessScore,
    recommendation,
    warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b)),
  }
}

export function buildNativeVerificationEvidenceFromPreviewReport(
  preview: NativeEmailVerificationShadowPreviewReport,
): NativeVerificationEvidenceSummary {
  const total = preview.summary.total
  const mxChecked = preview.dns_signals.mx_checked

  const aggregation: NativeVerificationEvidenceAggregation = {
    overall: {
      total_verifications: total,
      equivalent_matches: preview.summary.equivalent_matches,
      mismatches: preview.summary.mismatches,
      match_rate: preview.summary.match_rate,
      average_confidence_delta: preview.summary.avg_confidence_delta,
    },
    by_domain_type: {
      business_domains: 0,
      free_domains: 0,
      disposable_domains: 0,
      role_accounts: 0,
      unknown_domain_type: total,
    },
    by_status: {
      native: preview.by_native_status,
      legacy: {},
    },
    by_mismatch: {
      verified_to_risky: preview.by_tag.legacy_verified_native_risky ?? 0,
      verified_to_invalid: preview.by_tag.legacy_verified_native_invalid ?? 0,
      blocked_to_valid: preview.by_tag.legacy_blocked_native_valid ?? 0,
      blocked_to_risky: 0,
      dns_timeout: preview.dns_signals.mismatch_when_dns_unknown,
      mx_missing: preview.dns_signals.mismatch_when_mx_missing,
      free_domain_downgrade: 0,
      role_downgrade: 0,
      other: preview.by_tag.other_mismatch ?? 0,
    },
    dns_summary: {
      mx_checked: mxChecked,
      mx_exists_rate: computeRate(preview.dns_signals.mx_exists, mxChecked),
      spf_rate: computeRate(preview.dns_signals.spf_present, mxChecked),
      dmarc_rate: computeRate(preview.dns_signals.dmarc_present, mxChecked),
      dns_timeout_rate: computeRate(
        total - mxChecked + preview.dns_signals.mismatch_when_dns_unknown,
        total,
      ),
    },
  }

  const readinessScore = computeNativeVerificationReadinessScore(aggregation)
  const recommendation = deriveNativeVerificationRecommendation({
    ...aggregation,
    readiness_score: readinessScore,
  })

  return {
    qa_marker: GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER,
    ...aggregation,
    readiness_score: readinessScore,
    recommendation,
    warnings: [
      ...new Set([
        ...preview.warnings,
        "derived_from_preview_report",
        "domain_type_hints_missing",
        "mismatch_categories_approximate",
      ]),
    ].sort((a, b) => a.localeCompare(b)),
  }
}

export function assertNativeVerificationEvidenceHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}

export function buildNativeVerificationEvidenceFixtures(): NativeEmailVerificationShadowLogEntry[] {
  return [
    {
      qa_marker: "native-email-verification-shadow-v1",
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
      context: { business_domain: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "valid",
      legacy_confidence: 0.92,
      native_confidence: 0.9,
      delta: 0.02,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
      context: { business_domain: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "risky",
      legacy_confidence: 0.95,
      native_confidence: 0.62,
      delta: 0.33,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: true,
      legacy_provider_present: true,
      email_present: true,
      context: { free_email: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "risky",
      legacy_confidence: 0.9,
      native_confidence: 0.55,
      delta: 0.35,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: false,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
      context: { role_account: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "verified",
      native_status: "invalid",
      legacy_confidence: 0.95,
      native_confidence: 0.1,
      delta: 0.85,
      native_mx_checked: true,
      native_mx_exists: false,
      native_spf_present: null,
      native_dmarc_present: null,
      legacy_provider_present: true,
      email_present: true,
      context: { business_domain: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "blocked",
      native_status: "valid",
      legacy_confidence: 0.2,
      native_confidence: 0.88,
      delta: -0.68,
      native_mx_checked: true,
      native_mx_exists: true,
      native_spf_present: true,
      native_dmarc_present: true,
      legacy_provider_present: true,
      email_present: true,
      context: { business_domain: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "blocked",
      native_status: "invalid",
      legacy_confidence: 0.05,
      native_confidence: 0.05,
      delta: 0,
      native_mx_checked: true,
      native_mx_exists: false,
      native_spf_present: false,
      native_dmarc_present: false,
      legacy_provider_present: true,
      email_present: true,
      context: { disposable: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
      shadow: "native_email_verification",
      legacy_status: "unknown",
      native_status: "invalid",
      legacy_confidence: 0.4,
      native_confidence: 0.08,
      delta: 0.32,
      native_mx_checked: true,
      native_mx_exists: false,
      native_spf_present: false,
      native_dmarc_present: false,
      legacy_provider_present: false,
      email_present: true,
      context: { business_domain: true },
    },
    {
      qa_marker: "native-email-verification-shadow-v1",
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
  ]
}
