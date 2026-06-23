/** GE-v1-5 — Operator-assist automation runtime types (client-safe). */

export const GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER =
  "ge-v1-5-automation-runtime-v1" as const

export const GE_V1_5_AUTOMATION_RUNTIME_CONFIRM =
  "RUN_GE_V1_5_AUTOMATION_RUNTIME_CERTIFICATION" as const

export const GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY =
  "ge_v1_5_automation_runtime" as const

/** Operator-assist only — no autonomous sends, no background workers. */
export const GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS = {
  runtime_enabled: true,
  signal_processing_enabled: true,
  recommendation_actions_enabled: true,
  notification_actions_enabled: true,
  task_actions_enabled: true,
  prepare_outbound_enabled: true,
  /** GE-AUTO-1E — policy-gated autonomous send enabled when org configures outbound; code default off. */
  policy_gated_autonomous_send_enabled: true,
  outbound_send_execution_enabled: false,
  /** GE-AUTO-1D — operator-approved sends only; autonomous playbook send remains disabled. */
  operator_approved_send_execution_enabled: true,
  autonomous_approval_enabled: false,
  no_autonomous_sending: true,
  no_background_jobs: true,
  human_approval_required: true,
} as const

export type GeV15AutomationRuntimeSafetyFlags =
  typeof GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS

// ── Triggers ────────────────────────────────────────────────────────────────

export const GE_V1_5_ENGAGEMENT_TRIGGERS = [
  "email_opened",
  "email_clicked",
  "reply_received",
  "video_view_started",
  "video_completed",
  "cta_clicked",
  "booking_started",
  "booking_completed",
] as const

export const GE_V1_5_DEMO_ASSISTANT_TRIGGERS = [
  "agent_opened",
  "question_asked",
  "booking_offered",
  "conversation_completed",
] as const

export const GE_V1_5_LEAD_EVENT_TRIGGERS = [
  "lead_created",
  "audience_enrolled",
  "enrichment_completed",
  "buying_committee_completed",
] as const

export const GE_V1_5_MEDIA_TRIGGERS = ["video_generated", "video_attached"] as const

export const GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS = [
  ...GE_V1_5_ENGAGEMENT_TRIGGERS,
  ...GE_V1_5_DEMO_ASSISTANT_TRIGGERS,
  ...GE_V1_5_LEAD_EVENT_TRIGGERS,
  ...GE_V1_5_MEDIA_TRIGGERS,
] as const

export type GeV15AutomationRuntimeTrigger =
  (typeof GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS)[number]

// ── Conditions ──────────────────────────────────────────────────────────────

export const GE_V1_5_CONDITION_KINDS = [
  "lead_score",
  "intent_score",
  "event_count",
  "inactivity_duration",
  "audience_membership",
  "company_attribute",
  "recommendation_state",
] as const

export type GeV15ConditionKind = (typeof GE_V1_5_CONDITION_KINDS)[number]

export type GeV15ConditionSpec = {
  kind: GeV15ConditionKind
  operator: "gte" | "lte" | "eq" | "gt" | "lt"
  value: number | string | boolean
  /** Optional scope for event_count / inactivity_duration */
  trigger?: GeV15AutomationRuntimeTrigger
  /** Optional audience id for audience_membership */
  audienceId?: string
  /** Optional company attribute key */
  attributeKey?: string
}

// ── Actions ─────────────────────────────────────────────────────────────────

export const GE_V1_5_RECOMMENDATION_ACTIONS = [
  "create_recommendation",
  "elevate_recommendation",
  "request_follow_up",
] as const

export const GE_V1_5_NOTIFICATION_ACTIONS = [
  "operator_notification",
  "inbox_notification",
  "dashboard_card",
] as const

export const GE_V1_5_TASK_ACTIONS = [
  "create_task",
  "assign_task",
  "queue_approval_item",
] as const

export const GE_V1_5_CAMPAIGN_PREPARE_ACTIONS = [
  "prepare_email",
  "prepare_sms",
  "prepare_voice_drop",
] as const

export const GE_V1_5_AUTOMATION_RUNTIME_ACTIONS = [
  ...GE_V1_5_RECOMMENDATION_ACTIONS,
  ...GE_V1_5_NOTIFICATION_ACTIONS,
  ...GE_V1_5_TASK_ACTIONS,
  ...GE_V1_5_CAMPAIGN_PREPARE_ACTIONS,
] as const

export type GeV15AutomationRuntimeAction =
  (typeof GE_V1_5_AUTOMATION_RUNTIME_ACTIONS)[number]

export type GeV15OutboundCapableAction = (typeof GE_V1_5_CAMPAIGN_PREPARE_ACTIONS)[number]

