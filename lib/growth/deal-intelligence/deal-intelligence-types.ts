/** Client-safe predictive deal intelligence types (slice 6.29A). */

export const GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER = "predictive-deal-intelligence-v1" as const

export const DEAL_INTELLIGENCE_SCORE_VERSION = "predictive-deal-v1" as const

export const DEAL_INTELLIGENCE_SCORE_STATUSES = ["active", "stale", "failed"] as const
export type DealIntelligenceScoreStatus = (typeof DEAL_INTELLIGENCE_SCORE_STATUSES)[number]

export const DEAL_INTELLIGENCE_RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type DealIntelligenceRiskLevel = (typeof DEAL_INTELLIGENCE_RISK_LEVELS)[number]

export const DEAL_INTELLIGENCE_CLOSE_WINDOWS = [
  "this_week",
  "next_14_days",
  "this_month",
  "next_quarter",
  "unknown",
] as const
export type DealIntelligenceCloseWindow = (typeof DEAL_INTELLIGENCE_CLOSE_WINDOWS)[number]

export const DEAL_INTELLIGENCE_OPERATOR_ACTIONS = [
  "call_prospect",
  "send_followup",
  "schedule_meeting",
  "update_opportunity",
  "review_research",
  "manual_review",
  "wait",
] as const
export type DealIntelligenceOperatorAction = (typeof DEAL_INTELLIGENCE_OPERATOR_ACTIONS)[number]

export type DealIntelligenceSignalLabel = {
  key: string
  label: string
}

export type DealIntelligenceScoreInputs = {
  stageKey?: string
  stageAgeDays?: number
  amount?: number
  probability?: number
  forecastCategory?: string
  isStale?: boolean
  riskScore?: number
  engagementTier?: string | null
  engagementScore?: number | null
  meetingsCompleted?: number
  meetingsScheduled?: number
  meetingNoShows?: number
  repliesReceived?: number
  unansweredReplies?: number
  researchConfidence?: number | null
  websiteMaturityScore?: number | null
  painSignalCount?: number
  hasOwner?: boolean
  overdueFollowUp?: boolean
  competitorPressure?: number
  buyingIntent?: string | null
  closeDateOverdue?: boolean
  cadenceTasksOverdue?: number
  callOverallScore?: number | null
  callBuyingSignalScore?: number | null
  callCompetitorRiskScore?: number | null
  callNextStepScore?: number | null
  callOutcome?: string | null
  meetingCompletedWithHighScore?: boolean
}

export type DealIntelligenceScorePublicView = {
  id: string
  leadId: string
  opportunityId: string | null
  ownerUserId: string | null
  scoreStatus: DealIntelligenceScoreStatus
  closeProbability: number
  dealRiskScore: number
  forecastConfidence: number
  momentumScore: number
  engagementScore: number
  meetingScore: number
  replyScore: number
  researchFitScore: number
  followupDisciplineScore: number
  stageHealthScore: number
  riskLevel: DealIntelligenceRiskLevel
  predictedCloseWindow: DealIntelligenceCloseWindow
  recommendedOperatorAction: DealIntelligenceOperatorAction
  riskFactors: DealIntelligenceSignalLabel[]
  positiveSignals: DealIntelligenceSignalLabel[]
  explanation: string
  computedAt: string
}

export type DealIntelligenceDashboardSummary = {
  qaMarker: typeof GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER
  scoredOpportunities: number
  highProbabilityDeals: number
  criticalRiskDeals: number
  averageForecastConfidence: number
  dealsNeedingAction: number
  topRecommendedActions: { action: DealIntelligenceOperatorAction; count: number }[]
  averageCloseProbability: number
}

export type DealIntelligenceForecastAdjustment = {
  aiInformedForecastConfidence: number
  baseForecastConfidence: number
  scoredOpportunities: number
  riskAdjustedForecastNote: string
}

export const DEAL_OPERATOR_ACTION_LABELS: Record<DealIntelligenceOperatorAction, string> = {
  call_prospect: "Call prospect",
  send_followup: "Send follow-up",
  schedule_meeting: "Schedule meeting",
  update_opportunity: "Update opportunity",
  review_research: "Review research",
  manual_review: "Manual review",
  wait: "Wait",
}

export const DEAL_RISK_LEVEL_LABELS: Record<DealIntelligenceRiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
}

export const DEAL_CLOSE_WINDOW_LABELS: Record<DealIntelligenceCloseWindow, string> = {
  this_week: "This week",
  next_14_days: "Next 14 days",
  this_month: "This month",
  next_quarter: "Next quarter",
  unknown: "Unknown",
}
