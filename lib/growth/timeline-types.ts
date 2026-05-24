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
  "call_started",
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
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_replied",
  "email_bounced",
  "email_unsubscribed",
  "email_failed",
  "email_spam_complaint",
  "email_suppressed",
  "email_unmatched",
  "engagement_score_changed",
  "engagement_tier_changed",
  "lead_became_hot",
  "lead_became_dormant",
  "relationship_strength_changed",
  "relationship_became_trusted",
  "relationship_became_strategic",
  "relationship_cooled",
  "opportunity_readiness_changed",
  "lead_became_sales_ready",
  "lead_became_priority_opportunity",
  "opportunity_blocker_added",
  "opportunity_blocker_resolved",
  "revenue_probability_changed",
  "lead_became_forecasted",
  "lead_became_commit_candidate",
  "forecast_confidence_changed",
  "forecast_regression_detected",
  "executive_priority_changed",
  "executive_intervention_recommended",
  "operational_capacity_changed",
  "capacity_constraint_added",
  "capacity_constraint_resolved",
  "operational_risk_detected",
  "ai_copilot_generation_created",
  "ai_copilot_generation_approved",
  "outreach_queued",
  "outreach_approved",
  "outreach_executed",
  "outreach_failed",
  "outreach_cancelled",
  "call_copilot_session_started",
  "call_copilot_objection_captured",
  "call_copilot_session_completed",
  "call_copilot_summary_approved",
  "conversation_health_changed",
  "buying_intent_detected",
  "competitor_detected",
  "urgency_detected",
  "conversation_risk_detected",
  "sequence_pattern_detected",
  "sequence_recommendation_changed",
  "sequence_enrollment_created",
  "sequence_step_created",
  "sequence_step_queued",
  "sequence_step_executed",
  "sequence_enrollment_completed",
  "sequence_enrollment_cancelled",
  "live_call_started",
  "buying_signal_detected",
  "objection_detected",
  "discovery_gap_detected",
  "call_risk_detected",
  "live_call_completed",
  "live_guidance_generated",
  "live_guidance_used",
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
  outboundMessageId: string | null
  messageEventId: string | null
  outboundReplyId: string | null
  payload: Record<string, unknown>
  occurredAt: string
  createdAt: string
}
