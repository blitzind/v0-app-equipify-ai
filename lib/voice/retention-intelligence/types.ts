/** Voice retention intelligence — Phase 2E shared types (client-safe). */

export const VOICE_RETENTION_INTELLIGENCE_QA_MARKER = "voice-retention-intelligence-v1" as const

export const VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED = true as const
export const VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED = true as const
export const VOICE_RETENTION_INTELLIGENCE_EVIDENCE_REQUIRED = true as const

export const VOICE_RETENTION_INTELLIGENCE_EVENT_TYPES = [
  "churn_risk_increased",
  "churn_risk_reduced",
  "unresolved_issue_active",
  "satisfaction_signal",
  "dissatisfaction_signal",
  "renewal_risk",
  "renewal_confidence_increased",
  "expansion_signal",
  "cross_sell_signal",
  "upsell_signal",
  "referral_signal",
  "service_gap_detected",
  "relationship_strengthened",
  "relationship_weakened",
  "follow_up_needed",
  "escalation_required",
] as const

export type VoiceRetentionIntelligenceEventType = (typeof VOICE_RETENTION_INTELLIGENCE_EVENT_TYPES)[number]

export const VOICE_HEALTH_DIRECTIONS = [
  "unknown",
  "improving",
  "stable",
  "declining",
  "at_risk",
] as const

export type VoiceHealthDirection = (typeof VOICE_HEALTH_DIRECTIONS)[number]

export const VOICE_RETENTION_RISK_LEVELS = [
  "unknown",
  "low",
  "moderate",
  "elevated",
  "critical",
] as const

export type VoiceRetentionRiskLevel = (typeof VOICE_RETENTION_RISK_LEVELS)[number]

export const VOICE_RETENTION_INTELLIGENCE_EVENT_STATUSES = [
  "active",
  "acknowledged",
  "dismissed",
  "resolved",
  "expired",
] as const

export type VoiceRetentionIntelligenceEventStatus = (typeof VOICE_RETENTION_INTELLIGENCE_EVENT_STATUSES)[number]

export const VOICE_RETENTION_INTELLIGENCE_LIFECYCLE_ACTIONS = [
  "acknowledge",
  "dismiss",
  "resolve",
] as const

export type VoiceRetentionIntelligenceLifecycleAction = (typeof VOICE_RETENTION_INTELLIGENCE_LIFECYCLE_ACTIONS)[number]

export const RETENTION_INTELLIGENCE_EVENTS_WINDOW = 30 as const
export const RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT = 5 as const
export const RETENTION_INTELLIGENCE_MIN_CONFIDENCE = 0.55 as const
export const RETENTION_INTELLIGENCE_STALE_DAYS = 45 as const

export type VoiceRetentionIntelligenceEventPublicView = {
  id: string
  organizationId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  relationshipMemoryProfileId: string | null
  sourceVoiceCallId: string | null
  sourceMemoryEventId: string | null
  sourceRevenueEventId: string | null
  eventType: VoiceRetentionIntelligenceEventType
  healthDirection: VoiceHealthDirection
  confidenceScore: number
  evidenceText: string
  recommendedOperatorAction: string | null
  status: VoiceRetentionIntelligenceEventStatus
  createdAt: string
}

export type VoiceRetentionRiskItem = {
  id: string
  title: string
  eventType: VoiceRetentionIntelligenceEventType
  evidenceText: string
  score: number
}

export type VoiceRetentionExpansionSignalItem = {
  id: string
  title: string
  eventType: VoiceRetentionIntelligenceEventType
  evidenceText: string
  confidenceScore: number
}

export type VoiceRetentionSatisfactionIndicator = {
  id: string
  tone: "positive" | "negative" | "neutral"
  summary: string
  evidenceText: string
}

export type VoiceRetentionWhatChanged = {
  summary: string
  evidenceText: string
  eventType: VoiceRetentionIntelligenceEventType | null
}

export type VoiceRetentionIntelligenceWorkspaceSnapshot = {
  qaMarker: typeof VOICE_RETENTION_INTELLIGENCE_QA_MARKER
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  healthScore: number
  healthDirection: VoiceHealthDirection
  retentionRiskLevel: VoiceRetentionRiskLevel
  confidenceScore: number
  topRisks: VoiceRetentionRiskItem[]
  topExpansionSignals: VoiceRetentionExpansionSignalItem[]
  unresolvedIssues: string[]
  satisfactionIndicators: VoiceRetentionSatisfactionIndicator[]
  recommendedCustomerSuccessAction: string | null
  lastMeaningfulInteractionAt: string | null
  whatChangedSinceLastInteraction: VoiceRetentionWhatChanged | null
  activeEventCount: number
  topActiveEvents: VoiceRetentionIntelligenceEventPublicView[]
  windowed: true
  eventsLimit: number
  passiveModeEnabled: true
  autonomousActionsDisabled: true
}

export type VoiceRetentionIntelligenceReadinessSnapshot = {
  qaMarker: typeof VOICE_RETENTION_INTELLIGENCE_QA_MARKER
  schemaReady: boolean
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  evidenceRequirementEnabled: true
  relationshipMemoryDependencyReady: boolean
  revenueIntelligenceDependencyReady: boolean
  unresolvedIssueCount: number
  churnRiskCount: number
  expansionSignalCount: number
  activeEventCount: number
  message: string
}

export type DerivedRetentionIntelligenceEventInput = {
  eventType: VoiceRetentionIntelligenceEventType
  healthDirection: VoiceHealthDirection
  confidenceScore: number
  evidenceText: string
  recommendedOperatorAction: string
  sourceVoiceCallId?: string | null
  sourceMemoryEventId?: string | null
  sourceRevenueEventId?: string | null
}
