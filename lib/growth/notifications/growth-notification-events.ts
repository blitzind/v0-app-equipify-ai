/** SN-1 — Sendr-style operator notification event taxonomy (foundation only). */

export const GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER =
  "growth-operator-notifications-sn1-v1" as const

export const GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS = [
  "lead",
  "share_page",
  "reply",
  "sequence",
  "messaging",
  "inbox",
] as const

export type GrowthOperatorNotificationEventGroup =
  (typeof GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS)[number]

export const GROWTH_OPERATOR_NOTIFICATION_LEAD_EVENTS = [
  "lead_hot",
  "engagement_spike",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS = [
  "share_page_viewed",
  "share_page_engaged",
  "share_page_cta_clicked",
  "share_page_booking_started",
  "share_page_booking_completed",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS = [
  "reply_received",
  "reply_positive_interest",
  "reply_meeting_requested",
  "reply_competitor_detected",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS = [
  "sequence_wait_started",
  "sequence_wait_resolved",
  "sequence_wait_timeout",
  "sequence_branch_evaluated",
  "sequence_advancement_blocked",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_MESSAGING_EVENTS = [
  "sms_reply_received",
  "voice_drop_failed",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS = [
  "thread_sla_at_risk",
  "thread_sla_overdue",
] as const

export const GROWTH_OPERATOR_NOTIFICATION_EVENTS = [
  ...GROWTH_OPERATOR_NOTIFICATION_LEAD_EVENTS,
  ...GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS,
  ...GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS,
  ...GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS,
  ...GROWTH_OPERATOR_NOTIFICATION_MESSAGING_EVENTS,
  ...GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS,
] as const

export type GrowthOperatorNotificationLeadEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_LEAD_EVENTS)[number]

export type GrowthOperatorNotificationSharePageEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS)[number]

export type GrowthOperatorNotificationReplyEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS)[number]

export type GrowthOperatorNotificationSequenceEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS)[number]

export type GrowthOperatorNotificationMessagingEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_MESSAGING_EVENTS)[number]

export type GrowthOperatorNotificationInboxEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS)[number]

export type GrowthOperatorNotificationEvent =
  (typeof GROWTH_OPERATOR_NOTIFICATION_EVENTS)[number]

export const GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP: Record<
  GrowthOperatorNotificationEvent,
  GrowthOperatorNotificationEventGroup
> = {
  lead_hot: "lead",
  engagement_spike: "lead",
  share_page_viewed: "share_page",
  share_page_engaged: "share_page",
  share_page_cta_clicked: "share_page",
  share_page_booking_started: "share_page",
  share_page_booking_completed: "share_page",
  reply_received: "reply",
  reply_positive_interest: "reply",
  reply_meeting_requested: "reply",
  reply_competitor_detected: "reply",
  sequence_wait_started: "sequence",
  sequence_wait_resolved: "sequence",
  sequence_wait_timeout: "sequence",
  sequence_branch_evaluated: "sequence",
  sequence_advancement_blocked: "sequence",
  sms_reply_received: "messaging",
  voice_drop_failed: "messaging",
  thread_sla_at_risk: "inbox",
  thread_sla_overdue: "inbox",
}

export function resolveGrowthOperatorNotificationEventGroup(
  event: GrowthOperatorNotificationEvent,
): GrowthOperatorNotificationEventGroup {
  return GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event]
}

export function isGrowthOperatorNotificationEvent(
  value: string,
): value is GrowthOperatorNotificationEvent {
  return (GROWTH_OPERATOR_NOTIFICATION_EVENTS as readonly string[]).includes(value)
}
