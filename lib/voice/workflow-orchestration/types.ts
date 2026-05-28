/** Workflow orchestration intelligence — Phase 5C (client-safe). */

export const VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER = "voice-workflow-orchestration-v1" as const

export const VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED = true as const
export const VOICE_WORKFLOW_AUTO_CRM_MUTATION_DISABLED = true as const
export const VOICE_WORKFLOW_AUTO_OPERATOR_REASSIGNMENT_DISABLED = true as const

export const VOICE_WORKFLOW_ORCHESTRATION_TYPES = [
  "missed_call_recovery",
  "callback_followup",
  "appointment_coordination",
  "escalation_recovery",
  "ai_receptionist_handoff",
  "outbound_followup",
  "retention_recovery",
  "expansion_followup",
  "unresolved_objection",
  "compliance_hold",
  "operator_takeover",
  "scheduling_followup",
] as const

export type VoiceWorkflowOrchestrationType = (typeof VOICE_WORKFLOW_ORCHESTRATION_TYPES)[number]

export const VOICE_WORKFLOW_ORCHESTRATION_STATUSES = [
  "pending",
  "active",
  "awaiting_operator",
  "awaiting_customer",
  "compliance_hold",
  "escalated",
  "blocked",
  "completed",
  "canceled",
  "expired",
] as const

export type VoiceWorkflowOrchestrationStatus = (typeof VOICE_WORKFLOW_ORCHESTRATION_STATUSES)[number]

export const VOICE_WORKFLOW_ORCHESTRATION_EVENT_TYPES = [
  "workflow_created",
  "workflow_assigned",
  "escalation_triggered",
  "operator_joined",
  "compliance_hold_added",
  "customer_response_received",
  "callback_scheduled",
  "followup_recommended",
  "workflow_blocked",
  "workflow_resolved",
  "workflow_expired",
  "operator_override",
  "ai_handoff_completed",
  "routing_recommendation_generated",
  "stalled_detected",
  "channel_transition_recorded",
] as const

export type VoiceWorkflowOrchestrationEventType = (typeof VOICE_WORKFLOW_ORCHESTRATION_EVENT_TYPES)[number]

export const VOICE_WORKFLOW_CHANNELS = [
  "voice",
  "voicemail",
  "ai_receptionist",
  "outbound_ai",
  "callback",
  "scheduling",
  "sms",
  "email",
] as const

export type VoiceWorkflowChannel = (typeof VOICE_WORKFLOW_CHANNELS)[number]

export const VOICE_WORKFLOW_STALE_HOURS = 48 as const
export const VOICE_WORKFLOW_RETENTION_DAYS = 90 as const
export const VOICE_WORKFLOW_MAX_TIMELINE_EVENTS = 50 as const
export const VOICE_WORKFLOW_MAX_ACTIVE_ORCHESTRATIONS = 200 as const
export const VOICE_WORKFLOW_SNAPSHOT_CACHE_MINUTES = 5 as const

export type VoiceWorkflowOrchestrationPublicView = {
  id: string
  organizationId: string
  orchestrationType: VoiceWorkflowOrchestrationType
  orchestrationStatus: VoiceWorkflowOrchestrationStatus
  priority: number
  sourceSessionId: string | null
  sourceCallId: string | null
  sourceCampaignId: string | null
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  relatedProspectId: string | null
  relatedOpportunityId: string | null
  assignedOperatorId: string | null
  escalationLevel: number
  complianceState: string | null
  nextRecommendedAction: string | null
  blockedReason: string | null
  orchestrationSummary: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type VoiceWorkflowOrchestrationEventPublicView = {
  id: string
  organizationId: string
  orchestrationId: string
  eventType: VoiceWorkflowOrchestrationEventType
  sourceSystem: string
  evidenceText: string
  linkedSessionId: string | null
  linkedCallId: string | null
  payload: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export type VoiceWorkflowRoutingRecommendation = {
  operatorId: string | null
  operatorLabel: string
  reason: string
  confidence: "low" | "medium" | "high"
  autoAssignmentDisabled: true
}

export type VoiceWorkflowHealthSummary = {
  stalledCount: number
  unresolvedEscalationCount: number
  complianceHoldCount: number
  longRunningCallbackCount: number
  abandonedCount: number
  excessiveHandoffCount: number
  unresolvedObjectionCount: number
  overdueFollowUpCount: number
  bottleneckTypes: Array<{ type: string; count: number }>
  escalationHotspots: Array<{ type: string; count: number }>
}

export type VoiceWorkflowOrchestrationWorkspaceSnapshot = {
  qaMarker: typeof VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER
  generatedAt: string
  activeOrchestrations: VoiceWorkflowOrchestrationPublicView[]
  stalledOrchestrations: VoiceWorkflowOrchestrationPublicView[]
  recentEvents: VoiceWorkflowOrchestrationEventPublicView[]
  health: VoiceWorkflowHealthSummary
  routingRecommendations: VoiceWorkflowRoutingRecommendation[]
  autonomousExecutionDisabled: true
  message: string
}

export type VoiceWorkflowOrchestrationCommandSummary = {
  qaMarker: typeof VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER
  activeCount: number
  stalledCount: number
  escalatedCount: number
  complianceHoldCount: number
  awaitingOperatorCount: number
  unresolvedTrendCount: number
  operatorWorkloadEstimate: number
  message: string
}

export type VoiceWorkflowOrchestrationReadinessSnapshot = {
  qaMarker: typeof VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER
  schemaReady: boolean
  orchestrationEnabled: boolean
  escalationCoordinationReady: boolean
  routingVisibilityReady: boolean
  workflowAnalyticsReady: boolean
  stalledWorkflowDetectionReady: boolean
  multiChannelCoordinationReady: boolean
  observabilityIntegrationReady: boolean
  autonomousWorkflowExecutionDisabled: true
  message: string
}

export type WorkflowOrchestrationAction =
  | "assign_operator"
  | "escalate"
  | "resolve"
  | "cancel"
  | "compliance_hold"
  | "operator_override"
  | "recommend_followup"

export type VoiceWorkflowRecommendation = {
  action: string
  evidence: string
  requiresOperatorReview: true
  autonomousExecutionDisabled: true
}
