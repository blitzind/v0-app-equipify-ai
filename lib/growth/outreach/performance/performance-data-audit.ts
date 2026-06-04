/** Performance data source audit (Phase 4.6A). Client-safe. */

export const OUTREACH_PERFORMANCE_AVAILABLE_METRICS = [
  "ai_copilot_generations.classification.personalization",
  "ai_copilot_generations.sent_at",
  "ai_copilot_generations.status",
  "outreach_queue_items.generation_id",
  "outreach_queue_items.executed_at",
  "delivery_attempts.status",
  "delivery_attempts.sent_at",
  "delivery_attempts.metadata",
  "outbound_replies.intent",
  "outbound_replies.received_at",
  "reply_ingestion_events.lead_id",
  "reply_ingestion_events.delivery_attempt_id",
  "inbox_messages.thread_id",
  "sequence_enrollments.lead_id",
  "sequence_enrollment_steps.generation_id",
  "opportunities.lead_id",
  "opportunities.created_at",
  "booking_intent_signals.lead_id",
  "timeline_events.lead_id",
  "lead_memory_events.lead_id",
  "personalization_generations.evidence",
  "ai_copilot_effectiveness.outcome",
  "outreach_performance_attributions",
] as const

export const OUTREACH_PERFORMANCE_MISSING_METRICS = [
  "direct_generation_to_reply_ingestion_fk",
  "subject_line_ab_variant_on_delivery_attempt",
  "opener_text_hash_on_delivery_attempt",
  "cta_click_events_per_generation",
  "unified_positive_interest_label_on_all_reply_paths",
  "automatic_outcome_backfill_job",
  "holdout_control_arm_assignment",
] as const

export const OUTREACH_PERFORMANCE_ATTRIBUTION_LIMITATIONS = [
  "Reply attribution uses lead_id + time window after send — not thread-level message pairing for all providers.",
  "Meeting booked uses booking_intent_signals and timeline meeting events — may under-count manual bookings.",
  "Opportunity conversion uses opportunities.created_at after send — excludes pre-existing pipeline.",
  "Ephemeral generations (store_generations=false) are excluded from persisted attribution.",
  "Personalization dashboard path uses personalization_generations — separate from ai_copilot_generations attribution.",
  "Sequence experiment metrics exist separately in sequence_experiment_results — not merged into this dashboard yet.",
] as const

export type OutreachPerformanceDataAudit = {
  availableMetrics: readonly string[]
  missingMetrics: readonly string[]
  attributionLimitations: readonly string[]
}

export function buildOutreachPerformanceDataAudit(): OutreachPerformanceDataAudit {
  return {
    availableMetrics: OUTREACH_PERFORMANCE_AVAILABLE_METRICS,
    missingMetrics: OUTREACH_PERFORMANCE_MISSING_METRICS,
    attributionLimitations: OUTREACH_PERFORMANCE_ATTRIBUTION_LIMITATIONS,
  }
}
