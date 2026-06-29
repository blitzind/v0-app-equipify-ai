/**
 * GE-AIOS-SDR-2C — Runtime-specific revenue outcome emitters (server-only).
 * Thin adapters — one canonical publisher, no duplicate schemas.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { NormalizedOutboundEvent } from "@/lib/growth/outbound/types"
import type { NativeCallWrapupOutcome } from "@/lib/growth/native-dialer/native-dialer-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"
import { emitRevenueOutcomeEvent } from "@/lib/growth/revenue-outcomes/revenue-outcome-emitter"
import type { RevenueOutcomeResult } from "@/lib/growth/revenue-outcomes/revenue-outcome-types"

function fireAndForget(
  admin: SupabaseClient,
  input: Parameters<typeof emitRevenueOutcomeEvent>[1],
): void {
  void emitRevenueOutcomeEvent(admin, input).catch(() => undefined)
}

const EMAIL_EVENT_OUTCOME: Record<string, RevenueOutcomeResult | null> = {
  sent: "sent",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  replied: "replied",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
  spam_complaint: "unsubscribed",
  failed: "failed",
}

export function emitEmailRevenueOutcomeFromWebhook(
  admin: SupabaseClient,
  input: {
    leadId: string
    event: NormalizedOutboundEvent
    messageEventId: string
    campaignId?: string | null
  },
): void {
  const outcome = EMAIL_EVENT_OUTCOME[input.event.eventType]
  if (!outcome) return

  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "email",
    action: input.event.eventType,
    outcome,
    executionId: `email:${input.event.providerEventId}`,
    runtime: "email_outbound_webhook",
    occurredAt: input.event.occurredAt,
    campaignId: input.campaignId ?? null,
    metadata: {
      provider: input.event.provider,
      message_event_id: input.messageEventId,
      bounce_type: input.event.bounceType ?? null,
    },
  })
}

const CALL_WRAPUP_OUTCOME: Record<NativeCallWrapupOutcome, RevenueOutcomeResult> = {
  connected: "connected",
  left_voicemail: "voicemail",
  no_answer: "no_answer",
  meeting_booked: "booked",
  follow_up_needed: "completed",
  not_interested: "declined",
  wrong_number: "failed",
}

export function emitCallRevenueOutcomeFromWrapup(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    wrapupId: string
    outcome: NativeCallWrapupOutcome
    occurredAt?: string
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "call",
    action: "place_call",
    outcome: CALL_WRAPUP_OUTCOME[input.outcome] ?? "completed",
    executionId: `call:${input.sessionId}:${input.wrapupId}`,
    runtime: "native_call_wrapup",
    occurredAt: input.occurredAt,
    metadata: { session_id: input.sessionId },
  })
}

export function emitSmsRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    outcome: RevenueOutcomeResult
    executionId: string
    runtime: string
    occurredAt?: string
    sequenceId?: string | null
    metadata?: Record<string, unknown>
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "sms",
    action: input.outcome === "replied" ? "send_sms" : "send_sms",
    outcome: input.outcome,
    executionId: input.executionId,
    runtime: input.runtime,
    occurredAt: input.occurredAt,
    sequenceId: input.sequenceId ?? null,
    metadata: input.metadata,
  })
}

export function emitVoiceDropRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    outcome: "delivered" | "failed"
    deliveryAttemptId: string
    enrollmentId?: string | null
    campaignId?: string | null
    occurredAt?: string
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "voice_drop",
    action: "launch_voice_drop",
    outcome: input.outcome,
    executionId: `voice_drop:${input.deliveryAttemptId}:${input.outcome}`,
    runtime: "sequence_voice_drop_webhook",
    occurredAt: input.occurredAt,
    sequenceId: input.enrollmentId ?? null,
    campaignId: input.campaignId ?? null,
    metadata: { delivery_attempt_id: input.deliveryAttemptId },
  })
}

export function emitMeetingRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    meetingId: string
    outcome: RevenueOutcomeResult
    occurredAt?: string
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "meeting",
    action: "schedule_meeting",
    outcome: input.outcome,
    executionId: `meeting:${input.meetingId}:${input.outcome}`,
    runtime: "meeting_intelligence",
    occurredAt: input.occurredAt,
    meetingId: input.meetingId,
  })
}

export function emitCampaignRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    outcome: "enrolled" | "completed" | "exited"
    enrollmentId: string
    sequenceId?: string | null
    occurredAt?: string
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "campaign",
    action: "sequence_enrollment",
    outcome: input.outcome === "completed" ? "completed" : input.outcome,
    executionId: `campaign:${input.enrollmentId}:${input.outcome}`,
    runtime: "sequence_enrollment",
    occurredAt: input.occurredAt,
    sequenceId: input.sequenceId ?? null,
    metadata: { enrollment_id: input.enrollmentId },
  })
}

const LEAD_STATUS_OUTCOME: Partial<Record<GrowthLeadStatus, RevenueOutcomeResult>> = {
  disqualified: "disqualified",
  converted: "customer",
}

export async function emitLeadLifecycleRevenueOutcomeIfNeeded(
  admin: SupabaseClient,
  input: {
    leadId: string
    previousStatus: GrowthLeadStatus
    nextStatus: GrowthLeadStatus
    occurredAt?: string
    reason?: string | null
  },
): Promise<void> {
  if (input.previousStatus === input.nextStatus) return
  const outcome = LEAD_STATUS_OUTCOME[input.nextStatus]
  if (!outcome) return

  await emitRevenueOutcomeEvent(admin, {
    leadId: input.leadId,
    channel: "lead",
    action: "lead_status_change",
    outcome,
    executionId: `lead:${input.leadId}:${input.previousStatus}->${input.nextStatus}`,
    runtime: "lead_lifecycle",
    occurredAt: input.occurredAt,
    metadata: { previous_status: input.previousStatus, reason: input.reason ?? null },
  })
}

export function emitSuppressionRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    reason: string
    executionId: string
    occurredAt?: string
  },
): void {
  fireAndForget(admin, {
    leadId: input.leadId,
    channel: "lead",
    action: "suppress",
    outcome: "suppressed",
    executionId: input.executionId,
    runtime: "suppression",
    occurredAt: input.occurredAt,
    metadata: { reason: input.reason },
  })
}

export function emitDailyWorkQueueRevenueOutcome(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyId: string
    channel: string
    action: string
    outcome: "completed" | "skipped" | "failed"
    taskKey: string
    priority: string
    confidence: number
    occurredAt?: string
  },
): void {
  const mappedOutcome: RevenueOutcomeResult =
    input.outcome === "failed" ? "failed" : input.outcome === "skipped" ? "skipped" : "completed"

  fireAndForget(admin, {
    leadId: input.leadId,
    companyId: input.companyId,
    channel:
      input.channel === "sms"
        ? "sms"
        : input.channel === "call"
          ? "call"
          : input.channel === "voice_drop"
            ? "voice_drop"
            : input.channel === "video"
              ? "video"
              : "email",
    action: input.action,
    outcome: mappedOutcome,
    executionId: `daily_queue:${input.taskKey}:${mappedOutcome}`,
    runtime: "daily_revenue_work_queue",
    occurredAt: input.occurredAt,
    confidence: input.confidence,
    metadata: { priority: input.priority, task_key: input.taskKey },
  })
}
