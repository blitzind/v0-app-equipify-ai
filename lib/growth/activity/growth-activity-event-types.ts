/** GS-AI-PLAYBOOK-5C — Curated lead timeline event types for unified activity feed (client-safe). */

export const GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES = [
  "email_sent",
  "email_opened",
  "email_clicked",
  "email_replied",
  "reply_received",
  "inbox_reply_imported",
] as const

export const GROWTH_ACTIVITY_SALES_TIMELINE_TYPES = [
  "live_call_completed",
  "call_started",
  "interested",
  "meeting_scheduled",
  "meeting_completed",
  "meeting_requested",
  "opportunity_created",
  "opportunity_stage_changed",
  "opportunity_closed_won",
  "follow_up_created",
  "follow_up_completed",
] as const

export const GROWTH_ACTIVITY_PERSONALIZATION_TIMELINE_TYPES = [
  "ai_copilot_generation_created",
  "ai_copilot_generation_approved",
  "reply_draft_generated",
  "reply_draft_approved",
  "reply_draft_rejected",
] as const

export const GROWTH_ACTIVITY_INTELLIGENCE_TIMELINE_TYPES = [
  "engagement_score_changed",
  "engagement_increased",
  "high_engagement_detected",
  "lead_became_hot",
  "relationship_strength_changed",
  "relationship_became_trusted",
  "relationship_became_strategic",
  "relationship_cooled",
  "opportunity_readiness_changed",
  "buying_intent_detected",
] as const

export const GROWTH_ACTIVITY_UNIFIED_TIMELINE_TYPES = [
  ...GROWTH_ACTIVITY_COMMUNICATION_TIMELINE_TYPES,
  ...GROWTH_ACTIVITY_SALES_TIMELINE_TYPES,
  ...GROWTH_ACTIVITY_PERSONALIZATION_TIMELINE_TYPES,
  ...GROWTH_ACTIVITY_INTELLIGENCE_TIMELINE_TYPES,
] as const

export type GrowthActivityUnifiedTimelineEventType =
  (typeof GROWTH_ACTIVITY_UNIFIED_TIMELINE_TYPES)[number]