export function isGeV15OutboundCapableAction(
  action: GeV15AutomationRuntimeAction,
): action is GeV15OutboundCapableAction {
  return (GE_V1_5_CAMPAIGN_PREPARE_ACTIONS as readonly string[]).includes(action)
}

// ── Delays ──────────────────────────────────────────────────────────────────

export const GE_V1_5_DELAY_UNITS = ["minutes", "hours", "days"] as const
export type GeV15DelayUnit = (typeof GE_V1_5_DELAY_UNITS)[number]

export type GeV15DelaySpec = {
  amount: number
  unit: GeV15DelayUnit
}

// ── Approval statuses ───────────────────────────────────────────────────────

export const GE_V1_5_APPROVAL_STATUSES = [
  "prepared",
  "pending_approval",
  "approved",
  "executed",
  "rejected",
  "failed",
] as const

export type GeV15ApprovalStatus = (typeof GE_V1_5_APPROVAL_STATUSES)[number]

// ── Runtime records ─────────────────────────────────────────────────────────

export type GeV15AutomationRecommendation = {
  id: string
  title: string
  reason: string
  priority: number
  actionKind: "email" | "call" | "meeting" | "reminder" | "archive" | "review"
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  createdAt: string
  elevated?: boolean
}

export type GeV15PreparedAction = {
  id: string
  action: GeV15AutomationRuntimeAction
  channel: "email" | "sms" | "voice_drop" | "task" | "notification" | null
  title: string
  summary: string
  draftContent?: string | null
  status: GeV15ApprovalStatus
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  ownerUserId?: string | null
  taskId?: string | null
  notificationId?: string | null
  createdAt: string
  updatedAt: string
  approvedAt?: string | null
  approvedBy?: string | null
  executedAt?: string | null
  /** GE-AUTO-1C — autonomy-prepared outbound metadata */
  autonomyPrepared?: boolean
  approvalRequired?: boolean
  confidenceScore?: number | null
  triggerReason?: string | null
  senderProfileId?: string | null
  recipientEmail?: string | null
  sequenceId?: string | null
  audienceId?: string | null
  channelPolicyMetadata?: Record<string, unknown> | null
  dedupeKey?: string | null
  originalDraftContent?: string | null
  editedDraftContent?: string | null
  editedSubject?: string | null
  editedBy?: string | null
  editedAt?: string | null
  rejectReason?: string | null
  rejectedBy?: string | null
  rejectedAt?: string | null
  voiceDropCampaignId?: string | null
  executionIdempotencyKey?: string | null
  executionError?: string | null
  /** GE-AUTO-1E — autonomous send audit */
  autonomySend?: boolean
  autonomySendDecision?: import("@/lib/growth/autonomy/growth-autonomy-types").GrowthAutonomySendDecision
  autonomySendReason?: string | null
  autonomySendSummary?: string | null
  sendPolicyMetadata?: Record<string, unknown> | null
  shadowWouldSend?: boolean
}

export type GeV15PendingDelay = {
  id: string
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  dueAt: string
  dedupeKey: string
  createdAt: string
  processedAt?: string | null
}

export type GeV15RuntimeLogEntry = {
  id: string
  at: string
  phase: "trigger" | "condition" | "action" | "approval" | "execution" | "failure" | "delay"
  message: string
  playbookId?: string | null
  trigger?: GeV15AutomationRuntimeTrigger | null
  metadata?: Record<string, unknown>
}

export type GeV15AutomationRuntimeLeadState = {
  qa_marker: typeof GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER
  recommendations: GeV15AutomationRecommendation[]
  preparedActions: GeV15PreparedAction[]
  pendingDelays: GeV15PendingDelay[]
  logs: GeV15RuntimeLogEntry[]
  lastSignalAt: string | null
  lastProcessedTrigger: GeV15AutomationRuntimeTrigger | null
}

export type GeV15SignalInput = {
  organizationId: string
  leadId: string
  trigger: GeV15AutomationRuntimeTrigger
  triggerPayload?: Record<string, unknown>
  ownerUserId?: string | null
  dryRun?: boolean
}

export type GeV15SignalProcessResult = {
  ok: boolean
  trigger: GeV15AutomationRuntimeTrigger
  playbooksMatched: number
  recommendationsCreated: number
  actionsPrepared: number
  notificationsEmitted: number
  tasksCreated: number
  delaysScheduled: number
  skippedReason?: string | null
}

export type GeV15ReadinessStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "DISABLED"
  | "HIDDEN"
  | "PROVIDER_GATED"

export type GeV15ReadinessEntry = {
  component: string
  status: GeV15ReadinessStatus
  notes: string
}
