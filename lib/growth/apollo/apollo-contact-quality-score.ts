/** Apollo AI-3 contact quality scoring from pilot evidence — client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_CONTACT_QUALITY_SCORE_QA_MARKER = "apollo-contact-quality-score-ai-3-v1" as const

export type ApolloContactQualityBreakdown = {
  executives: number
  managers: number
  decision_makers: number
  invalid_or_irrelevant_titles: number
  generic_or_unknown_titles: number
  with_email: number
  with_verified_email: number
  with_phone: number
  with_social: number
}

export type ApolloContactQualityScore = {
  qa_marker: typeof APOLLO_CONTACT_QUALITY_SCORE_QA_MARKER
  breakdown: ApolloContactQualityBreakdown
  rates: {
    decision_maker_rate: number
    executive_rate: number
    email_rate: number
    verified_email_rate: number
    phone_rate: number
    social_rate: number
    contactability_rate: number
  }
  composite_score: number
  grade: "excellent" | "good" | "fair" | "poor"
  findings: string[]
}

function safeRate(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

export function scoreApolloContactQuality(evidence: ApolloLivePilotEvidence): ApolloContactQualityScore {
  const mapped = Math.max(evidence.discovery.contacts_mapped, 0)
  const buckets = evidence.contact_quality.title_buckets
  const executives =
    (buckets.owner_founder_president_ceo ?? 0) + (buckets.operations_coo_general_manager ?? 0)
  const managers =
    (buckets.service_field_service_manager ?? 0) +
    (buckets.biomedical_equipment_facilities_maintenance ?? 0)
  const invalid = buckets.sales_marketing_admin_irrelevant ?? 0
  const generic = buckets.unknown_other ?? 0
  const skipped = evidence.contact_quality.irrelevant_title_skipped

  const breakdown: ApolloContactQualityBreakdown = {
    executives,
    managers,
    decision_makers: evidence.contact_quality.decision_maker_count,
    invalid_or_irrelevant_titles: invalid + skipped,
    generic_or_unknown_titles: generic,
    with_email: evidence.contact_quality.with_email,
    with_verified_email: evidence.contact_quality.with_verified_email,
    with_phone: evidence.contact_quality.with_phone,
    with_social: evidence.contact_quality.with_linkedin,
  }

  const rates = {
    decision_maker_rate: safeRate(breakdown.decision_makers, mapped),
    executive_rate: safeRate(breakdown.executives, mapped),
    email_rate: safeRate(breakdown.with_email, mapped),
    verified_email_rate: safeRate(breakdown.with_verified_email, mapped),
    phone_rate: safeRate(breakdown.with_phone, mapped),
    social_rate: safeRate(breakdown.with_social, mapped),
    contactability_rate: safeRate(
      Math.max(breakdown.with_email, breakdown.with_phone),
      mapped,
    ),
  }

  const findings: string[] = []
  if (skipped > 0) findings.push(`${skipped} contact(s) filtered for irrelevant titles before import.`)
  if (invalid > 0) findings.push(`${invalid} imported contact(s) in sales/marketing/admin bucket — review ICP fit.`)
  if (generic > 0) findings.push(`${generic} contact(s) with unknown/generic title bucket.`)
  if (rates.verified_email_rate === 0 && rates.email_rate > 0) {
    findings.push("Emails present without verified status — email outreach may need enrichment.")
  }
  if (rates.phone_rate === 0 && rates.email_rate === 0) {
    findings.push("No email or phone on mapped contacts — outreach channels blocked.")
  }

  let composite =
    rates.decision_maker_rate * 0.3 +
    rates.executive_rate * 0.15 +
    rates.email_rate * 0.2 +
    rates.verified_email_rate * 0.1 +
    rates.phone_rate * 0.1 +
    rates.social_rate * 0.05 +
    Math.max(0, 10 - invalid * 3)

  if (mapped === 0) composite = 0
  composite = Math.round(Math.min(100, Math.max(0, composite)))

  let grade: ApolloContactQualityScore["grade"] = "poor"
  if (composite >= 80) grade = "excellent"
  else if (composite >= 65) grade = "good"
  else if (composite >= 45) grade = "fair"

  return {
    qa_marker: APOLLO_CONTACT_QUALITY_SCORE_QA_MARKER,
    breakdown,
    rates,
    composite_score: composite,
    grade,
    findings,
  }
}
