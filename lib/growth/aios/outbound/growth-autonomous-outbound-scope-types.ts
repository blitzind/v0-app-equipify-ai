/** GE-AI-2I — Bounded Autonomous Outbound scope types (client-safe). */

import type { GrowthCommunicationPlanSummary } from "@/lib/growth/aios/communication/growth-communication-engine-engine"

export const GROWTH_AIOS_GE_AI_2I_PHASE = "GE-AI-2I" as const

export const GROWTH_AIOS_GE_AI_2I_PROD_1_PHASE = "GE-AI-2I-PROD-1" as const

export const GROWTH_AIOS_GE_AI_2I_PROD_2_PHASE = "GE-AI-2I-PROD-2" as const

export const GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE = "GE-AI-2I-PROD-3" as const

export const GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING =
  "Scope activation authorizes the bounded envelope only. Sequence jobs still require separate human approval before any send." as const

export const GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE =
  "Operators activate approved autonomous outbound scopes only via gated POST — validation delegates to activateAutonomousOutboundScopeWithValidation; never sends or auto-approves sequence jobs." as const

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER =
  "growth-ge-ai-2i-bounded-autonomous-outbound-v1" as const

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION =
  "20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql" as const

export const GROWTH_AUTONOMOUS_OUTBOUND_PERSISTENCE_RULE =
  "Autonomous outbound scopes persist in growth.autonomous_outbound_scopes — organization-scoped, audited, idempotent, service-role only." as const

export const GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE =
  "Bounded autonomous outbound executes only inside human-approved scope with Growth Autonomy, channel readiness, suppression, budget, and stop-condition gates — never bypasses existing transport or approval systems." as const

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SOURCES = [
  "objective",
  "campaign",
  "sequence",
  "outreach_package",
  "execution_plan",
  "human_approval_center",
] as const

export type GrowthAutonomousOutboundScopeSource =
  (typeof GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SOURCES)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_STATUSES = [
  "draft",
  "approved",
  "active",
  "paused",
  "expired",
  "completed",
  "blocked",
] as const

export type GrowthAutonomousOutboundScopeStatus =
  (typeof GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_STATUSES)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_CHANNELS = [
  "email",
  "sms",
  "voice_drop",
  "ai_voice",
  "video",
  "linkedin_manual",
] as const

export type GrowthAutonomousOutboundChannel = (typeof GROWTH_AUTONOMOUS_OUTBOUND_CHANNELS)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_ACTION_TYPES = [
  "send_email",
  "send_sms",
  "launch_voice_drop",
  "start_ai_voice_session",
  "create_linkedin_manual_task",
  "create_video_sendr_task",
] as const

export type GrowthAutonomousOutboundActionType =
  (typeof GROWTH_AUTONOMOUS_OUTBOUND_ACTION_TYPES)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_ACTION_STATUSES = [
  "selected",
  "blocked",
  "queued",
  "completed",
  "failed",
  "skipped",
] as const

export type GrowthAutonomousOutboundActionStatus =
  (typeof GROWTH_AUTONOMOUS_OUTBOUND_ACTION_STATUSES)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_STOP_CONDITIONS = [
  "on_reply",
  "on_positive_intent",
  "on_negative_intent",
  "on_bounce",
  "on_unsubscribe",
  "on_meeting_booked",
  "on_manual_pause",
] as const

