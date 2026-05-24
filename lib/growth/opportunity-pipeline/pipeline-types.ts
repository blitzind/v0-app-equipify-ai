/** Client-safe Growth Engine opportunity pipeline types (slice 6.19A). */

export const GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER = "growth-opportunity-pipeline-v1" as const

export const GROWTH_OPPORTUNITY_STAGE_KEYS = [
  "new_opportunity",
  "discovery",
  "qualified",
  "proposal",
  "negotiation",
  "verbal_commit",
  "closed_won",
  "closed_lost",
] as const

export type GrowthOpportunityStageKey = (typeof GROWTH_OPPORTUNITY_STAGE_KEYS)[number]

export const GROWTH_OPPORTUNITY_FORECAST_CATEGORIES = [
  "commit",
  "best_case",
  "pipeline",
  "omitted",
] as const

export type GrowthOpportunityForecastCategory = (typeof GROWTH_OPPORTUNITY_FORECAST_CATEGORIES)[number]

export const GROWTH_OPPORTUNITY_PRIORITIES = ["low", "medium", "high", "critical"] as const

export type GrowthOpportunityPriority = (typeof GROWTH_OPPORTUNITY_PRIORITIES)[number]

export const GROWTH_OPPORTUNITY_SOURCES = ["manual", "lead_conversion", "import"] as const

export type GrowthOpportunitySource = (typeof GROWTH_OPPORTUNITY_SOURCES)[number]

export const GROWTH_OPPORTUNITY_PIPELINE_VIEWS = [
  "my_pipeline",
  "all_pipeline",
  "at_risk",
  "needs_action",
  "forecast",
  "owner_board",
] as const

export type GrowthOpportunityPipelineView = (typeof GROWTH_OPPORTUNITY_PIPELINE_VIEWS)[number]

export type GrowthOpportunityPipelineStage = {
  key: GrowthOpportunityStageKey
  label: string
  sortOrder: number
  isClosed: boolean
  isWon: boolean
}

export type GrowthOpportunityPipelineSettings = {
  id: string
  stages: GrowthOpportunityPipelineStage[]
  stageProbabilityOverrides: Partial<Record<GrowthOpportunityStageKey, number>>
  staleStageDays: number
  staleActivityDays: number
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOpportunityRiskSignal = {
  key: string
  label: string
  weight: number
}

export type GrowthOpportunity = {
  id: string
  orgId: string | null
  leadId: string
  ownerUserId: string | null
  companyName: string
  title: string
  stageKey: GrowthOpportunityStageKey
  stageLabel: string
  amount: number
  probability: number
  weightedAmount: number
  forecastCategory: GrowthOpportunityForecastCategory
  expectedCloseDate: string | null
  source: GrowthOpportunitySource
  priority: GrowthOpportunityPriority
  riskScore: number
  riskSignals: GrowthOpportunityRiskSignal[]
  nextRequiredAction: string | null
  lossReason: string | null
  isStale: boolean
  ageDays: number
  stageAgeDays: number
  lastActivityAt: string
  stageEnteredAt: string
  closedWonAt: string | null
  closedLostAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOpportunityStageHistoryEntry = {
  id: string
  opportunityId: string
  fromStageKey: string | null
  toStageKey: string
  amount: number | null
  probability: number | null
  changedBy: string | null
  changedAt: string
}

export type GrowthOpportunityPipelineListInput = {
  view?: GrowthOpportunityPipelineView
  ownerUserId?: string | null
  stageKey?: GrowthOpportunityStageKey
  forecastCategory?: GrowthOpportunityForecastCategory
  priority?: GrowthOpportunityPriority
  stale?: boolean
  createdAfter?: string
  createdBefore?: string
  limit?: number
  offset?: number
}

export type GrowthOpportunityPipelineListResult = {
  items: GrowthOpportunity[]
  total: number
  hasMore: boolean
}

export type GrowthOpportunityPipelineDashboard = {
  qaMarker: typeof GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER
  pipelineByStage: Array<{ stageKey: string; stageLabel: string; count: number; amount: number; weightedAmount: number }>
  forecastTotals: Record<GrowthOpportunityForecastCategory, { count: number; amount: number; weightedAmount: number }>
  weightedPipeline: number
  openPipeline: number
  wonRevenue: number
  lostRevenue: number
  averageDealAgeDays: number
  dealsNeedingAction: number
  staleOpportunityCount: number
  atRiskCount: number
  ownerPerformance: Array<{ ownerUserId: string | null; openCount: number; wonAmount: number; weightedPipeline: number }>
}

export type GrowthOpportunityDetail = GrowthOpportunity & {
  stageHistory: GrowthOpportunityStageHistoryEntry[]
}

export type CreateGrowthOpportunityInput = {
  leadId: string
  title?: string
  amount?: number
  stageKey?: GrowthOpportunityStageKey
  forecastCategory?: GrowthOpportunityForecastCategory
  expectedCloseDate?: string | null
  ownerUserId?: string | null
  source?: GrowthOpportunitySource
  priority?: GrowthOpportunityPriority
}

export type UpdateGrowthOpportunityStageInput = {
  stageKey: GrowthOpportunityStageKey
  lossReason?: string | null
}

export type GrowthOpportunityCommandSummary = {
  pipelineRiskCount: number
  forecastCommit: number
  forecastBestCase: number
  forecastPipeline: number
  revenueMovementWon: number
  revenueMovementLost: number
  dealsNeedingAction: number
}
