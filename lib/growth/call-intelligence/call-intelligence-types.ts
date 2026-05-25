/** Client-safe true call intelligence types (slice 6.30A). */

export const GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER = "true-call-intelligence-v1" as const

export const CALL_INTELLIGENCE_SCORE_VERSION = "true-call-v1" as const

export const CALL_INTELLIGENCE_RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type CallIntelligenceRiskLevel = (typeof CALL_INTELLIGENCE_RISK_LEVELS)[number]

export const CALL_INTELLIGENCE_OUTCOMES = ["positive", "neutral", "negative", "unknown"] as const
export type CallIntelligenceOutcome = (typeof CALL_INTELLIGENCE_OUTCOMES)[number]

export type CallIntelligenceSignalLabel = {
  key: string
  label: string
}

export type CallIntelligenceMetrics = {
  transcriptFinalizedCount?: number
  guidanceGeneratedCount?: number
  sessionHealthScore?: number
  executionScore?: number
  providerInterruptions?: number
  guidanceLatencyMs?: number
  sessionDurationMs?: number
  incomplete?: boolean
}

export type CallIntelligenceScoreInputs = {
  transcriptFinalizedCount: number
  guidanceGeneratedCount: number
  objectionCount: number
  buyingSignalCount: number
  discoveryGapCount: number
  competitorPressureCount: number
  providerInterruptions: number
  averageTranscriptLatencyMs: number
  sessionHealthScore: number
  guidanceLatencyMs: number
  executionScore: number | null
  talkRatioInGoalRange: boolean
  repTalkPercent: number
  discoveryCoveragePercent: number
  nextStepSecured: boolean
  meetingCompleted: boolean
  meetingNoShow: boolean
  meetingOutcomeMissing: boolean
  meetingFollowUpDue: boolean
  acceptedGuidanceCount: number
}

export type CallIntelligenceExtractedSignals = {
  detectedObjections: CallIntelligenceSignalLabel[]
  buyingSignals: CallIntelligenceSignalLabel[]
  competitorMentions: CallIntelligenceSignalLabel[]
  discoveryGaps: CallIntelligenceSignalLabel[]
  nextStepCommitments: CallIntelligenceSignalLabel[]
  coachingOpportunities: CallIntelligenceSignalLabel[]
}

export type CallIntelligenceScorecardPublicView = {
  id: string
  leadId: string
  opportunityId: string | null
  meetingId: string | null
  realtimeSessionId: string | null
  ownerUserId: string | null
  overallScore: number
  conversationQualityScore: number
  discoveryScore: number
  objectionHandlingScore: number
  buyingSignalScore: number
  nextStepScore: number
  talkListenBalanceScore: number
  competitorRiskScore: number
  confidenceScore: number
  riskLevel: CallIntelligenceRiskLevel
  outcome: CallIntelligenceOutcome
  detectedObjections: CallIntelligenceSignalLabel[]
  buyingSignals: CallIntelligenceSignalLabel[]
  competitorMentions: CallIntelligenceSignalLabel[]
  discoveryGaps: CallIntelligenceSignalLabel[]
  nextStepCommitments: CallIntelligenceSignalLabel[]
  coachingOpportunities: CallIntelligenceSignalLabel[]
  safeSummary: string
  recommendedNextAction: string
  metrics: CallIntelligenceMetrics
  computedAt: string
}

export type CallIntelligenceDashboardSummary = {
  qaMarker: typeof GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER
  averageCallScore: number
  criticalCallRisks: number
  callsNeedingFollowUp: number
  unresolvedObjections: number
  competitorMentions: number
  nextStepMissingCount: number
  topCoachingOpportunities: { key: string; label: string; count: number }[]
  scoredCalls: number
}

export const CALL_RISK_LEVEL_LABELS: Record<CallIntelligenceRiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
}

export const CALL_OUTCOME_LABELS: Record<CallIntelligenceOutcome, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  unknown: "Unknown",
}
