/** Apollo Scale-3 certification assessment — client-safe current-run PASS gate. */

import type { ApolloScale2CertResult } from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import type { ApolloScale3MappedCompanyEvidenceRow } from "@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence"

export const APOLLO_SCALE_3_CERT_VERDICT_FAIL_REASONS = [
  "mock_mode",
  "aggregate_contactable_zero",
  "no_current_run_sequence_ready_contact",
  "insufficient_current_run_pipeline_yield",
  "partial_identity_unresolved",
] as const

export const APOLLO_SCALE_3_COMPANY_CERT_WARNING_REASONS = [
  "mapped_contacts_found_but_not_contactable",
  "mapped_contacts_found_but_no_sequence_ready",
  "partial_identity_unresolved",
] as const

/** @deprecated Use ApolloScale3CertVerdictFailReason for top-level fail_reasons. */
export const APOLLO_SCALE_3_CERT_FAIL_REASONS = [
  ...APOLLO_SCALE_3_CERT_VERDICT_FAIL_REASONS,
  ...APOLLO_SCALE_3_COMPANY_CERT_WARNING_REASONS,
] as const

export type ApolloScale3CertVerdictFailReason = (typeof APOLLO_SCALE_3_CERT_VERDICT_FAIL_REASONS)[number]
export type ApolloScale3CompanyCertWarningReason =
  (typeof APOLLO_SCALE_3_COMPANY_CERT_WARNING_REASONS)[number]
export type ApolloScale3CertFailReason = ApolloScale3CertVerdictFailReason
export type ApolloScale3CompanyCertificationFailReason = ApolloScale3CompanyCertWarningReason

export type ApolloScale3CompanyCurrentRunMetrics = {
  mapped_contacts: number
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
}

export type ApolloScale3CertificationAssessment = {
  result: ApolloScale2CertResult
  fail_reasons: ApolloScale3CertVerdictFailReason[]
  warnings: ApolloScale3CompanyCertWarningReason[]
  partial_company_fail_reasons: Record<string, ApolloScale3CompanyCertificationFailReason[]>
  company_fail_reasons: Record<string, ApolloScale3CompanyCertificationFailReason[]>
  apollo_ready_company_count: number
  aggregate_current_run: ApolloScale3CompanyCurrentRunMetrics
}

export function normalizeApolloCurrentRunMetric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

export function resolveApolloScale3CompanyCurrentRunMetrics(
  row: ApolloScale3MappedCompanyEvidenceRow,
): ApolloScale3CompanyCurrentRunMetrics {
  const promo = row.promotion_evidence
  return {
    mapped_contacts: normalizeApolloCurrentRunMetric(row.mapped_contacts),
    current_run_apollo_verified_email_contacts: normalizeApolloCurrentRunMetric(
      row.current_run_apollo_verified_email_contacts ??
        promo?.current_run_apollo_verified_email_contacts,
    ),
    current_run_apollo_promoted_contacts: normalizeApolloCurrentRunMetric(
      row.current_run_apollo_promoted_contacts ?? promo?.current_run_apollo_promoted_contacts,
    ),
    current_run_apollo_contactable_contacts: normalizeApolloCurrentRunMetric(
      row.current_run_apollo_contactable_contacts ?? promo?.current_run_apollo_contactable_contacts,
    ),
    current_run_apollo_sequence_ready_contacts: normalizeApolloCurrentRunMetric(
      row.current_run_apollo_sequence_ready_contacts ??
        promo?.current_run_apollo_sequence_ready_contacts,
    ),
  }
}

export function resolveApolloScale3CompanyCertificationFailReasons(
  row: ApolloScale3MappedCompanyEvidenceRow,
): ApolloScale3CompanyCertificationFailReason[] {
  const metrics = resolveApolloScale3CompanyCurrentRunMetrics(row)
  const reasons: ApolloScale3CompanyCertificationFailReason[] = []
  const partialStaged =
    normalizeApolloCurrentRunMetric(row.partial_identity_evidence?.partial_identity_candidates_staged) >
      0 ||
    normalizeApolloCurrentRunMetric(row.partial_identity_evidence?.mapped_partial_identity_contacts) > 0

  if (metrics.mapped_contacts > 0 && metrics.current_run_apollo_contactable_contacts === 0) {
    reasons.push("mapped_contacts_found_but_not_contactable")
  }
  if (metrics.mapped_contacts > 0 && metrics.current_run_apollo_sequence_ready_contacts === 0) {
    reasons.push("mapped_contacts_found_but_no_sequence_ready")
  }
  if (partialStaged && metrics.current_run_apollo_sequence_ready_contacts === 0) {
    reasons.push("partial_identity_unresolved")
  }

  return reasons
}

