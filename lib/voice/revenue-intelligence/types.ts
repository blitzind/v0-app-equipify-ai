/** Voice revenue intelligence — Phase 2D shared types (client-safe). */

export const VOICE_REVENUE_INTELLIGENCE_QA_MARKER = "voice-revenue-intelligence-v1" as const

export const VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED = true as const
export const VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED = true as const
export const VOICE_REVENUE_INTELLIGENCE_EVIDENCE_REQUIRED = true as const

export const VOICE_REVENUE_INTELLIGENCE_EVENT_TYPES = [
  "stage_progression",
  "stage_regression",
  "deal_stalled",
  "deal_risk_increased",
  "deal_risk_reduced",
  "buying_intent_increased",
  "buying_intent_reduced",
  "follow_up_overdue",
  "decision_maker_engaged",
  "budget_objection_active",
  "competitor_risk_active",
  "timeline_slipping",
  "ready_to_book",
  "renewal_risk",
  "expansion_signal",
] as const

export type VoiceRevenueIntelligenceEventType = (typeof VOICE_REVENUE_INTELLIGENCE_EVENT_TYPES)[number]

export const VOICE_BUYING_STAGES = [
  "unknown",
  "discovery",
  "evaluation",
  "negotiation",
  "commitment",
  "stalled",
  "at_risk",
] as const

export type VoiceBuyingStage = (typeof VOICE_BUYING_STAGES)[number]

export const VOICE_MOMENTUM_DIRECTIONS = [
  "unknown",
  "accelerating",
  "stable",
  "decelerating",
  "reversing",
] as const

export type VoiceMomentumDirection = (typeof VOICE_MOMENTUM_DIRECTIONS)[number]

export const VOICE_REVENUE_INTELLIGENCE_EVENT_STATUSES = [
  "active",
  "acknowledged",
  "dismissed",
  "resolved",
  "expired",
] as const

export type VoiceRevenueIntelligenceEventStatus = (typeof VOICE_REVENUE_INTELLIGENCE_EVENT_STATUSES)[number]

export const VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS = [
  "acknowledge",
  "dismiss",
  "resolve",
] as const

export type VoiceRevenueIntelligenceLifecycleAction = (typeof VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS)[number]

export const REVENUE_INTELLIGENCE_EVENTS_WINDOW = 30 as const
export const REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT = 5 as const
export const REVENUE_INTELLIGENCE_MIN_CONFIDENCE = 0.55 as const
export const REVENUE_INTELLIGENCE_STALE_DAYS = 45 as const

export type VoiceRevenueIntelligenceEventPublicView = {
  id: string
  organizationId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  relationshipMemoryProfileId: string | null
  sourceVoiceCallId: string | null
  sourceMemoryEventId: string | null
  eventType: VoiceRevenueIntelligenceEventType
  buyingStage: VoiceBuyingStage
  momentumDirection: VoiceMomentumDirection
  confidenceScore: number
  evidenceText: string
  recommendedOperatorAction: string | null
  status: VoiceRevenueIntelligenceEventStatus
  createdAt: string
}

export type VoiceRevenueIntelligenceRiskItem = {
  id: string
  title: string
  eventType: VoiceRevenueIntelligenceEventType
  evidenceText: string
  score: number
}

export type VoiceRevenueIntelligenceBuyingSignalItem = {
  id: string
  title: string
  eventType: VoiceRevenueIntelligenceEventType
  evidenceText: string
  confidenceScore: number
}

export type VoiceRevenueIntelligenceStageMovement = {
  direction: "progression" | "regression" | "stable" | "unknown"
  fromStage: VoiceBuyingStage
  toStage: VoiceBuyingStage
  evidenceText: string
}

export type VoiceRevenueIntelligenceFollowUpHealth = {
  status: "healthy" | "due_soon" | "overdue" | "unknown"
  summary: string
  daysSinceLastInteraction: number | null
}

export type VoiceRevenueIntelligenceWhatChanged = {
  summary: string
  evidenceText: string
  eventType: VoiceRevenueIntelligenceEventType | null
}

export type VoiceRevenueIntelligenceWorkspaceSnapshot = {
  qaMarker: typeof VOICE_REVENUE_INTELLIGENCE_QA_MARKER
  relationshipMemoryProfileId: string | null
  relatedOpportunityId: string | null
  currentBuyingStage: VoiceBuyingStage
  momentumDirection: VoiceMomentumDirection
  momentumScore: number
  riskScore: number
  confidenceScore: number
  topRisks: VoiceRevenueIntelligenceRiskItem[]
  topBuyingSignals: VoiceRevenueIntelligenceBuyingSignalItem[]
  unresolvedObjections: string[]
  nextRecommendedOperatorAction: string | null
  followUpHealth: VoiceRevenueIntelligenceFollowUpHealth
  lastMeaningfulInteractionAt: string | null
  whatChangedSinceLastCall: VoiceRevenueIntelligenceWhatChanged | null
  stageMovement: VoiceRevenueIntelligenceStageMovement | null
  activeEventCount: number
  topActiveEvents: VoiceRevenueIntelligenceEventPublicView[]
  windowed: true
  eventsLimit: number
  passiveModeEnabled: true
  autonomousActionsDisabled: true
}

export type VoiceRevenueIntelligenceReadinessSnapshot = {
  qaMarker: typeof VOICE_REVENUE_INTELLIGENCE_QA_MARKER
  schemaReady: boolean
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  evidenceRequirementEnabled: true
  relationshipMemoryDependencyReady: boolean
  opportunityLinkageCoveragePercent: number
  unresolvedRiskCount: number
  followUpRiskCount: number
  activeEventCount: number
  message: string
}

export type DerivedRevenueIntelligenceEventInput = {
  eventType: VoiceRevenueIntelligenceEventType
  buyingStage: VoiceBuyingStage
  momentumDirection: VoiceMomentumDirection
  confidenceScore: number
  evidenceText: string
  recommendedOperatorAction: string
  sourceVoiceCallId?: string | null
  sourceMemoryEventId?: string | null
}
