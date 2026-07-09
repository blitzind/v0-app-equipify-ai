/** GE-AIOS-19A — Sales Operations Center view model (client-safe, presentation only). */

import type { AvaSpecialistTeamStatus } from "@/lib/growth/specialists/types"

export const GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER =
  "ge-aios-19a-sales-operations-center-v1" as const

export const GROWTH_SALES_OPERATIONS_CENTER_ROUTE = "/growth/operations" as const

export type SalesOperationsCenterFocus = {
  title: string
  remainingLabel: string | null
  estimatedCompletionMinutes: number | null
  reason: string | null
}

export type SalesOperationsCenterQueueBucket = {
  id: string
  label: string
  queued: number
  active: number
  completedToday: number
}

export type SalesOperationsCenterWaitingItem = {
  id: string
  label: string
  detail: string | null
  href: string | null
}

export type SalesOperationsCenterDecisionExplanation = {
  headline: string
  supportingReasons: string[]
  topActionTitle: string | null
}

export type SalesOperationsCenterConfidenceRow = {
  id: string
  label: string
  percent: number
}

export type SalesOperationsCenterTimelineEntry = {
  id: string
  timestamp: string
  timeLabel: string
  summary: string
}

export type GrowthSalesOperationsCenterViewModel = {
  qaMarker: typeof GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER
  executiveSummaryLine: string | null
  focus: SalesOperationsCenterFocus | null
  recentlyCompleted: string[]
  queueBuckets: SalesOperationsCenterQueueBucket[]
  waitingItems: SalesOperationsCenterWaitingItem[]
  decisionExplanation: SalesOperationsCenterDecisionExplanation | null
  confidence: SalesOperationsCenterConfidenceRow[]
  timeline: SalesOperationsCenterTimelineEntry[]
  specialistTeam: AvaSpecialistTeamStatus[]
  workingNextLines: string[]
}
