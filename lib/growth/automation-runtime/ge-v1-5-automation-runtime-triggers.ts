/** GE-v1-5 — Trigger registry and event normalization (client-safe). */

import type { GrowthSendrEngagementEventType } from "@/lib/growth/sendr/growth-sendr-config"
import type { GeV15AutomationRuntimeTrigger } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

/** Maps SENDR public engagement event types to GE-v1-5 triggers. */
export const GE_V1_5_SENDR_EVENT_TO_TRIGGER: Partial<
  Record<GrowthSendrEngagementEventType, GeV15AutomationRuntimeTrigger>
> = {
  video_start: "video_view_started",
  video_complete: "video_completed",
  cta_click: "cta_clicked",
  booking_started: "booking_started",
  booking_completed: "booking_completed",
  agent_opened: "agent_opened",
  question_asked: "question_asked",
  booking_offered: "booking_offered",
  conversation_completed: "conversation_completed",
}

/** Maps sequence condition events to GE-v1-5 triggers. */
export const GE_V1_5_SEQUENCE_EVENT_TO_TRIGGER: Record<string, GeV15AutomationRuntimeTrigger> = {
  "email.opened": "email_opened",
  "email.clicked": "email_clicked",
  "email.replied": "reply_received",
  "media.play_started": "video_view_started",
  "media.completed": "video_completed",
  "media.cta_clicked": "cta_clicked",
  "share_page.booking_started": "booking_started",
  "share_page.booking_completed": "booking_completed",
}

/** Maps S5 automation enrollment triggers to GE-v1-5 triggers. */
export const GE_V1_5_S5_TRIGGER_TO_RUNTIME: Record<string, GeV15AutomationRuntimeTrigger> = {
  "media.viewed": "video_view_started",
  "media.play_started": "video_view_started",
  "media.completed": "video_completed",
  "media.cta_clicked": "cta_clicked",
  "booking_handoff.ready": "booking_started",
  "high_intent.detected": "question_asked",
}

export const GE_V1_5_LEAD_EVENT_SOURCE_TO_TRIGGER: Record<string, GeV15AutomationRuntimeTrigger> = {
  lead_created: "lead_created",
  audience_enrolled: "audience_enrolled",
  enrichment_completed: "enrichment_completed",
  buying_committee_completed: "buying_committee_completed",
  video_generated: "video_generated",
  video_attached: "video_attached",
}

export function normalizeSendrEventToGeV15Trigger(
  eventType: string,
): GeV15AutomationRuntimeTrigger | null {
  return (
    GE_V1_5_SENDR_EVENT_TO_TRIGGER[eventType as GrowthSendrEngagementEventType] ??
    GE_V1_5_SEQUENCE_EVENT_TO_TRIGGER[eventType] ??
    GE_V1_5_LEAD_EVENT_SOURCE_TO_TRIGGER[eventType] ??
    null
  )
}

export function isGeV15SupportedTrigger(value: string): value is GeV15AutomationRuntimeTrigger {
  return (
    value in GE_V1_5_SENDR_EVENT_TO_TRIGGER ||
    value in GE_V1_5_SEQUENCE_EVENT_TO_TRIGGER ||
    value in GE_V1_5_S5_TRIGGER_TO_RUNTIME ||
    value in GE_V1_5_LEAD_EVENT_SOURCE_TO_TRIGGER ||
    [
      "email_opened",
      "email_clicked",
      "reply_received",
      "video_view_started",
      "video_completed",
      "cta_clicked",
      "booking_started",
      "booking_completed",
      "agent_opened",
      "question_asked",
      "booking_offered",
      "conversation_completed",
      "lead_created",
      "audience_enrolled",
      "enrichment_completed",
      "buying_committee_completed",
      "video_generated",
      "video_attached",
    ].includes(value)
  )
}

export function describeGeV15Trigger(trigger: GeV15AutomationRuntimeTrigger): string {
  return trigger.replace(/_/g, " ")
}
