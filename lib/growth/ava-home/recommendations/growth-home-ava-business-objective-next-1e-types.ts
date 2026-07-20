/** GE-AIOS-NEXT-1E — Business objective leadership types (client-safe). */

import type { GrowthObjectiveType } from "@/lib/growth/objectives/growth-objective-types"

export const GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER =
  "ge-aios-next-1e-ava-business-objective-v1" as const

export const GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE =
  "Ava owns business objectives — every recommendation exists to advance one objective." as const

export type GrowthHomeAvaObjectiveHealthStatus =
  | "ahead"
  | "on_track"
  | "needs_attention"
  | "blocked"
  | "waiting_on_you"
  | "waiting_on_customer"
  | "pipeline_risk"
  | "confidence_risk"
  | "completed"

export type GrowthHomeAvaBusinessObjectiveProjection = {
  id: string
  title: string
  objectiveType: GrowthObjectiveType
  targetValue: number
  currentValue: number
  progressLabel: string
  progressPercent: number | null
  milestoneLabel: string | null
  forecastLabel: string
  health: GrowthHomeAvaObjectiveHealthStatus
  healthLabel: string
  ownerLabel: string
  whyPriority: string[]
  blockers: string[]
  completed: boolean
  completionMessage: string | null
  nextObjectiveTitle: string | null
}

export type GrowthHomeAvaBusinessScoreboardMetric = {
  id: string
  label: string
  valueLabel: string
}

export type GrowthHomeAvaRecommendationObjectiveContext = {
  objectiveTitle: string
  contributionLabel: string | null
  remainingLabel: string | null
  nextMilestoneLabel: string | null
  futureObjectiveLabel: string | null
}

export type GrowthHomeAvaBusinessObjectiveLeadershipPayload = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER
  ownershipPrinciple: typeof GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE
  teamObjectiveLine: string
  recommendationIntro: string
  primaryObjective: GrowthHomeAvaBusinessObjectiveProjection | null
  secondaryObjective: GrowthHomeAvaBusinessObjectiveProjection | null
  scoreboard: GrowthHomeAvaBusinessScoreboardMetric[]
}
