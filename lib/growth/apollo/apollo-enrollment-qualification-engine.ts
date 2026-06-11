/** Apollo Enrollment Qualification Engine — deterministic scoring, client-safe. */

import type {
  ApolloEnrollmentQualificationInput,
  ApolloEnrollmentQualificationResult,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"

export const APOLLO_ENROLLMENT_QUALIFICATION_ENGINE_QA_MARKER =
  "apollo-enrollment-qualification-engine-v1" as const

export const APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD = 70

export const APOLLO_FULL_PIPELINE_CERTIFICATION_DEFAULT_QUALIFICATION_THRESHOLD = 50

export function resolveApolloEnrollmentQualificationThreshold(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.GROWTH_APOLLO_ENROLLMENT_QUALIFICATION_THRESHOLD?.trim()
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD
  }
  return parsed
}

/** Full pipeline certification only — never used by normal enrollment automation. */
export function resolveApolloFullPipelineCertificationQualificationThreshold(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_QUALIFICATION_THRESHOLD?.trim()
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return APOLLO_FULL_PIPELINE_CERTIFICATION_DEFAULT_QUALIFICATION_THRESHOLD
  }
  return parsed
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function scoreFit(fitScore: number | null): number {
  if (fitScore == null || !Number.isFinite(fitScore)) return 0
  return clampScore((Math.max(0, Math.min(100, fitScore)) / 100) * 25)
}

function scoreResearch(researchScore: number | null): number {
  if (researchScore == null || !Number.isFinite(researchScore)) return 0
  return clampScore((Math.max(0, Math.min(100, researchScore)) / 100) * 20)
}

export function evaluateApolloEnrollmentQualification(
  input: ApolloEnrollmentQualificationInput,
  options?: { threshold?: number },
): ApolloEnrollmentQualificationResult {
  const threshold = options?.threshold ?? APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD
  const breakdown: Record<string, number> = {}

  if (!input.contact_sequence_ready) {
    return {
      qualified_for_enrollment: false,
      qualification_reason: "Contact is not sequence-ready.",
      qualification_score: 0,
      threshold,
      score_breakdown: { sequence_ready_gate: 0 },
    }
  }

  if (!input.contact_contactable) {
    return {
      qualified_for_enrollment: false,
      qualification_reason: "Contact is not contactable (missing email/phone or blocked).",
      qualification_score: 0,
      threshold,
      score_breakdown: { contactable_gate: 0 },
    }
  }

  if (input.contact_blockers.length > 0) {
    return {
      qualified_for_enrollment: false,
      qualification_reason: `Contact blockers present: ${input.contact_blockers.join(", ")}.`,
      qualification_score: 0,
      threshold,
      score_breakdown: { blockers_gate: 0 },
    }
  }

  breakdown.sequence_ready_base = 25
  breakdown.contactable_base = 15

  if (input.verified_email_contacts > 0) {
    breakdown.verified_email = 10
  }

  if (input.sequence_ready_contacts > 0) {
    breakdown.sequence_ready_cohort = 5
  }

  if (input.company_intelligence_present) {
    breakdown.company_intelligence = 10
  }

  if (input.buying_committee_present) {
    breakdown.buying_committee = 10
    if (input.buying_committee_coverage != null && input.buying_committee_coverage >= 0.5) {
      breakdown.buying_committee_coverage = 5
    }
  }

  breakdown.fit_score = scoreFit(input.fit_score)
  breakdown.research_score = scoreResearch(input.research_score)

  const qualification_score = clampScore(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  )

  const qualified_for_enrollment = qualification_score >= threshold

  const reasons: string[] = []
  if (qualified_for_enrollment) {
    reasons.push(`Qualification score ${qualification_score} meets threshold ${threshold}.`)
    if (breakdown.verified_email) reasons.push("Verified email present.")
    if (breakdown.company_intelligence) reasons.push("Company intelligence available.")
    if (breakdown.buying_committee) reasons.push("Buying committee intelligence available.")
    if (breakdown.fit_score > 0) reasons.push(`Fit score contributes ${breakdown.fit_score} points.`)
    if (breakdown.research_score > 0) {
      reasons.push(`Research score contributes ${breakdown.research_score} points.`)
    }
  } else {
    reasons.push(
      `Qualification score ${qualification_score} below threshold ${threshold} — manual review optional.`,
    )
  }

  return {
    qualified_for_enrollment,
    qualification_reason: reasons.join(" "),
    qualification_score,
    threshold,
    score_breakdown: breakdown,
  }
}
