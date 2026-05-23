/** Client-safe Growth Engine timeline types. */

export const GROWTH_LEAD_TIMELINE_EVENT_TYPES = [
  "lead_created",
  "research_started",
  "research_completed",
  "research_failed",
  "website_fetch_failed",
  "website_fetch_fixed",
  "decision_maker_added",
  "decision_maker_confirmed",
  "decision_maker_rejected",
  "call_attempted",
  "voicemail_left",
  "interested",
  "follow_up_created",
  "follow_up_completed",
  "notes_updated",
  "priority_changed",
  "override_changed",
  "next_best_action_changed",
  "website_changed",
  "status_changed",
  "import_created",
  "import_updated",
  "manual_touch",
] as const

export type GrowthLeadTimelineEventType = (typeof GROWTH_LEAD_TIMELINE_EVENT_TYPES)[number]

export type GrowthLeadTimelineEvent = {
  id: string
  leadId: string
  eventType: GrowthLeadTimelineEventType
  title: string
  summary: string | null
  actorUserId: string | null
  actorEmail: string | null
  researchRunId: string | null
  callEventId: string | null
  decisionMakerId: string | null
  payload: Record<string, unknown>
  occurredAt: string
  createdAt: string
}
