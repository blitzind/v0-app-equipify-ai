/** Client-safe Growth Engine revenue intelligence Phase 6 types. */

export const GROWTH_REVENUE_INTELLIGENCE_QA_MARKER = "growth-revenue-intelligence-v1" as const

export const GROWTH_REVENUE_INTELLIGENCE_PRIVACY_NOTE =
  "Revenue intelligence is evidence-backed and operator-reviewable. No autonomous deal progression, fake forecasting, or fabricated pipeline scoring."

export const GROWTH_BUYING_MOMENTUM_TRENDS = ["accelerating", "steady", "cooling", "stalled"] as const
export type GrowthBuyingMomentumTrend = (typeof GROWTH_BUYING_MOMENTUM_TRENDS)[number]

export const GROWTH_OPPORTUNITY_WORKSPACE_VIEWS = [
  "active_opportunities",
  "hottest_accounts",
  "stalled_conversations",
  "unresolved_objections",
  "demo_ready",
  "pricing_stage",
  "high_risk",
  "multi_thread",
  "buying_committee",
] as const
export type GrowthOpportunityWorkspaceView = (typeof GROWTH_OPPORTUNITY_WORKSPACE_VIEWS)[number]

export const GROWTH_REVENUE_PHASE6_SIGNAL_TYPES = [
  "demo_request",
  "pricing_interest",
  "implementation_discussion",
  "technical_evaluation",
  "replacement_intent",
  "roi_discussion",
  "engagement_acceleration",
  "meeting_attendance",
  "follow_up_responsiveness",
  "multi_person_engagement",
  "meeting_interest",
  "timeline_interest",
  "decision_maker_detected",
  "committee_detected",
  "competitive_signal",
  "urgency_signal",
] as const
export type GrowthRevenuePhase6SignalType = (typeof GROWTH_REVENUE_PHASE6_SIGNAL_TYPES)[number]

export type GrowthOpportunitySignalEvidence = {
  signalType: string
  confidence: string
  excerpt: string
  source: string
  occurredAt: string
}

export type GrowthBuyingMomentumSnapshot = {
  leadId: string
  companyLabel: string
  momentumScore: number
  momentumTrend: GrowthBuyingMomentumTrend
  replyVelocityScore: number
  engagementDepthScore: number
  stakeholderCount: number
  objectionResolutionScore: number
  explainability: string[]
  evidence: string[]
  snapshotDate: string
}

export type GrowthBuyingCommitteeMap = {
  leadId: string
  companyLabel: string
  stakeholderCount: number
  completenessScore: number
  committeeMembers: Array<{ label: string; roleHint: string | null; evidence: string }>
  missingStakeholderSuggestions: string[]
  evidence: string[]
}

export type GrowthRevenueCopilotAssist = {
  qaMarker: typeof GROWTH_REVENUE_INTELLIGENCE_QA_MARKER
  assistedLabel: "AI-assisted"
  accountSummary: string
  momentumSummary: string
  objectionSummary: string
  missingInformation: string[]
  suggestedNextAction: string
  stakeholderActivitySummary: string
  followUpPriorities: string[]
  evidenceExcerpts: string[]
  confidenceNote: string
}

export type GrowthOpportunityWorkspaceItem = {
  leadId: string
  companyLabel: string
  momentumScore: number
  momentumTrend: GrowthBuyingMomentumTrend
  signalCount: number
  unresolvedObjectionCount: number
  demoReady: boolean
  pricingStage: boolean
  highRisk: boolean
  multiThread: boolean
  committeeCompleteness: number
  lastActivityAt: string | null
  recommendedAction: string | null
}

export type GrowthOpportunityWorkspaceDashboard = {
  qaMarker: typeof GROWTH_REVENUE_INTELLIGENCE_QA_MARKER
  activeOpportunityCount: number
  hottestAccountCount: number
  stalledConversationCount: number
  unresolvedObjectionCount: number
  demoReadyCount: number
  pricingStageCount: number
  highRiskCount: number
  multiThreadCount: number
  buyingCommitteeCount: number
  items: GrowthOpportunityWorkspaceItem[]
}

export type GrowthExecutiveRevenueDashboard = {
  qaMarker: typeof GROWTH_REVENUE_INTELLIGENCE_QA_MARKER
  opportunityPipelineCount: number
  hottestAccounts: GrowthOpportunityWorkspaceItem[]
  momentumTrendSummary: Record<GrowthBuyingMomentumTrend, number>
  objectionTrendRate: number
  meetingConversionRate: number
  campaignEffectivenessScore: number
  senderEffectivenessScore: number
  domainEffectivenessScore: number
  operationalRiskToRevenue: string[]
  campaignAttribution: {
    opportunitiesGenerated: number
    demoRequests: number
    pricingQuestions: number
    positiveReplies: number
  }
}

export type GrowthSalesExecutionInsights = {
  replyQualityScore: number
  objectionResolutionRate: number
  meetingConversionRate: number
  opportunityConversionRate: number
  campaignOpportunityConversion: number
  senderEffectiveness: number
  domainEffectiveness: number
  sequenceEffectiveness: number
  operatorResponseQuality: number
}
