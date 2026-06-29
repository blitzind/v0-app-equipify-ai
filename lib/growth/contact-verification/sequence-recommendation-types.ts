/**
 * GE-IRE-7C — Canonical sequence recommendation artifact (versioned, forward-compatible).
 */

export const GROWTH_SEQUENCE_RECOMMENDATION_QA_MARKER = "sequence-recommendation-engine-v1" as const

export type SequenceRecommendationVersion = 1

export type SequenceRecommendationType =
  | "cold_outbound"
  | "warm_followup"
  | "nurture"
  | "revalidation"
  | "manual_review"

export type SequenceEnrollmentReadiness =
  | "ready"
  | "needs_research"
  | "needs_verification"
  | "blocked"
  | "not_recommended"

export type SequencePreferredChannel = "email" | "linkedin" | "phone" | "mixed"

export type SequenceCadenceIntensity = "low" | "medium" | "high"

export type SequenceRecommendationNextAction =
  | "enroll_sequence"
  | "verify_contact"
  | "research_more"
  | "manual_review"
  | "wait"
  | "do_not_enroll"

export type SequenceRecommendedSequence = {
  sequenceId?: string
  name: string
  type: SequenceRecommendationType
  confidence: number
}

export type SequenceCadence = {
  intensity: SequenceCadenceIntensity
  suggestedTouchCount: number
  suggestedDurationDays: number
}

export type SequencePersonalizationInputs = {
  primaryReason: string
  companyContext?: string
  contactContext?: string
  buyingCommitteeContext?: string
  riskContext?: string
}

/**
 * Sequence recommendation confidence (SRE v1):
 *
 * confidence =
 *   qualification.confidence      × 0.30
 * + sequenceMatchScore            × 0.25
 * + engagementScore               × 0.20
 * + acquisition.overallConfidence × 0.15
 * + learningSignalBoost           × 0.10
 */
export const SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING = {
  version: "sre-v1",
  components: {
    qualification_confidence: 0.3,
    sequence_match: 0.25,
    engagement: 0.2,
    acquisition_confidence: 0.15,
    learning_signal: 0.1,
  },
} as const

export type SequenceRecommendation = {
  version: SequenceRecommendationVersion
  companyId: string
  generatedAt: string
  recommendedSequence: SequenceRecommendedSequence
  enrollmentReadiness: SequenceEnrollmentReadiness
  preferredChannel: SequencePreferredChannel
  cadence: SequenceCadence
  personalizationInputs: SequencePersonalizationInputs
  reasons: string[]
  risks: string[]
  blockers: string[]
  nextAction: SequenceRecommendationNextAction
  confidence: number
}
