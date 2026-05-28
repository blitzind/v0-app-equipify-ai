/** Voice observability + orchestration analytics — Phase 5B (client-safe). */

export const VOICE_OBSERVABILITY_QA_MARKER = "voice-observability-analytics-v1" as const

export const VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED = true as const
export const VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED = true as const
export const VOICE_OBSERVABILITY_HIDDEN_AI_SCORING_DISABLED = true as const

export const VOICE_OBSERVABILITY_EVENT_CATEGORIES = [
  "provider",
  "ai_orchestration",
  "compliance",
  "campaign",
  "transfer",
  "escalation",
  "operator",
  "receptionist",
  "outbound_ai",
  "transcript",
  "realtime_media",
  "retention",
  "revenue",
] as const

export type VoiceObservabilityEventCategory = (typeof VOICE_OBSERVABILITY_EVENT_CATEGORIES)[number]

export const VOICE_OBSERVABILITY_SEVERITIES = ["info", "warning", "critical"] as const

export type VoiceObservabilitySeverity = (typeof VOICE_OBSERVABILITY_SEVERITIES)[number]

export const VOICE_OBSERVABILITY_ALERT_STATUSES = ["active", "resolved", "suppressed"] as const

export type VoiceObservabilityAlertStatus = (typeof VOICE_OBSERVABILITY_ALERT_STATUSES)[number]

export const VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS = 24 as const
export const VOICE_OBSERVABILITY_TREND_WINDOW_DAYS = 7 as const
export const VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS = 90 as const
export const VOICE_OBSERVABILITY_SNAPSHOT_RETENTION_DAYS = 30 as const
export const VOICE_OBSERVABILITY_MAX_EVENTS_QUERY = 500 as const
export const VOICE_OBSERVABILITY_MAX_REALTIME_ITEMS = 50 as const
export const VOICE_OBSERVABILITY_REALTIME_POLL_MS = 30_000 as const
export const VOICE_OBSERVABILITY_EVENT_SAMPLE_RATE = 1 as const

export type VoiceObservabilityEventPublicView = {
  id: string
  organizationId: string
  eventCategory: VoiceObservabilityEventCategory
  eventType: string
  severity: VoiceObservabilitySeverity
  sourceSystem: string
  sourceSessionId: string | null
  sourceCallId: string | null
  sourceCampaignId: string | null
  sourceProvider: string | null
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  relatedProspectId: string | null
  latencyMs: number | null
  durationMs: number | null
  evidence: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
}

export type VoiceObservabilityAlertPublicView = {
  id: string
  organizationId: string
  alertKey: string
  alertType: string
  severity: VoiceObservabilitySeverity
  status: VoiceObservabilityAlertStatus
  evidence: Record<string, unknown>
  metadata: Record<string, unknown>
  triggeredAt: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProviderHealthMetric = {
  providerId: string
  sampleCount: number
  avgLatencyMs: number
  timeoutRate: number
  fallbackRate: number
  errorRate: number
  degradationDetected: boolean
  recommendation: string
}

export type VoiceObservabilityProviderSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  windowHours: number
  providers: ProviderHealthMetric[]
  autoProviderSwitchDisabled: true
  message: string
}

export type VoiceObservabilityEscalationSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  escalationCount24h: number
  operatorTakeoverCount24h: number
  transferCount24h: number
  bySourceSystem: Array<{ sourceSystem: string; count: number }>
  heatmap: Array<{ hour: number; count: number }>
  message: string
}

export type VoiceObservabilityComplianceSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  blockedCount24h: number
  manualReviewCount24h: number
  optOutCount24h: number
  callHourViolationCount24h: number
  consentUnknownCount24h: number
  suppressionCount24h: number
  channelRisk: Array<{ channel: string; blocked: number; manualReview: number }>
  auditEventTrend: Array<{ action: string; count: number }>
  message: string
}

export type VoiceObservabilityCampaignSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  voiceDropApprovalRate: number
  voiceDropDeliveryRate: number
  voiceDropSuppressionRate: number
  missedCallRecoveryCount24h: number
  outboundAiApprovalRate: number
  outboundAiCompletionRate: number
  callbackCompletionRate: number
  optOutTerminationCount24h: number
  retryRate: number
  message: string
}

export type VoiceObservabilityAiOrchestrationSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  suggestionVolume24h: number
  suggestionAdoptionRate: number
  escalationFrequency24h: number
  operatorTakeoverFrequency24h: number
  aiFallbackFrequency24h: number
  voicemailCompletionRate: number
  qualificationCompletionRate: number
  schedulingRequestCount24h: number
  optOutTerminationCount24h: number
  phaseDistribution: Array<{ phase: string; count: number }>
  message: string
}

export type VoiceObservabilityRelationshipRevenueSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  unresolvedObjectionTrend: Array<{ label: string; count: number }>
  retentionRiskTrend: Array<{ label: string; count: number }>
  expansionOpportunityTrend: Array<{ label: string; count: number }>
  buyingStageProgression: Array<{ stage: string; count: number }>
  escalationRiskTrend: number
  followUpAdherenceRate: number
  momentumChanges: Array<{ direction: string; count: number }>
  message: string
}

export type VoiceObservabilityRealtimeSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  activeSessionsCount: number
  activeOutboundSessionsCount: number
  activeReceptionistSessionsCount: number
  providerHealthSummary: ProviderHealthMetric[]
  recentEvents: VoiceObservabilityEventPublicView[]
  activeAlerts: VoiceObservabilityAlertPublicView[]
  pollIntervalMs: number
  message: string
}

export type VoiceObservabilityOverviewSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  generatedAt: string
  schemaReady: boolean
  observabilityEnabled: boolean
  providerHealth: VoiceObservabilityProviderSnapshot
  aiOrchestration: VoiceObservabilityAiOrchestrationSnapshot
  campaigns: VoiceObservabilityCampaignSnapshot
  compliance: VoiceObservabilityComplianceSnapshot
  escalations: VoiceObservabilityEscalationSnapshot
  relationshipRevenue: VoiceObservabilityRelationshipRevenueSnapshot
  realtime: VoiceObservabilityRealtimeSnapshot
  activeAlertCount: number
  autonomousRemediationDisabled: true
  autoProviderSwitchDisabled: true
  message: string
}

export type VoiceObservabilityReadinessSnapshot = {
  qaMarker: typeof VOICE_OBSERVABILITY_QA_MARKER
  schemaReady: boolean
  observabilityEnabled: boolean
  providerHealthVisibility: boolean
  orchestrationAnalyticsReady: boolean
  complianceAnalyticsReady: boolean
  campaignAnalyticsReady: boolean
  realtimeMonitoringReady: boolean
  alertFoundationReady: boolean
  transcriptObservabilityReady: boolean
  eventRetentionDays: number
  rollingWindowHours: number
  autonomousRemediationDisabled: true
  autoProviderSwitchDisabled: true
  message: string
}
