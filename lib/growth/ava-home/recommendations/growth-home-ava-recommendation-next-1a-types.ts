/** GE-AIOS-NEXT-1A — Ava recommendation-driven Home experience (client-safe types). */

import type { GrowthHomeAvaRecommendationExplanation } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"

export const GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER =
  "ge-aios-next-1a-ava-recommendation-home-v1" as const

export const GROWTH_AIOS_NEXT_1A_SINCE_LAST_VISIT_LINE =
  "I've reviewed everything since your last visit." as const

export const GROWTH_AIOS_NEXT_1A_RECOMMENDATION_INTRO =
  "Here's what I recommend." as const

export const GROWTH_AIOS_NEXT_1A_EXHAUSTED_MESSAGE =
  "I've shared every recommendation I have right now. Tell me what you'd like me to do instead." as const

export type GrowthHomeAvaRecommendationKind =
  | "approval_package"
  | "lead_decision"
  | "operator_focus"
  | "work_manager"
  | "waiting_on_you"
  | "daily_queue"
  | "mission_discovery"
  | "supervised_sales"

export type GrowthHomeAvaRecommendationItem = {
  id: string
  rank: number
  kind: GrowthHomeAvaRecommendationKind
  title: string
  headline: string
  detail: string | null
  supportingLine: string | null
  outcomeLine: string | null
  estimatedMinutes: number | null
  estimatedEffortLabel: string | null
  href: string | null
  leadId: string | null
  companyName: string | null
  whyReasons: string[]
  sourceLabel: string
  /** GE-AIOS-NEXT-1B — employee-style presentation */
  employeeHeadline?: string
  employeeLeadParagraph?: string
  employeeSupportingParagraph?: string | null
  expectedOutcomeLabel?: string | null
  executionPathSteps?: string[]
  explanation?: GrowthHomeAvaRecommendationExplanation
  /** GE-AIOS-NEXT-1D — outcome-first presentation projection */
  outcomeProjection?: import("@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d-types").GrowthHomeAvaRecommendationOutcomeProjection
}

export type GrowthHomeAvaRecommendationExperience = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER
  presentationQaMarker?: string | null
  outcomeQaMarker?: string | null
  openingLine: string
  sinceLastVisitLine: string
  recommendationIntro: string
  recommendations: GrowthHomeAvaRecommendationItem[]
  hasRecommendations: boolean
  exhaustedMessage: string
}

export type GrowthHomeAvaOperatorAssignmentPreview = {
  restatement: string
  intentSummary: string
  estimatedEffortLabel: string | null
  href: string | null
  conflictNote: string | null
}
