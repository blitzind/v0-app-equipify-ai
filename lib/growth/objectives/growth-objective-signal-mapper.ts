/** GE-AUTO-2B/2C — Map external growth events → objective inbound signals (client-safe). */

import type { LeadSignalType } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import type { GrowthObjectiveInboundSignal } from "@/lib/growth/objectives/growth-objective-types"

export type GrowthObjectiveSourceEvent = {
  organizationId: string
  source:
    | "engagement"
    | "meeting"
    | "automation"
    | "sequence"
    | "opportunity"
    | "demo_assistant"
    | "lead_signal"
    | "share_page"
  signalType: string
  resourceType?: string | null
  resourceKey?: string | null
  resourceId?: string | null
  leadId?: string | null
  value?: number | null
  payload?: Record<string, unknown>
  occurredAt?: string
  idempotencyKey?: string
}

const LEAD_SIGNAL_TO_OBJECTIVE: Partial<
  Record<LeadSignalType, GrowthObjectiveInboundSignal["type"]>
> = {
  reply_received: "reply",
  positive_reply: "reply",
  negative_reply: "reply",
  meeting_requested: "meeting_booked",
  meeting_booked: "meeting_booked",
  meeting_completed: "booking_completed",
  opportunity_created: "opportunity_created",
  stage_advanced: "opportunity_created",
  deal_won: "customer_closed",
  deal_lost: "opportunity_created",
  demo_page_visit: "engagement_click",
  pricing_page_visit: "engagement_click",
  contact_page_visit: "engagement_click",
  high_engagement_visit: "engagement_open",
  repeat_visit: "engagement_open",
}

const GENERIC_SIGNAL_MAP: Record<string, GrowthObjectiveInboundSignal["type"]> = {
  email_opened: "engagement_open",
  email_clicked: "engagement_click",
  email_open: "engagement_open",
  email_click: "engagement_click",
  reply_received: "reply",
  video_view_started: "video_view",
  video_completed: "video_completion",
  cta_clicked: "engagement_click",
  landing_page_visit: "engagement_open",
  booking_started: "meeting_booked",
  booking_completed: "booking_completed",
  meeting_booked: "meeting_booked",
  opportunity_created: "opportunity_created",
  opportunity_updated: "opportunity_created",
  customer_closed: "customer_closed",
  prepared_action: "automation_event",
  approval: "automation_event",
  executed_action: "automation_event",
  rejected_action: "automation_event",
  autonomous_send: "automation_event",
  blocked_action: "automation_event",
  execution: "automation_event",
  campaign_launched: "automation_event",
  enrollment_created: "sequence_event",
  step_scheduled: "sequence_event",
  email_sent: "sequence_event",
  sms_sent: "sequence_event",
  voice_sent: "sequence_event",
  voice_drop_delivered: "sequence_event",
  step_completed: "sequence_event",
  enrollment_completed: "sequence_event",
  step_failed: "sequence_event",
  enrollment_failed: "sequence_event",
  enrollment_paused: "sequence_event",
  booking_offered: "meeting_booked",
  conversation_completed: "booking_completed",
  share_page_booking_started: "meeting_booked",
  share_page_booking_completed: "booking_completed",
  share_page_engaged: "video_completion",
}

export function mapSourceEventToObjectiveSignal(
  event: GrowthObjectiveSourceEvent,
): GrowthObjectiveInboundSignal | null {
  const fromLead = LEAD_SIGNAL_TO_OBJECTIVE[event.signalType as LeadSignalType]
  const mapped = fromLead ?? GENERIC_SIGNAL_MAP[event.signalType]
  if (!mapped) return null

  return {
    type: mapped,
    ts: event.occurredAt ?? new Date().toISOString(),
    value: event.value ?? undefined,
    leadId: event.leadId ?? null,
    payload: {
      ...(event.payload ?? {}),
      source: event.source,
      externalSignalType: event.signalType,
      resourceType: event.resourceType ?? null,
      resourceKey: event.resourceKey ?? null,
      resourceId: event.resourceId ?? null,
      idempotencyKey: event.idempotencyKey ?? null,
    },
  }
}

export function mapLeadSignalTypeToObjectiveSourceEvent(input: {
  organizationId: string
  leadId: string
  signalType: LeadSignalType
  occurredAt?: string
  metadata?: Record<string, unknown>
}): GrowthObjectiveSourceEvent | null {
  const mapped = LEAD_SIGNAL_TO_OBJECTIVE[input.signalType]
  if (!mapped) return null
  return {
    organizationId: input.organizationId,
    source: "lead_signal",
    signalType: input.signalType,
    leadId: input.leadId,
    occurredAt: input.occurredAt,
    payload: input.metadata,
    idempotencyKey: `lead-signal:${input.leadId}:${input.signalType}:${input.occurredAt ?? ""}`,
  }
}

export function buildGrowthObjectiveEventIdempotencyKey(input: {
  source: string
  signalType: string
  organizationId?: string | null
  objectiveId?: string | null
  leadId?: string | null
  resourceId?: string | null
  sourceEventId?: string | null
}): string {
  return [
    input.source,
    input.signalType,
    input.organizationId ?? "",
    input.objectiveId ?? "",
    input.leadId ?? "",
    input.resourceId ?? "",
    input.sourceEventId ?? "",
  ].join(":")
}
