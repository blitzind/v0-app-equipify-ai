/** Client-safe meeting outcome intelligence types (slice 6.33A). */

export const GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER = "meeting-outcome-intelligence-v1" as const

export const MEETING_OUTCOME_SCORE_VERSION = "meeting-outcome-v1" as const

export const MEETING_OUTCOME_FOLLOW_UP_RECOMMENDATIONS = [
  "strong_opportunity",
  "needs_follow_up",
  "risk_of_stall",
  "no_show_recovery",
  "executive_escalation_recommended",
  "send_proposal_recommendation",
  "book_next_meeting_recommendation",
] as const
export type MeetingOutcomeFollowUpRecommendation =
  (typeof MEETING_OUTCOME_FOLLOW_UP_RECOMMENDATIONS)[number]

export const MEETING_OUTCOME_MOMENTUM_TRENDS = ["building", "stable", "slipping", "at_risk"] as const
export type MeetingOutcomeMomentumTrend = (typeof MEETING_OUTCOME_MOMENTUM_TRENDS)[number]

export type MeetingOutcomeScoreInputs = {
  meetingStatus: string | null
  meetingOutcome: string | null
  meetingFollowUpOverdue: boolean
  meetingOutcomeMissing: boolean
  meetingNoShow: boolean
  callOverallScore: number | null
  callBuyingSignalScore: number | null
  callNextStepScore: number | null
  callCompetitorRiskScore: number | null
  callObjectionCount: number
  callBuyingSignalCount: number
  replyIntent: string | null
  replyPriority: string | null
  dealCloseProbability: number | null
  dealRiskScore: number | null
  executionReadinessScore: number | null
  engagementScore: number | null
  priorMeetingCount: number
  priorNoShowCount: number
  attendeeCount: number
}

export type MeetingOutcomeIntelligenceScorePublicView = {
  id: string
  leadId: string
  meetingId: string
  opportunityId: string | null
  ownerUserId: string | null
  meetingOutcomeScore: number
  meetingQualityScore: number
  nextStepConfidence: number
  followUpRecommendation: MeetingOutcomeFollowUpRecommendation
  followUpRecommendationLabel: string
  buyingSignalCount: number
  objectionCount: number
  championDetected: boolean
  decisionMakerPresent: boolean
  timelineDetected: boolean
  budgetSignal: boolean
  urgencySignal: boolean
  noShowRiskPattern: boolean
  momentumTrend: MeetingOutcomeMomentumTrend
  momentumTrendLabel: string
  recommendedNextStep: string
  safeSummary: string
  computedAt: string
}

export type MeetingOutcomeLeadView = {
  qaMarker: typeof GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER
  leadId: string
  companyName: string
  latestScore: MeetingOutcomeIntelligenceScorePublicView | null
  meetingScores: MeetingOutcomeIntelligenceScorePublicView[]
}

export type MeetingOutcomeDashboardSummary = {
  qaMarker: typeof GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER
  generatedAt: string
  stalledOpportunities: MeetingOutcomeDashboardItem[]
  noShowRecoveryQueue: MeetingOutcomeDashboardItem[]
  followUpRecommendations: MeetingOutcomeDashboardItem[]
  highQualityMeetings: MeetingOutcomeDashboardItem[]
  atRiskMeetings: MeetingOutcomeDashboardItem[]
  averageOutcomeScore: number
  averageQualityScore: number
  scoredMeetings: number
}

export type MeetingOutcomeDashboardItem = {
  id: string
  leadId: string
  meetingId: string
  companyName: string
  title: string
  meetingOutcomeScore: number
  meetingQualityScore: number
  followUpRecommendation: MeetingOutcomeFollowUpRecommendation
  followUpRecommendationLabel: string
  recommendedNextStep: string
  momentumTrend: MeetingOutcomeMomentumTrend
  ctaHref: string
}

export const MEETING_OUTCOME_FOLLOW_UP_RECOMMENDATION_LABELS: Record<
  MeetingOutcomeFollowUpRecommendation,
  string
> = {
  strong_opportunity: "Strong opportunity",
  needs_follow_up: "Needs follow-up",
  risk_of_stall: "Risk of stall",
  no_show_recovery: "No-show recovery",
  executive_escalation_recommended: "Executive escalation recommended",
  send_proposal_recommendation: "Send proposal recommendation",
  book_next_meeting_recommendation: "Book next meeting recommendation",
}

export const MEETING_OUTCOME_MOMENTUM_TREND_LABELS: Record<MeetingOutcomeMomentumTrend, string> = {
  building: "Building momentum",
  stable: "Stable",
  slipping: "Slipping",
  at_risk: "At risk",
}
