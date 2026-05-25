import type { GrowthNotificationSeverity, GrowthNotificationType } from "@/lib/growth/notifications/notification-types"

const TYPE_SEVERITY: Record<GrowthNotificationType, GrowthNotificationSeverity> = {
  lead_assigned: "medium",
  reassigned: "medium",
  high_priority_unassigned: "critical",
  approval_required: "medium",
  sequence_failed: "high",
  suppression_blocked: "medium",
  provider_execution_failed: "high",
  provider_degraded: "high",
  provider_circuit_open: "critical",
  provider_disconnected: "critical",
  buying_signal_detected: "high",
  engagement_spike: "high",
  high_fit_lead: "critical",
  objection_detected: "medium",
  discovery_gap_detected: "medium",
  provider_retry_warning: "medium",
  opportunity_at_risk: "high",
  stale_opportunity: "medium",
  followup_needed: "medium",
  close_date_passed: "high",
  owner_overloaded: "medium",
  forecast_gap: "high",
  pipeline_coverage_low: "high",
  commit_risk: "high",
  stale_high_value_deal: "high",
  close_date_slipped: "medium",
  owner_pipeline_overloaded: "medium",
  owner_pipeline_underloaded: "low",
  capacity_warning: "medium",
  workload_imbalance: "low",
  reply_waiting: "medium",
  reply_overdue: "high",
  meeting_request_received: "critical",
  competitor_mentioned: "high",
  high_priority_reply: "high",
  owner_response_gap: "medium",
  meeting_requested: "critical",
  meeting_scheduled: "medium",
  meeting_starting_soon: "high",
  meeting_no_show: "high",
  post_meeting_followup_due: "medium",
  meeting_outcome_missing: "medium",
  cadence_task_due: "medium",
  cadence_task_overdue: "high",
  cadence_task_completed: "low",
  cadence_task_skipped: "medium",
  manual_call_due: "high",
  linkedin_task_due: "medium",
  onboarding_overdue: "high",
  review_request_due: "medium",
  review_received: "low",
  referral_eligible: "medium",
  renewal_due: "high",
  renewal_risk: "critical",
  expansion_candidate: "medium",
  churn_risk: "high",
  followup_missing: "medium",
  dogfood_failure: "critical",
  dogfood_blocker: "critical",
  validation_complete: "low",
  calendar_sync_failed: "high",
  meeting_synced: "low",
  meeting_conflict: "high",
  deal_risk_increased: "high",
  high_probability_deal: "medium",
  forecast_confidence_dropped: "high",
  close_window_detected: "medium",
  deal_needs_action: "high",
  call_score_low: "high",
  next_step_missing: "medium",
  competitor_risk_detected: "high",
  unresolved_objection: "medium",
  strong_buying_signal: "medium",
  call_followup_due: "medium",
  meeting_follow_up_recommended: "medium",
  meeting_at_risk: "high",
  meeting_high_quality: "medium",
  meeting_stalled: "high",
  callback_due: "high",
  priority_call_ready: "critical",
  missed_callback: "high",
  meeting_booked_from_call: "medium",
}

const SEVERITY_BASE: Record<GrowthNotificationSeverity, number> = {
  critical: 900,
  high: 700,
  medium: 500,
  low: 300,
}

export function resolveGrowthNotificationSeverity(
  notificationType: GrowthNotificationType,
): GrowthNotificationSeverity {
  return TYPE_SEVERITY[notificationType]
}

export function computeGrowthNotificationPriorityScore(input: {
  notificationType: GrowthNotificationType
  severity?: GrowthNotificationSeverity
  leadScore?: number | null
  isOverdue?: boolean
  collapseCount?: number
}): number {
  const severity = input.severity ?? resolveGrowthNotificationSeverity(input.notificationType)
  let score = SEVERITY_BASE[severity]
  if (input.leadScore != null) score += Math.min(80, Math.round(input.leadScore * 0.5))
  if (input.isOverdue) score += 50
  if (input.collapseCount && input.collapseCount > 1) score += Math.min(30, input.collapseCount * 2)
  return Math.min(1000, score)
}