export function isApolloScale3CurrentRunSequenceReadyCompany(
  row: ApolloScale3MappedCompanyEvidenceRow,
): boolean {
  const metrics = resolveApolloScale3CompanyCurrentRunMetrics(row)
  const partialStaged =
    normalizeApolloCurrentRunMetric(row.partial_identity_evidence?.partial_identity_candidates_staged) >
      0 ||
    normalizeApolloCurrentRunMetric(row.partial_identity_evidence?.mapped_partial_identity_contacts) > 0

  if (partialStaged && metrics.current_run_apollo_sequence_ready_contacts === 0) {
    return false
  }

  return (
    metrics.mapped_contacts > 0 &&
    metrics.current_run_apollo_verified_email_contacts > 0 &&
    metrics.current_run_apollo_promoted_contacts > 0 &&
    metrics.current_run_apollo_contactable_contacts > 0 &&
    metrics.current_run_apollo_sequence_ready_contacts > 0
  )
}

function sumAggregateCurrentRunMetrics(
  companies: ApolloScale3MappedCompanyEvidenceRow[],
): ApolloScale3CompanyCurrentRunMetrics {
  return companies.reduce(
    (totals, row) => {
      const metrics = resolveApolloScale3CompanyCurrentRunMetrics(row)
      return {
        mapped_contacts: totals.mapped_contacts + metrics.mapped_contacts,
        current_run_apollo_verified_email_contacts:
          totals.current_run_apollo_verified_email_contacts +
          metrics.current_run_apollo_verified_email_contacts,
        current_run_apollo_promoted_contacts:
          totals.current_run_apollo_promoted_contacts + metrics.current_run_apollo_promoted_contacts,
        current_run_apollo_contactable_contacts:
          totals.current_run_apollo_contactable_contacts +
          metrics.current_run_apollo_contactable_contacts,
        current_run_apollo_sequence_ready_contacts:
          totals.current_run_apollo_sequence_ready_contacts +
          metrics.current_run_apollo_sequence_ready_contacts,
      }
    },
    {
      mapped_contacts: 0,
      current_run_apollo_verified_email_contacts: 0,
      current_run_apollo_promoted_contacts: 0,
      current_run_apollo_contactable_contacts: 0,
      current_run_apollo_sequence_ready_contacts: 0,
    },
  )
}

export function buildApolloScale3CertificationAssessment(input: {
  companies: ApolloScale3MappedCompanyEvidenceRow[]
  mock: boolean
}): ApolloScale3CertificationAssessment {
  const partial_company_fail_reasons: Record<string, ApolloScale3CompanyCertificationFailReason[]> =
    {}
  for (const row of input.companies) {
    const reasons = resolveApolloScale3CompanyCertificationFailReasons(row)
    if (reasons.length > 0) {
      partial_company_fail_reasons[row.company_candidate_id] = reasons
    }
  }

  const aggregate_current_run = sumAggregateCurrentRunMetrics(input.companies)
  const apolloReady = input.companies.filter(isApolloScale3CurrentRunSequenceReadyCompany)
  const verdict_fail_reasons: ApolloScale3CertVerdictFailReason[] = []

  if (input.mock) {
    verdict_fail_reasons.push("mock_mode")
  }

  if (aggregate_current_run.current_run_apollo_contactable_contacts === 0) {
    verdict_fail_reasons.push("aggregate_contactable_zero")
  }
  if (aggregate_current_run.current_run_apollo_sequence_ready_contacts === 0) {
    verdict_fail_reasons.push("no_current_run_sequence_ready_contact")
  }
  if (apolloReady.length === 0) {
    verdict_fail_reasons.push("insufficient_current_run_pipeline_yield")
  }

  const hasUnresolvedPartial = input.companies.some((row) =>
    (partial_company_fail_reasons[row.company_candidate_id] ?? []).includes(
      "partial_identity_unresolved",
    ),
  )
  if (hasUnresolvedPartial && aggregate_current_run.current_run_apollo_sequence_ready_contacts === 0) {
    verdict_fail_reasons.push("partial_identity_unresolved")
  }

  const uniqueVerdictFailReasons = [...new Set(verdict_fail_reasons)]
  const warnings = [
    ...new Set(
      Object.values(partial_company_fail_reasons).flatMap((reasons) => reasons),
    ),
  ]
  const passesCurrentRunGate =
    !input.mock &&
    apolloReady.length >= 1 &&
    aggregate_current_run.current_run_apollo_contactable_contacts > 0 &&
    aggregate_current_run.current_run_apollo_sequence_ready_contacts > 0

  return {
    result: passesCurrentRunGate ? "PASS" : "FAIL",
    fail_reasons: passesCurrentRunGate ? [] : uniqueVerdictFailReasons,
    warnings,
    partial_company_fail_reasons,
    company_fail_reasons: partial_company_fail_reasons,
    apollo_ready_company_count: apolloReady.length,
    aggregate_current_run,
  }
}

export function assessApolloScale3SearchStrategyResult(input: {
  companies: ApolloScale3MappedCompanyEvidenceRow[]
  mock: boolean
}): ApolloScale2CertResult {
  return buildApolloScale3CertificationAssessment(input).result
}
