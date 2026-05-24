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
