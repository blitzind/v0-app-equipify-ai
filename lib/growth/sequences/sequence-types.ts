/** Growth Engine — Sequence execution foundation types (Phase 2A). Client-safe. */

export const GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER = "growth-sequence-execution-foundation-v1" as const

export const GROWTH_SEQUENCE_TEMPLATE_STATUSES = ["draft", "active", "paused", "archived"] as const
export type GrowthSequenceTemplateStatus = (typeof GROWTH_SEQUENCE_TEMPLATE_STATUSES)[number]

export const GROWTH_SEQUENCE_ENROLLMENT_STATUSES = ["draft", "active", "paused", "completed", "failed", "cancelled"] as const
export type GrowthSequenceEnrollmentStatus = (typeof GROWTH_SEQUENCE_ENROLLMENT_STATUSES)[number]

export const GROWTH_SEQUENCE_HEALTH_TIERS = ["healthy", "warning", "degraded", "critical"] as const
export type GrowthSequenceHealthTier = (typeof GROWTH_SEQUENCE_HEALTH_TIERS)[number]

export const GROWTH_SEQUENCE_STEP_CHANNELS = ["email", "manual_call", "manual_followup", "linkedin", "sms_future"] as const
export type GrowthSequenceStepChannel = (typeof GROWTH_SEQUENCE_STEP_CHANNELS)[number]

export const GROWTH_SEQUENCE_GENERATION_TYPES = ["intro", "followup", "breakup", "executive", "manual"] as const
export type GrowthSequenceGenerationType = (typeof GROWTH_SEQUENCE_GENERATION_TYPES)[number]

export const GROWTH_SEQUENCE_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthSequenceEventSeverity = (typeof GROWTH_SEQUENCE_EVENT_SEVERITIES)[number]

export const GROWTH_SEQUENCE_TIMELINE_EVENT_TYPES = [
  "sequence_created",
  "sequence_started",
  "sequence_paused",
  "sequence_completed",
  "sequence_cancelled",
  "sequence_health_declined",
] as const
export type GrowthSequenceTimelineEventType = (typeof GROWTH_SEQUENCE_TIMELINE_EVENT_TYPES)[number]

export type GrowthSequenceTemplateStep = {
  id: string
  sequence_template_id: string
  step_number: number
  channel: GrowthSequenceStepChannel
  delay_days: number
  generation_type: GrowthSequenceGenerationType
  approval_required: boolean
  condition_rules: Record<string, unknown>
  exit_rules: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type GrowthSequenceTemplate = {
  id: string
  name: string
  description: string | null
  category: string | null
  status: GrowthSequenceTemplateStatus
  approval_required: boolean
  exit_on_reply: boolean
  exit_on_meeting: boolean
  exit_on_positive_intent: boolean
  created_by: string | null
  step_count: number
  steps?: GrowthSequenceTemplateStep[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type GrowthSequenceEnrollment = {
  id: string
  lead_id: string
  lead_label: string
  sequence_template_id: string
  sequence_name: string
  status: GrowthSequenceEnrollmentStatus
  current_step: number
  next_step_due_at: string | null
  completion_reason: string | null
  health_score: number
  health_tier: GrowthSequenceHealthTier
  enrolled_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type GrowthSequenceExecutionEvent = {
  id: string
  sequence_enrollment_id: string
  lead_label: string
  event_type: string
  severity: GrowthSequenceEventSeverity
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthSequenceExecutionDashboard = {
  qa_marker: typeof GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER
  draft_count: number
  active_count: number
  paused_count: number
  completed_count: number
  average_health_score: number
}

export const GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE =
  "Sequence execution foundation is orchestration-only. Human approval required — no autonomous sending or provider execution."
