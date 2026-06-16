/** SN-1 — deterministic operator notification severity (no AI). */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"

export const GROWTH_OPERATOR_NOTIFICATION_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const

export type GrowthOperatorNotificationSeverity =
  (typeof GROWTH_OPERATOR_NOTIFICATION_SEVERITIES)[number]

const EVENT_SEVERITY: Record<GrowthOperatorNotificationEvent, GrowthOperatorNotificationSeverity> =
  {
    lead_hot: "critical",
    engagement_spike: "high",
    share_page_viewed: "low",
    share_page_engaged: "low",
    share_page_cta_clicked: "medium",
    share_page_booking_started: "medium",
    share_page_booking_completed: "high",
    reply_received: "medium",
    reply_positive_interest: "high",
    reply_meeting_requested: "critical",
    reply_competitor_detected: "high",
    sequence_wait_started: "medium",
    sequence_wait_resolved: "medium",
    sequence_wait_timeout: "high",
    sequence_branch_evaluated: "low",
    sequence_advancement_blocked: "critical",
    sms_reply_received: "medium",
    voice_drop_failed: "high",
    thread_sla_at_risk: "high",
    thread_sla_overdue: "critical",
  }

export function resolveGrowthOperatorNotificationSeverity(
  event: GrowthOperatorNotificationEvent,
): GrowthOperatorNotificationSeverity {
  return EVENT_SEVERITY[event]
}
