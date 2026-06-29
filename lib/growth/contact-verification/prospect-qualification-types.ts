/**
 * GE-IRE-7B — Canonical prospect qualification artifact (versioned, forward-compatible).
 */

import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"

export const GROWTH_PROSPECT_QUALIFICATION_QA_MARKER = "prospect-qualification-engine-v1" as const

export type ProspectQualificationVersion = 1

export type ProspectQualificationState =
  | "qualified"
  | "research"
  | "nurture"
  | "blocked"
  | "disqualified"

export type ProspectQualificationNextAction =
  | "enroll_sequence"
  | "research_more"
  | "verify_contact"
  | "find_decision_maker"
  | "wait"
  | "manual_review"
  | "disqualify"

/**
 * Normalized overall qualification score (PQE v1):
 *
 * overallScore =
 *   fitScore                 × 0.20
 * + contactScore             × 0.25
 * + engagementScore          × 0.20
 * + buyingCommitteeCoverage  × 0.15
 * + acquisitionConfidence    × 0.20
 *
 * acquisitionConfidence = acquisitionCandidate.overallConfidence (0–100).
 * All component scores normalized to 0–100 before weighting.
 */
export const PROSPECT_QUALIFICATION_SCORE_WEIGHTING = {
  version: "pqe-v1",
  components: {
    fit: 0.2,
    contact: 0.25,
    engagement: 0.2,
    buying_committee_coverage: 0.15,
    acquisition_confidence: 0.2,
  },
} as const

export type ProspectQualification = {
  version: ProspectQualificationVersion
  companyId: string
  generatedAt: string
  qualification: ProspectQualificationState
  overallScore: number
  fitScore: number
  contactScore: number
  engagementScore: number
  buyingCommitteeCoverage: number
  confidence: number
  acquisitionCandidate: AcquisitionCandidate
  strengths: string[]
  risks: string[]
  blockers: string[]
  recommendations: string[]
  nextAction: ProspectQualificationNextAction
}
