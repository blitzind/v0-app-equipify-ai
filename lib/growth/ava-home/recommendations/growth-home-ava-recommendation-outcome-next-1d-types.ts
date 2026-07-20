/** GE-AIOS-NEXT-1D — Outcome-driven recommendation presentation types (client-safe). */

import type { GrowthHomeAvaRecommendationObjectiveContext } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"

export const GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER =
  "ge-aios-next-1d-ava-outcome-planning-v1" as const

/** Permanent Ava design principle — outcomes before tasks. */
export const GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_DESIGN_PRINCIPLE =
  "Ava describes work in terms of business outcomes, not software tasks." as const

export type GrowthHomeAvaRecommendationOutcomeType =
  | "grow_qualified_pipeline"
  | "prepare_opportunity_package"
  | "launch_outreach"
  | "increase_meetings"
  | "improve_portfolio_quality"
  | "increase_decision_maker_confidence"
  | "expand_approved_market"
  | "complete_mission"
  | "resume_paused_mission"
  | "recover_blocked_mission"

export type GrowthHomeAvaMissionHealthStatus =
  | "on_track"
  | "needs_attention"
  | "blocked"
  | "waiting_on_you"
  | "waiting_on_customer"
  | "low_confidence"

export type GrowthHomeAvaRecommendationProgressMilestone = {
  label: string
  complete: boolean
}

export type GrowthHomeAvaRecommendationOutcomeProjection = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER
  outcomeType: GrowthHomeAvaRecommendationOutcomeType
  /** Business outcome headline — leads the recommendation. */
  outcomeHeadline: string
  /** The immediate task — supporting detail, not the lead. */
  nextStepLabel: string | null
  why: string[]
  currentProgressNarrative: string | null
  progressMilestones: GrowthHomeAvaRecommendationProgressMilestone[]
  progressPercent: number | null
  remainingWork: string[]
  expectedOutcome: string | null
  estimatedEffortLabel: string | null
  businessImpact: string | null
  confidenceLabel: string | null
  whatHappensNext: string[]
  missionHealth: GrowthHomeAvaMissionHealthStatus
  missionHealthLabel: string
  objectiveContext?: GrowthHomeAvaRecommendationObjectiveContext | null
}
