/**
 * GE-AIOS-ADAPTIVE-LOOP-1A — Continuous relationship & strategy evolution types (client-safe).
 * Computed at prep time — reuses Relationship Strategy 2A assessment, no separate persistence.
 */

import type { RevenueStrategyRecommendation } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

export const GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER =
  "ge-aios-adaptive-loop-1a-continuous-relationship-strategy-evolution-v1" as const

export const GROWTH_AIOS_ADAPTIVE_LOOP_1A_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-adaptive-loop-1a-operator-review-layout-v1" as const

export type AdaptiveProspectEventCategory = "positive" | "negative" | "neutral"

export const ADAPTIVE_POSITIVE_PROSPECT_EVENTS = [
  "reply_received",
  "meeting_booked",
  "meeting_completed",
  "referral",
  "champion_identified",
  "executive_engagement",
  "proposal_requested",
  "pricing_discussion",
  "buying_committee_expansion",
] as const

export const ADAPTIVE_NEGATIVE_PROSPECT_EVENTS = [
  "objection",
  "ghosting",
  "unsubscribe",
  "already_have_software",
  "competitor_mentioned",
  "budget_objection",
  "timing_objection",
  "relationship_deterioration",
] as const

export const ADAPTIVE_NEUTRAL_PROSPECT_EVENTS = [
  "contact_changed",
  "decision_maker_changed",
  "company_research_updated",
  "website_changes",
  "funding",
  "acquisition",
  "organizational_changes",
] as const

export type AdaptivePositiveProspectEvent = (typeof ADAPTIVE_POSITIVE_PROSPECT_EVENTS)[number]
export type AdaptiveNegativeProspectEvent = (typeof ADAPTIVE_NEGATIVE_PROSPECT_EVENTS)[number]
export type AdaptiveNeutralProspectEvent = (typeof ADAPTIVE_NEUTRAL_PROSPECT_EVENTS)[number]

export type AdaptiveProspectEventType =
  | AdaptivePositiveProspectEvent
  | AdaptiveNegativeProspectEvent
  | AdaptiveNeutralProspectEvent

export type AdaptiveProspectEvent = {
  type: AdaptiveProspectEventType
  category: AdaptiveProspectEventCategory
  occurredAt: string
  summary: string
  detail?: string | null
}

export type AdaptiveStrategySnapshot = {
  recommendation: RevenueStrategyRecommendation | null
  relationshipGoal: string | null
  momentumTrend: string | null
  trustBudget: string | null
  relationshipConfidence: string | null
}

export type AdaptiveStrategyChangeDetection = {
  relationshipChangedBecause: string[]
  previousStrategy: AdaptiveStrategySnapshot
  currentStrategy: AdaptiveStrategySnapshot
  meaningfulChanges: string[]
}

export type AdaptiveLoopEvolutionSummary = {
  qaMarker: typeof GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER
  eventCount: number
  recentEvents: AdaptiveProspectEvent[]
  strategyChange: AdaptiveStrategyChangeDetection
  relationshipAssessment: GrowthOutreachRelationshipAssessment
  learningAdvisoryApplied: boolean
}
