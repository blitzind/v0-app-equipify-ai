/** GE-AIOS-NEXT-2A — Executive briefing cursor types (client-safe, narrowly scoped persistence). */

import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"

export const GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER =
  "ge-aios-next-2a-ava-executive-briefing-cursor-v1" as const

export const GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE =
  "Ava works continuously; the executive briefing hands off what changed since the operator last acknowledged progress." as const

export type GrowthHomeAvaExecutiveBriefingInteractionKind =
  | "home_visit"
  | "briefing_reviewed"
  | "recommendation_accepted"
  | "recommendation_skipped"
  | "package_approved"
  | "strategic_review_completed"
  | "assignment_submitted"
  | "objective_adopted"

export type GrowthHomeAvaExecutiveBriefingState =
  | "meaningful_changes"
  | "no_meaningful_changes"
  | "first_briefing"
  | "previous_briefing_not_acknowledged"
  | "short_return"
  | "overnight_work"
  | "runtime_degraded"
  | "outbound_waiting_for_business_hours"
  | "outbound_disabled"
  | "objective_completed"
  | "strategic_recommendation_available"

export type GrowthHomeAvaExecutiveBriefingContinuousWorkStatus =
  | "working_now"
  | "waiting_for_operator"
  | "waiting_for_business_hours"
  | "waiting_for_customer"
  | "blocked_by_policy"
  | "outbound_disabled"

export type GrowthHomeAvaExecutiveBriefingCursorSnapshot = AvaNarrativeMetricsSnapshot & {
  leadPoolVisible: number
  pendingApprovals: number
  objectiveProgressPercent: number | null
  lastRecommendationKind: string | null
}

export type GrowthHomeAvaExecutiveBriefingHistoryEntry = {
  generatedAt: string
  acknowledgedAt: string | null
  state: GrowthHomeAvaExecutiveBriefingState
  headline: string
}

export type GrowthHomeAvaExecutiveBriefingCursor = {
  qaMarker: typeof GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER
  organizationId: string | null
  lastMeaningfulInteractionAt: string | null
  lastMeaningfulInteractionKind: GrowthHomeAvaExecutiveBriefingInteractionKind | null
  lastBriefingAcknowledgedAt: string | null
  lastBriefingGeneratedAt: string | null
  acknowledgedSnapshot: GrowthHomeAvaExecutiveBriefingCursorSnapshot | null
  briefingHistory: GrowthHomeAvaExecutiveBriefingHistoryEntry[]
}

export type GrowthHomeAvaContinuousExecutiveBriefingPayload = {
  qaMarker: typeof GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE
  title: "Since You Were Last Here"
  state: GrowthHomeAvaExecutiveBriefingState
  openingLine: string
  sinceLabel: string
  activitySummary: string[]
  improvedSummary: string[]
  declinedSummary: string[]
  completedSummary: string[]
  blockedSummary: string[]
  learningLines: string[]
  selfEvaluationLines: string[]
  planAdjustmentLine: string | null
  standoutLine: string | null
  objectiveStillCorrectLine: string | null
  continuousWorkStatus: GrowthHomeAvaExecutiveBriefingContinuousWorkStatus
  continuousWorkLabel: string
  communicationNote: string | null
  hasMeaningfulChanges: boolean
  showAcknowledgeAction: boolean
  previousBriefingUnacknowledged: boolean
  hoursSinceLastAcknowledgment: number | null
  /** Snapshot reference for acknowledgment actions — not rendered directly */
  currentSnapshot?: GrowthHomeAvaExecutiveBriefingCursorSnapshot
}
