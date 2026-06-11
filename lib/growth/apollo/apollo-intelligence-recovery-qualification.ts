/** Apollo intelligence recovery — qualification context + score decomposition (client-safe). */

import { evaluateApolloEnrollmentQualification } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { isCertificationEligibleSequenceReadyContact } from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import type {
  ApolloIntelligenceRecoveryScoreDecompositionRow,
  ApolloIntelligenceRecoveryScoreDecompositionSummary,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

export type ApolloIntelligenceRecoveryQualificationContext = {
  company_intelligence_present: boolean
  buying_committee_present: boolean
  buying_committee_coverage: number | null
  fit_score: number | null
  research_score: number | null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

export function resolveApolloIntelligenceRecoveryFitScores(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): { fit_score: number | null; research_score: number | null } {
  const confidence = engine?.company_intelligence?.snapshots?.[0]?.confidence
  if (confidence == null || !Number.isFinite(confidence)) {
    return { fit_score: null, research_score: null }
  }
  const scaled = Math.max(0, Math.min(100, confidence * 100))
  return { fit_score: scaled, research_score: scaled }
}

export function buildApolloIntelligenceRecoveryQualificationContext(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): ApolloIntelligenceRecoveryQualificationContext {
  const fitScores = resolveApolloIntelligenceRecoveryFitScores(engine)
  const buyingCommitteePresent = (engine?.buying_committee?.member_count ?? 0) > 0
  const coverage = engine?.buying_committee?.coverage_score

  return {
    company_intelligence_present: engine?.company_intelligence?.has_verified_intelligence === true,
    buying_committee_present: buyingCommitteePresent,
    buying_committee_coverage: asNumber(coverage),
    fit_score: fitScores.fit_score,
    research_score: fitScores.research_score,
  }
}

function pickBestContact(
  contacts: ApolloPrimaryContactOperatorReviewRow[],
  input: {
    snapshot_summary: {
      mapped_contacts: number
      verified_email_contacts: number
      contactable_contacts: number
      sequence_ready_contacts: number
    }
    qualificationContext: ApolloIntelligenceRecoveryQualificationContext
    production_threshold: number
  },
): {
  contact: ApolloPrimaryContactOperatorReviewRow | null
  qualification: ReturnType<typeof evaluateApolloEnrollmentQualification> | null
} {
  let best: {
    contact: ApolloPrimaryContactOperatorReviewRow
    qualification: ReturnType<typeof evaluateApolloEnrollmentQualification>
  } | null = null

  for (const contact of contacts) {
    const qualification = evaluateApolloEnrollmentQualification(
      {
        mapped_contacts: input.snapshot_summary.mapped_contacts,
        verified_email_contacts: input.snapshot_summary.verified_email_contacts,
        contactable_contacts: input.snapshot_summary.contactable_contacts,
        sequence_ready_contacts: input.snapshot_summary.sequence_ready_contacts,
        company_intelligence_present: input.qualificationContext.company_intelligence_present,
        buying_committee_present: input.qualificationContext.buying_committee_present,
        buying_committee_coverage: input.qualificationContext.buying_committee_coverage,
        fit_score: input.qualificationContext.fit_score,
        research_score: input.qualificationContext.research_score,
        contact_sequence_ready: contact.sequence_ready,
        contact_contactable: contact.contactable,
        contact_blockers: contact.blockers,
        apollo_search_tier: null,
        verified_email_source: null,
        enrichment_source: null,
      },
      { threshold: input.production_threshold },
    )

    if (!best || qualification.qualification_score > best.qualification.qualification_score) {
      best = { contact, qualification }
    }
  }

  if (!best) return { contact: null, qualification: null }
  return best
}

export function buildApolloIntelligenceRecoveryScoreDecompositionRow(input: {
  company_candidate_id: string
  company_name: string
  contacts: ApolloPrimaryContactOperatorReviewRow[]
  snapshot_summary: {
    mapped_contacts: number
    verified_email_contacts: number
    contactable_contacts: number
    sequence_ready_contacts: number
  }
  qualificationContext: ApolloIntelligenceRecoveryQualificationContext
  production_threshold: number
}): ApolloIntelligenceRecoveryScoreDecompositionRow {
  const picked = pickBestContact(input.contacts, input)
  const breakdown = picked.qualification?.score_breakdown ?? {}
  const current_score = picked.qualification?.qualification_score ?? 0
  const threshold = input.production_threshold

  const verified_email = input.snapshot_summary.verified_email_contacts > 0
  const sequence_ready = input.snapshot_summary.sequence_ready_contacts > 0
  const contactable = input.snapshot_summary.contactable_contacts > 0

  let score_zero_reason: string | null = null
  if (current_score === 0 && picked.qualification) {
    score_zero_reason = picked.qualification.qualification_reason
    const gate = Object.keys(breakdown)[0]
    if (gate?.includes("gate")) score_zero_reason = gate
  }

  const blockers = picked.contact?.blockers ?? []
  if (current_score === 0 && picked.qualification && !gateFromBreakdown(breakdown)) {
    blockers.push(picked.qualification.qualification_reason)
  }

  return {
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    verified_email,
    sequence_ready,
    contactable,
    current_score,
    production_threshold: threshold,
    missing_points_to_threshold: Math.max(0, threshold - current_score),
    sequence_ready_base_points: asNumber(breakdown.sequence_ready_base) ?? 0,
    contactable_base_points: asNumber(breakdown.contactable_base) ?? 0,
    verified_email_points: asNumber(breakdown.verified_email) ?? 0,
    sequence_ready_cohort_points: asNumber(breakdown.sequence_ready_cohort) ?? 0,
    company_intelligence_points: asNumber(breakdown.company_intelligence) ?? 0,
    buying_committee_points: asNumber(breakdown.buying_committee) ?? 0,
    buying_committee_coverage_points: asNumber(breakdown.buying_committee_coverage) ?? 0,
    fit_score_points: asNumber(breakdown.fit_score) ?? 0,
    research_score_points: asNumber(breakdown.research_score) ?? 0,
    blockers: [...new Set(blockers)],
    score_zero_reason,
  }
}

function gateFromBreakdown(breakdown: Record<string, number>): boolean {
  return Object.keys(breakdown).some((key) => key.includes("gate"))
}

export function summarizeApolloIntelligenceRecoveryScoreDecomposition(
  rows: ApolloIntelligenceRecoveryScoreDecompositionRow[],
): ApolloIntelligenceRecoveryScoreDecompositionSummary {
  let companies_at_65 = 0
  let companies_at_55_to_64 = 0
  let companies_below_55 = 0
  let companies_with_score_zero = 0
  const score_zero_reasons: Record<string, number> = {}

  for (const row of rows) {
    if (row.current_score === 0) {
      companies_with_score_zero += 1
      const reason = row.score_zero_reason ?? "score_zero_unknown"
      score_zero_reasons[reason] = (score_zero_reasons[reason] ?? 0) + 1
    } else if (row.current_score === 65) {
      companies_at_65 += 1
    } else if (row.current_score >= 55 && row.current_score <= 64) {
      companies_at_55_to_64 += 1
    } else if (row.current_score < 55) {
      companies_below_55 += 1
    }
  }

  return {
    companies_at_65,
    companies_at_55_to_64,
    companies_below_55,
    companies_with_score_zero,
    score_zero_reasons,
  }
}

export function countCompaniesWithQualificationAboveThreshold(
  rows: ApolloIntelligenceRecoveryScoreDecompositionRow[],
  threshold: number,
): number {
  return rows.filter((row) => row.current_score >= threshold).length
}

export function buildApolloIntelligenceRecoveryRootCauseSummary(input: {
  before: { score_gte_threshold_companies: number; eligible_greenfield_companies: number }
  after: { score_gte_threshold_companies: number; eligible_greenfield_companies: number }
  decomposition_summary: ApolloIntelligenceRecoveryScoreDecompositionSummary
  intelligence_schema_ready: boolean
}): string {
  const parts: string[] = []

  if (input.decomposition_summary.companies_at_65 > 0) {
    parts.push(
      `${input.decomposition_summary.companies_at_65} companies cap at 65 without buying committee/fit/research intelligence.`,
    )
  }

  if (!input.intelligence_schema_ready) {
    parts.push("Growth intelligence schema not ready — intelligence loaders return empty.")
  }

  if (input.after.score_gte_threshold_companies > input.before.score_gte_threshold_companies) {
    parts.push(
      `Recovery raised score≥threshold from ${input.before.score_gte_threshold_companies} to ${input.after.score_gte_threshold_companies}.`,
    )
  } else if (input.before.score_gte_threshold_companies === 0) {
    parts.push("No companies reach threshold 70 until intelligence artifacts populate scoring inputs.")
  }

  return parts.join(" ")
}

export function isSequenceReadyContactEligible(
  contact: ApolloPrimaryContactOperatorReviewRow,
): boolean {
  return isCertificationEligibleSequenceReadyContact(contact)
}