export type GrowthAutonomousOutboundStopCondition =
  (typeof GROWTH_AUTONOMOUS_OUTBOUND_STOP_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_OUTBOUND_GATE_IDS = [
  "human_approval",
  "growth_autonomy",
  "audience",
  "channel",
  "budget",
  "quiet_hours",
  "suppression",
  "compliance",
  "opt_out",
  "sender_readiness",
  "stop_condition",
  "scope_status",
  "voice_drop_certified",
  "ai_voice_explicit",
] as const

export type GrowthAutonomousOutboundGateId = (typeof GROWTH_AUTONOMOUS_OUTBOUND_GATE_IDS)[number]

export type GrowthAutonomousOutboundQuietHours = {
  timezone: string
  start: string
  end: string
}

export type GrowthAutonomousOutboundAudience = {
  leadIds?: string[]
  companyIds?: string[]
  personIds?: string[]
  savedSearchId?: string
  maxAudienceSize?: number
}

export type GrowthAutonomousOutboundLimits = {
  maxActionsTotal: number
  maxActionsPerDay: number
  maxActionsPerLead: number
  maxSmsPerDay?: number
  maxEmailsPerDay?: number
  maxVoiceDropsPerDay?: number
  quietHours?: GrowthAutonomousOutboundQuietHours
}

export type GrowthAutonomousOutboundRequiredChecks = {
  growthAutonomy: true
  humanApproval: true
  suppression: true
  senderReadiness: true
  compliance: true
  optOut: true
  budget: true
}

export type GrowthAutonomousOutboundStopConditions = {
  onReply: boolean
  onPositiveIntent?: boolean
  onNegativeIntent?: boolean
  onBounce?: boolean
  onUnsubscribe?: boolean
  onMeetingBooked?: boolean
  onManualPause?: boolean
}

export type GrowthAutonomousOutboundScopePolicy = {
  autonomyCapability: string
  requiresHumanApproval: true
  enforcementSource: string
}

export type GrowthAutonomousOutboundScope = {
  id: string
  organizationId: string
  source: GrowthAutonomousOutboundScopeSource
  sourceId: string
  status: GrowthAutonomousOutboundScopeStatus
  approvedByUserId: string
  approvedAt: string
  expiresAt: string
  allowedChannels: GrowthAutonomousOutboundChannel[]
  audience: GrowthAutonomousOutboundAudience
  limits: GrowthAutonomousOutboundLimits
  requiredChecks: GrowthAutonomousOutboundRequiredChecks
  stopConditions: GrowthAutonomousOutboundStopConditions
  policy: GrowthAutonomousOutboundScopePolicy
  title: string
  summary: string
  voiceDropCertified?: boolean
  aiVoiceExplicitlyApproved?: boolean
  createdAt: string
  updatedAt: string
  activatedAt?: string | null
  pausedAt?: string | null
  completedAt?: string | null
  blockedReason?: string | null
}

export type GrowthAutonomousOutboundActionRecord = {
  id: string
  scopeId: string
  organizationId: string
  actionType: GrowthAutonomousOutboundActionType
  channel: GrowthAutonomousOutboundChannel
  status: GrowthAutonomousOutboundActionStatus
  leadId: string | null
  sequenceJobId?: string | null
  transportPath: string
  transportReference?: string | null
  blockedGate?: GrowthAutonomousOutboundGateId | null
  blockedReason?: string | null
  correlationId: string
  idempotencyKey?: string | null
  selectedAt?: string | null
  queuedAt?: string | null
  failedAt?: string | null
  createdAt: string
  completedAt?: string | null
  updatedAt?: string | null
}

export type GrowthAutonomousOutboundGateResult = {
  gateId: GrowthAutonomousOutboundGateId
  passed: boolean
  reason: string | null
}

export type GrowthAutonomousOutboundGateEvaluation = {
  allowed: boolean
  blockedGates: GrowthAutonomousOutboundGateResult[]
  passedGates: GrowthAutonomousOutboundGateResult[]
  summary: string
}

export type GrowthAutonomousOutboundConsumption = {
  actionsTotal: number
  actionsToday: number
  actionsByLead: Record<string, number>
  emailsToday: number
  smsToday: number
  voiceDropsToday: number
}

export type GrowthAutonomousOutboundScopeRow = {
  scope: GrowthAutonomousOutboundScope
  consumption: GrowthAutonomousOutboundConsumption
  nextQueuedAction: GrowthAutonomousOutboundActionRecord | null
  activeStopConditions: GrowthAutonomousOutboundStopCondition[]
  configureHref: string
  communicationPlanSummary: GrowthCommunicationPlanSummary | null
}

export type GrowthBoundedAutonomousOutboundReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE
  summary: {
    approvedScopes: number
    activeScopes: number
    blockedScopes: number
    pausedScopes: number
    actionsExecutedToday: number
    actionsBlockedToday: number
  }
  approvedScopes: GrowthAutonomousOutboundScopeRow[]
  activeScopes: GrowthAutonomousOutboundScopeRow[]
  blockedScopes: GrowthAutonomousOutboundScopeRow[]
  recentActions: GrowthAutonomousOutboundActionRecord[]
  stopConditionTriggers: Array<{
    scopeId: string
    condition: GrowthAutonomousOutboundStopCondition
    triggeredAt: string
    label: string
  }>
  killSwitchStatus: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    emergencyStopActive: boolean
  }
  channelMixToday: Record<GrowthAutonomousOutboundChannel, number>
  lastEventAt: string | null
  lastEventType: string | null
}

export const GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES = {
  scopeApproved: "growth.autonomous_outbound.scope_approved",
  scopeActivated: "growth.autonomous_outbound.scope_activated",
  actionSelected: "growth.autonomous_outbound.action_selected",
  actionBlocked: "growth.autonomous_outbound.action_blocked",
  actionQueued: "growth.autonomous_outbound.action_queued",
  actionCompleted: "growth.autonomous_outbound.action_completed",
  actionFailed: "growth.autonomous_outbound.action_failed",
  scopePaused: "growth.autonomous_outbound.scope_paused",
  scopeCompleted: "growth.autonomous_outbound.scope_completed",
  stopConditionTriggered: "growth.autonomous_outbound.stop_condition_triggered",
} as const

export const GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS = {
  email: "sequence_execution.runSequenceExecutionJob",
  sms: "sequence_execution.runSequenceSmsExecutionJob",
  voice_drop: "sequence_execution.runSequenceVoiceDropExecutionJob",
  ai_voice: "blocked_ai_voice_requires_explicit_scope",
  linkedin_manual: "cadence.createCadenceTaskFromEnrollmentStep",
  video: "sendr.queueApprovedDeliveryTask",
} as const
