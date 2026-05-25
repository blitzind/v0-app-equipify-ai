/** Client-safe revenue execution types (slice 6.31A). */

export const GROWTH_REVENUE_EXECUTION_QA_MARKER = "revenue-execution-v1" as const

export const EXECUTION_PRIORITY_BANDS = ["critical", "high", "medium", "low"] as const
export type ExecutionPriorityBand = (typeof EXECUTION_PRIORITY_BANDS)[number]

export const EXECUTION_PRIORITY_SIGNAL_KEYS = [
  "deal_risk_increase",
  "competitor_detected",
  "buying_signal_detected",
  "meeting_follow_up_overdue",
  "next_step_missing",
  "unanswered_reply",
  "high_confidence_close_window",
  "renewal_risk",
  "expansion_candidate",
  "low_call_score",
  "stalled_opportunity",
  "no_owner_assigned",
  "open_objections",
  "onboarding_stalled",
  "provider_failure",
  "calendar_conflict",
  "call_quality_decline",
  "missing_follow_up",
  "stale_opportunity",
] as const
export type ExecutionPrioritySignalKey = (typeof EXECUTION_PRIORITY_SIGNAL_KEYS)[number]

export const EXECUTION_QUEUE_CATEGORIES = [
  "revenue_protection",
  "deal_closing",
  "follow_up_recovery",
  "research",
  "meeting_completion",
  "renewal",
  "expansion",
  "sequence",
  "ownership",
] as const
export type ExecutionQueueCategory = (typeof EXECUTION_QUEUE_CATEGORIES)[number]

export const EXECUTION_SPRINT_TYPES = [
  "revenue_rescue",
  "deal_closing",
  "follow_up_recovery",
  "research_buildout",
  "meeting_completion",
  "renewal_protection",
  "sequence_cleanup",
] as const
export type ExecutionSprintType = (typeof EXECUTION_SPRINT_TYPES)[number]

export const EXECUTION_SPRINT_DURATIONS = [30, 60, 90] as const
export type ExecutionSprintDuration = (typeof EXECUTION_SPRINT_DURATIONS)[number]

export const EXECUTION_SPRINT_STATUSES = ["recommended", "active", "completed", "cancelled"] as const
export type ExecutionSprintStatus = (typeof EXECUTION_SPRINT_STATUSES)[number]

export const EXPANSION_RECOMMENDATION_KINDS = [
  "upsell",
  "cross_sell",
  "referral_ask",
  "case_study_candidate",
  "review_ask",
] as const
export type ExpansionRecommendationKind = (typeof EXPANSION_RECOMMENDATION_KINDS)[number]

export type ExecutionPrioritySignal = {
  key: ExecutionPrioritySignalKey
  label: string
  weight: number
}

export type ExecutionPrioritySignalsInput = Partial<Record<ExecutionPrioritySignalKey, boolean>>

export type ExecutionQueueItem = {
  id: string
  leadId: string
  companyName: string
  title: string
  why: string
  category: ExecutionQueueCategory
  executionPriorityScore: number
  priorityBand: ExecutionPriorityBand
  signals: ExecutionPrioritySignal[]
  effortMinutes: number
  revenueInfluence: number
  ownerUserId: string | null
  ctaLabel: string
  ctaHref: string
  referenceId?: string | null
}

export type RevenueProtectionItem = {
  id: string
  kind: ExecutionPrioritySignalKey
  label: string
  leadId: string | null
  companyName: string
  priorityBand: ExecutionPriorityBand
  executionPriorityScore: number
  why: string
  ctaHref: string
  revenueAtRisk: number
}

export type ExpansionOpportunityItem = {
  id: string
  leadId: string | null
  customerProfileId: string | null
  companyName: string
  recommendation: ExpansionRecommendationKind
  recommendationLabel: string
  executionPriorityScore: number
  signals: ExecutionPrioritySignal[]
  why: string
  ctaHref: string
}

export type ExecutionSprintTask = {
  queueItemId: string
  title: string
  companyName: string
  effortMinutes: number
  ctaHref: string
}

export type ExecutionSprintPlan = {
  id: string
  sprintType: ExecutionSprintType
  sprintTypeLabel: string
  durationMinutes: ExecutionSprintDuration
  status: ExecutionSprintStatus
  expectedRevenueImpact: number
  tasks: ExecutionSprintTask[]
  taskCount: number
  estimatedEffortMinutes: number
  operatorLoadScore: number
  startedAt?: string | null
  completedAt?: string | null
}

export type ExecutionCapacitySummary = {
  criticalItems: number
  highItems: number
  totalQueueItems: number
  estimatedEffortMinutes: number
  operatorFocusLoad: number
  executionPressure: number
  executionPressureLabel: string
  availableCapacityMinutes: number
  assignedOwners: number
  unassignedItems: number
}

export type ExecutionMorningFocus = {
  topRevenuePriorities: ExecutionQueueItem[]
  revenueProtectedToday: number
  pipelineMomentum: "building" | "stable" | "slipping" | "at_risk"
  pipelineMomentumLabel: string
  executionCapacity: ExecutionCapacitySummary
}

export type ExecutionOperatorScoreTrend = {
  score: number
  followUpsCompleted: number
  criticalTasksCompleted: number
  meetingsCompleted: number
  repliesHandled: number
  researchCoverage: number
  callCoachingImprovement: number
  staleOpportunityRecovery: number
}

export type ExecutionOperatorScore = {
  current: ExecutionOperatorScoreTrend
  trend7Day: ExecutionOperatorScoreTrend
  trend30Day: ExecutionOperatorScoreTrend
}

export type GrowthExecutionDashboardSummary = {
  criticalExecutionItems: number
  revenueProtected: number
  followUpDebt: number
  riskReduction: number
  executionCompletionPercent: number
}

export type GrowthExecutionDashboard = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  generatedAt: string
  morningFocus: ExecutionMorningFocus
  summary: GrowthExecutionDashboardSummary
  operatorScore: ExecutionOperatorScore
  revenueProtectionQueue: RevenueProtectionItem[]
  expansionOpportunities: ExpansionOpportunityItem[]
  recommendedSprints: ExecutionSprintPlan[]
  activeSprint: ExecutionSprintPlan | null
}

export type GrowthExecutionQueue = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  generatedAt: string
  items: ExecutionQueueItem[]
  capacity: ExecutionCapacitySummary
}

export type GrowthExecutionSprintsResponse = {
  qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER
  generatedAt: string
  recommended: ExecutionSprintPlan[]
  active: ExecutionSprintPlan | null
}

export const EXECUTION_SPRINT_TYPE_LABELS: Record<ExecutionSprintType, string> = {
  revenue_rescue: "Revenue Rescue",
  deal_closing: "Deal Closing",
  follow_up_recovery: "Follow-Up Recovery",
  research_buildout: "Research Buildout",
  meeting_completion: "Meeting Completion",
  renewal_protection: "Renewal Protection",
  sequence_cleanup: "Sequence Cleanup",
}

export const EXPANSION_RECOMMENDATION_LABELS: Record<ExpansionRecommendationKind, string> = {
  upsell: "Upsell",
  cross_sell: "Cross-sell",
  referral_ask: "Referral ask",
  case_study_candidate: "Case study candidate",
  review_ask: "Review ask",
}
