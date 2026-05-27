/** Client-safe Growth Engine multi-channel revenue intelligence Phase 7 types. */

export const GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER =
  "growth-multichannel-revenue-intelligence-v1" as const

export const GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE =
  "Multi-channel revenue intelligence is evidence-backed and operator-controlled. Recommendations only — no autonomous outreach or fake omnichannel attribution."

export const GROWTH_MULTICHANNEL_CHANNELS = [
  "email",
  "call",
  "sms",
  "linkedin",
  "meeting",
  "website",
  "note",
  "opportunity",
  "cadence",
  "other",
] as const
export type GrowthMultichannelChannel = (typeof GROWTH_MULTICHANNEL_CHANNELS)[number]

export type GrowthMultichannelActivityEntry = {
  id: string
  channel: GrowthMultichannelChannel
  eventKind: string
  eventSource: string
  title: string
  summary: string
  evidenceExcerpt: string | null
  occurredAt: string
  attributionType: string | null
  payload: Record<string, unknown>
}

export type GrowthChannelEngagementMix = {
  channel: GrowthMultichannelChannel | string
  touchCount: number
  lastOccurredAt: string | null
}

export type GrowthOperatorExecutionWorkspaceV2 = {
  qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER
  channelEngagementMix: GrowthChannelEngagementMix[]
  bestNextTouchpoint: string
  engagementGaps: string[]
  stalledOpportunityCount: number
  followUpRiskCount: number
  noResponsePatternCount: number
  channelFatigueWarnings: string[]
  items: GrowthOperatorExecutionAccountItem[]
}

export type GrowthOperatorExecutionAccountItem = {
  leadId: string
  companyLabel: string
  momentumScore: number
  momentumTrend: string
  channelMix: GrowthChannelEngagementMix[]
  bestNextTouchpoint: string
  engagementGap: string | null
  followUpRisk: boolean
  stalled: boolean
}

export type GrowthMultichannelCopilotAssist = {
  qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER
  assistedLabel: "AI-assisted"
  accountActivitySummary: string
  channelEngagementSummary: string
  suggestedNextTouchpoint: string
  engagementGaps: string[]
  operatorPriorities: string[]
  meetingCallOutcomeSummary: string
  evidenceExcerpts: string[]
  confidenceNote: string
}

export type GrowthExecutiveRevenueOpsDashboard = {
  qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER
  channelPerformance: Array<{ channel: string; effectivenessScore: number; touchCount: number }>
  momentumTrendSummary: Record<string, number>
  engagementTrendRate: number
  meetingConversionRate: number
  pipelineAccelerationScore: number
  revenueRiskIndicators: string[]
  operatorActivityCount: number
}

export type GrowthWebsiteIntentCorrelation = {
  pageviewCount: number
  identifiedVisits: number
  outboundActivityCount: number
  replyCount: number
  meetingCount: number
  momentumScore: number | null
  correlationStrength: "unknown" | "weak" | "moderate" | "strong"
  evidence: string[]
}
