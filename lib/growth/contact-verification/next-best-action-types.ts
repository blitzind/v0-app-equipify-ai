/**
 * GE-IRE-7D — Canonical next best action artifact (versioned, forward-compatible).
 */

export const GROWTH_NEXT_BEST_ACTION_QA_MARKER = "next-best-action-engine-v1" as const

export type NextBestActionVersion = 1

export type NextBestActionType =
  | "enroll_sequence"
  | "verify_contact"
  | "research_company"
  | "identify_decision_maker"
  | "monitor_buying_signals"
  | "manual_review"
  | "disqualify"

export type NextBestActionPriority = "critical" | "high" | "medium" | "low"

export type NextBestActionExecutionReadiness = "ready" | "blocked" | "waiting"

export type NextBestActionChannel = "email" | "linkedin" | "phone" | "mixed"

export type NextBestActionRecommendedSequence = {
  id?: string
  name: string
}

/**
 * Next best action confidence (NBA v1):
 *
 * confidence =
 *   qualification.confidence     × 0.30
 * + sequence.confidence        × 0.25
 * + acquisition.overallConfidence × 0.20
 * + engagementScore              × 0.15
 * + learningSignalBoost          × 0.10
 */
export const NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING = {
  version: "nba-v1",
  components: {
    qualification_confidence: 0.3,
    sequence_confidence: 0.25,
    acquisition_confidence: 0.2,
    engagement: 0.15,
    learning_signal: 0.1,
  },
} as const

export type NextBestAction = {
  version: NextBestActionVersion
  companyId: string
  generatedAt: string
  action: NextBestActionType
  priority: NextBestActionPriority
  confidence: number
  executionReadiness: NextBestActionExecutionReadiness
  recommendedSequence?: NextBestActionRecommendedSequence
  recommendedChannel: NextBestActionChannel
  recommendedDelayHours?: number
  reasons: string[]
  blockers: string[]
  dependencies: string[]
  warnings: string[]
}
