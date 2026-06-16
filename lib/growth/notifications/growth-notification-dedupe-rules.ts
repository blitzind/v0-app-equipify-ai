/** SN-1 — operator notification dedupe rule foundation (no persistence). */

import { createHash } from "node:crypto"
import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_OPERATOR_NOTIFICATION_DEDUPE_RULES = [
  "never",
  "fifteen_minutes",
  "one_hour",
  "replace_previous",
] as const

export type GrowthOperatorNotificationDedupeRule =
  (typeof GROWTH_OPERATOR_NOTIFICATION_DEDUPE_RULES)[number]

const EVENT_DEDUPE_RULE: Record<
  GrowthOperatorNotificationEvent,
  GrowthOperatorNotificationDedupeRule
> = {
  lead_hot: "fifteen_minutes",
  engagement_spike: "one_hour",
  share_page_viewed: "fifteen_minutes",
  share_page_engaged: "fifteen_minutes",
  share_page_cta_clicked: "one_hour",
  share_page_booking_started: "one_hour",
  share_page_booking_completed: "never",
  reply_received: "fifteen_minutes",
  reply_positive_interest: "one_hour",
  reply_meeting_requested: "never",
  reply_competitor_detected: "one_hour",
  sequence_wait_started: "one_hour",
  sequence_wait_resolved: "never",
  sequence_wait_timeout: "never",
  sequence_branch_evaluated: "fifteen_minutes",
  sequence_advancement_blocked: "never",
  sms_reply_received: "fifteen_minutes",
  voice_drop_failed: "one_hour",
  thread_sla_at_risk: "one_hour",
  thread_sla_overdue: "replace_previous",
}

export function resolveGrowthOperatorNotificationDedupeRule(
  event: GrowthOperatorNotificationEvent,
): GrowthOperatorNotificationDedupeRule {
  return EVENT_DEDUPE_RULE[event]
}

export function resolveGrowthOperatorNotificationDedupeWindowMinutes(
  rule: GrowthOperatorNotificationDedupeRule,
): number | null {
  switch (rule) {
    case "never":
      return null
    case "fifteen_minutes":
      return 15
    case "one_hour":
      return 60
    case "replace_previous":
      return null
    default: {
      const _exhaustive: never = rule
      return _exhaustive
    }
  }
}

export function isGrowthOperatorNotificationDedupeReplacing(
  rule: GrowthOperatorNotificationDedupeRule,
): boolean {
  return rule === "replace_previous"
}

export function buildGrowthOperatorNotificationDedupeKey(input: {
  event: GrowthOperatorNotificationEvent
  sourceSystem: string
  sourceId?: string | null
  leadId?: string | null
  enrollmentId?: string | null
  threadId?: string | null
}): string {
  const payload = [
    input.event,
    input.sourceSystem,
    input.sourceId ?? "",
    input.leadId ?? "",
    input.enrollmentId ?? "",
    input.threadId ?? "",
  ].join("|")
  return createHash("sha256").update(payload).digest("hex").slice(0, 64)
}
