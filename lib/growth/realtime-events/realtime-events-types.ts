/** Phase GS-4C — Real-Time Event Bus types (client-safe). */

export const REALTIME_EVENTS_QA_MARKER = "growth-realtime-events-gs4c-v1" as const

export const REALTIME_EVENTS_CONFIRM = "RUN_REALTIME_EVENTS_CERTIFICATION" as const

export const REALTIME_EVENT_DELIVERY_STATUSES = [
  "pending",
  "routed",
  "delivered",
  "failed",
  "reviewed",
  "dismissed",
] as const

export type GrowthRealtimeEventDeliveryStatus = (typeof REALTIME_EVENT_DELIVERY_STATUSES)[number]

export const REALTIME_EVENT_SUBSCRIBERS = [
  "command_center",
  "operator_inbox",
  "inbox_v2",
  "human_interventions",
  "campaign_readiness",
  "conversational_playbooks",
  "follow_up_policies",
  "sequence_preview",
  "campaign_builder",
  "opportunity_intelligence",
  "signal_feed",
] as const

export type GrowthRealtimeEventSubscriber = (typeof REALTIME_EVENT_SUBSCRIBERS)[number]

export const REALTIME_EVENT_SOURCES = [
  "signal_feed",
  "operator_inbox",
  "campaign_readiness",
  "human_interventions",
  "follow_up_policies",
  "sequence_preview",
  "campaign_builder",
  "conversational_playbooks",
  "realtime_event_bus",
  "attention_feed",
  "unknown",
] as const

export type GrowthRealtimeEventSource = (typeof REALTIME_EVENT_SOURCES)[number]

export const REALTIME_EVENT_FILTERS = ["all", "routed", "pending", "failed"] as const
export type RealtimeEventFilter = (typeof REALTIME_EVENT_FILTERS)[number]

export const REALTIME_EVENT_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type RealtimeEventActionType = (typeof REALTIME_EVENT_ACTIONS)[number]

export type GrowthRealtimeEventRoute = {
  route_id: string
  subscriber: GrowthRealtimeEventSubscriber
  refresh_hint: string
  related_href: string | null
  priority: "low" | "medium" | "high"
}

export type GrowthRealtimeEventEnvelope = {
  event_id: string
  event_type: string
  source: GrowthRealtimeEventSource
  organization_id: string
  payload: Record<string, unknown>
  created_at: string
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export type GrowthRealtimeEvent = {
  qa_marker: typeof REALTIME_EVENTS_QA_MARKER
  event_id: string
  event_type: string
  source: GrowthRealtimeEventSource
  organization_id: string
  title: string
  description: string
  delivery_status: GrowthRealtimeEventDeliveryStatus
  routes: GrowthRealtimeEventRoute[]
  related_entity_type: string | null
  related_entity_id: string | null
  related_href: string | null
  lead_id: string | null
  review_status: "pending" | "reviewed" | "dismissed"
  envelope: GrowthRealtimeEventEnvelope
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  occurred_at: string
}

export type GrowthRealtimeEventsResponse = {
  qa_marker: typeof REALTIME_EVENTS_QA_MARKER
  generated_at: string
  total: number
  routed_count: number
  pending_count: number
  subscription_mode: "realtime" | "polling" | "unavailable"
  events: GrowthRealtimeEvent[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const REALTIME_EVENT_AUDIT_EVENTS = [
  "realtime_event_published",
  "realtime_event_routed",
  "realtime_event_reviewed",
  "realtime_event_dismissed",
] as const

export type RealtimeEventAuditEvent = (typeof REALTIME_EVENT_AUDIT_EVENTS)[number]

export type GrowthRealtimePublishRequest = {
  event_type: string
  source?: GrowthRealtimeEventSource
  payload?: Record<string, unknown>
  lead_id?: string | null
}
