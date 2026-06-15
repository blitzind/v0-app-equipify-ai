/** Multi-channel sequence state tracking (Phase 5.4E). Client-safe. */

export const GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS = [
  "email_sent",
  "sms_sent",
  "voice_drop_delivered",
  "voice_drop_answered",
  "call_task_queued",
  "call_completed",
  "reply_received",
  "step_approved",
  "step_skipped",
  "channel_rule_applied",
  "branch_evaluated",
  "wait_started",
  "wait_resolved",
  "condition_timeout",
  "advancement_blocked",
] as const

export type GrowthSequenceChannelEventKind = (typeof GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS)[number]

export type GrowthSequenceEnrollmentChannelEvent = {
  id: string
  enrollmentId: string
  enrollmentStepId: string | null
  leadId: string
  channel: string
  eventKind: GrowthSequenceChannelEventKind
  title: string
  summary: string | null
  occurredAt: string
  metadata: Record<string, unknown>
}

export type GrowthSequenceMultiChannelTimelineEntry = {
  occurredAt: string
  channel: string
  label: string
  eventKind: GrowthSequenceChannelEventKind | string
  enrollmentStepId?: string | null
}

export function channelEventKindLabel(kind: GrowthSequenceChannelEventKind): string {
  return kind.replace(/_/g, " ")
}
