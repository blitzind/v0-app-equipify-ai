/** GE-AIOS-MISSION-BALANCE-1A — Canonical mission prioritization types (client-safe). */

import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"

export const GROWTH_MISSION_BALANCE_1A_QA_MARKER = "ge-aios-mission-balance-1a-v1" as const

export const GROWTH_MISSION_BALANCE_1A_RULE =
  "Prioritize already-authorized work using canonical signals only — never invent work or override upstream authorities." as const

/** Lower rank = higher priority. Policy-derived tiers, not fixed scores. */
export const GROWTH_MISSION_BALANCE_PRIORITY_TIERS = [
  "customer_reply_interrupt",
  "package_ready_execution",
  "bounded_research_authorized",
  "high_value_targeted_research",
  "operator_review_preparation",
  "background_improvement",
] as const

export type GrowthMissionBalancePriorityTier = (typeof GROWTH_MISSION_BALANCE_PRIORITY_TIERS)[number]

export const GROWTH_MISSION_BALANCE_TIER_RANK: Record<GrowthMissionBalancePriorityTier, number> = {
  customer_reply_interrupt: 0,
  package_ready_execution: 1,
  bounded_research_authorized: 2,
  high_value_targeted_research: 3,
  operator_review_preparation: 4,
  background_improvement: 5,
}

export const GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS = {
  /** Canonical — persisted or projected by upstream authorities only. */
  canonical: [
    "researchSufficientForPackage",
    "sendReady",
    "researchSufficiencyDecision",
    "boundedResearchAuthorization",
    "admission.state",
    "investment_state",
    "spend_authorized",
    "killSwitchActive",
    "stopConditionActive",
  ],
  /** Derived — computed from canonical inputs inside Mission Balance only. */
  derived: [
    "priorityTier",
    "boundedActionAvailable",
    "boundedBudgetRemaining",
    "sufficiencyProximityScore",
    "staleWorkAgeMs",
    "duplicateLeadSuppressionKey",
    "decisionScoreTiebreak",
  ],
  /** Presentation-only — may influence tie-breaks but never authorize work. */
  presentationOnly: [
    "decision_score",
    "work_item.priority",
    "revenue_queue.intent_score",
    "revenue_queue.recommended_urgency",
  ],
  /** Legacy — read for compatibility; never reinterpreted as authority. */
  legacy: [
    "qualificationRecommendation",
    "growth_mission_priority_4f_read_model",
    "prospectRecommendedNextAction",
  ],
} as const

export type GrowthMissionBalanceInputClassification =
  keyof typeof GROWTH_MISSION_BALANCE_INPUT_CLASSIFICATIONS

export type GrowthMissionBalanceCapacityConstraints = {
  /** Honor active autonomous capacity — cap reordered autonomous candidates. */
  maxAutonomousCandidates: number | null
  /** Honor operator workload — do not promote operator work above autonomous tiers incorrectly. */
  operatorWorkloadActive: boolean
  /** Runtime kill switch — deprioritize non-reply work when active. */
  killSwitchActive: boolean
  /** Outbound transport remains disabled — package-ready prep only, never send. */
  transportDisabled: true
}

export type GrowthMissionBalanceLeadSignals = {
  leadId: string
  packageReady: boolean
  sendReady: boolean
  investmentState: AiOsInvestmentState | null
  spendAuthorizedForResearch: boolean
  boundedAuthorized: boolean
  boundedActionAvailable: boolean
  boundedBudgetRemaining: number
  boundedActionsCompleted: number
  boundedActionsTotal: number
  admissionState: string | null
  requiresOperatorReview: boolean
  staleWorkAgeMs: number
  evidenceConfidence: number | null
  sufficiencyProximityScore: number
}

export type GrowthMissionBalanceOrderingRow = {
  id: string
  leadId: string | null
  tier: GrowthMissionBalancePriorityTier
  tierRank: number
  sufficiencyProximityScore: number
  staleWorkAgeMs: number
  decisionScoreTiebreak: number
  spendAuthorized: boolean
  reason: string
}

export type GrowthMissionBalanceReadModel = {
  qaMarker: typeof GROWTH_MISSION_BALANCE_1A_QA_MARKER
  rule: typeof GROWTH_MISSION_BALANCE_1A_RULE
  generatedAt: string
  capacity: GrowthMissionBalanceCapacityConstraints
  orderedIds: string[]
  rows: GrowthMissionBalanceOrderingRow[]
  authorityChain: readonly string[]
}
