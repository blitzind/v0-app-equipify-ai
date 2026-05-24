/** Client-safe Growth Engine revenue operating types (slice 6.20A). */

export const GROWTH_REVENUE_OPERATING_QA_MARKER = "growth-revenue-operating-v1" as const

export const GROWTH_REVENUE_FORECAST_PERIODS = [
  "this_month",
  "next_month",
  "this_quarter",
  "next_quarter",
  "custom",
] as const

export type GrowthRevenueForecastPeriod = (typeof GROWTH_REVENUE_FORECAST_PERIODS)[number]

export const GROWTH_REVENUE_MOVEMENT_TYPES = [
  "new_opportunity",
  "amount_increase",
  "amount_decrease",
  "stage_progression",
  "stage_regression",
  "forecast_category_change",
  "close_date_moved",
  "close_won",
  "close_lost",
] as const

export type GrowthRevenueMovementType = (typeof GROWTH_REVENUE_MOVEMENT_TYPES)[number]

export type GrowthRevenueForecastSettings = {
  id: string
  monthlyGoal: number
  quarterlyGoal: number
  defaultForecastPeriod: Exclude<GrowthRevenueForecastPeriod, "custom">
  staleDealThresholdDays: number
  coverageTargetMultiplier: number
  highValueDealThreshold: number
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthRevenueForecastTotals = {
  openPipelineAmount: number
  weightedPipelineAmount: number
  commitForecast: number
  bestCaseForecast: number
  pipelineForecast: number
  omittedAmount: number
  closedWonAmount: number
  closedLostAmount: number
  netNewPipeline: number
  pipelineCreated: number
  pipelineClosed: number
  forecastMovement: number
  pipelineCoverageRatio: number
  averageDealAgeDays: number
  averageStageAgeDays: number
  averageProbability: number
  stalePipelineAmount: number
  atRiskPipelineAmount: number
  overdueCloseDateAmount: number
}

export type GrowthRevenueGoalPacing = {
  activeGoal: number
  goalLabel: string
  weightedPipeline: number
  coverageRatio: number
  gapToGoal: number
  requiredPipeline: number
  forecastConfidence: number
}

export type GrowthRevenueOwnerScorecard = {
  ownerUserId: string | null
  openPipeline: number
  weightedPipeline: number
  commitForecast: number
  closedWon: number
  closedLost: number
  opportunitiesOwned: number
  staleOpportunities: number
  atRiskOpportunities: number
  averageDealAgeDays: number
  followupsDue: number
  activityGapCount: number
}

export type GrowthRevenueMovementEvent = {
  id: string
  movementType: GrowthRevenueMovementType
  opportunityId: string | null
  leadId: string | null
  title: string
  summary: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthRevenueAttentionDeal = {
  opportunityId: string
  leadId: string
  companyName: string
  title: string
  amount: number
  weightedAmount: number
  reason: string
  ownerUserId: string | null
}

export type GrowthRevenueOperatingDashboard = {
  qaMarker: typeof GROWTH_REVENUE_OPERATING_QA_MARKER
  period: GrowthRevenueForecastPeriod
  periodLabel: string
  totals: GrowthRevenueForecastTotals
  goalPacing: GrowthRevenueGoalPacing
  ownerScorecards: GrowthRevenueOwnerScorecard[]
  stageDistribution: Array<{ stageKey: string; stageLabel: string; count: number; weightedAmount: number }>
  movements: GrowthRevenueMovementEvent[]
  atRiskDeals: GrowthRevenueAttentionDeal[]
  staleHighValueDeals: GrowthRevenueAttentionDeal[]
  dealsNeedingAction: GrowthRevenueAttentionDeal[]
  attentionFeed: GrowthRevenueAttentionDeal[]
}

export type GrowthRevenueExecutiveCommandSummary = {
  forecastToGoalRatio: number
  pipelineCoverage: number
  revenueRiskCount: number
  topOwnerGap: number
  highValueStaleCount: number
  commitForecast: number
  activeGoal: number
}

export type GrowthOpportunityFingerprint = {
  id: string
  leadId: string
  companyName: string
  amount: number
  weightedAmount: number
  stageKey: string
  stageOrder: number
  forecastCategory: string
  expectedCloseDate: string | null
  riskScore: number
  isStale: boolean
  ownerUserId: string | null
  closedWon: boolean
  closedLost: boolean
}
