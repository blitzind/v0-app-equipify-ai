/** Client-safe Growth Engine notification + attention types (slice 6.18A). */

export const GROWTH_NOTIFICATIONS_QA_MARKER = "growth-notifications-v1" as const

export const GROWTH_NOTIFICATION_SEVERITIES = ["critical", "high", "medium", "low"] as const
export type GrowthNotificationSeverity = (typeof GROWTH_NOTIFICATION_SEVERITIES)[number]

export const GROWTH_NOTIFICATION_SOURCE_SYSTEMS = [
  "assignment",
  "scheduler",
  "outreach",
  "provider",
  "intelligence",
  "coaching",
  "opportunity",
  "rep_ops",
  "post_close",
] as const
export type GrowthNotificationSourceSystem = (typeof GROWTH_NOTIFICATION_SOURCE_SYSTEMS)[number]

export const GROWTH_NOTIFICATION_TYPES = [
  "lead_assigned",
  "reassigned",
  "high_priority_unassigned",
  "approval_required",
  "sequence_failed",
  "suppression_blocked",
  "provider_execution_failed",
  "provider_degraded",
  "provider_circuit_open",
  "provider_disconnected",
  "buying_signal_detected",
  "engagement_spike",
  "high_fit_lead",
  "objection_detected",
  "discovery_gap_detected",
  "provider_retry_warning",
  "opportunity_at_risk",
  "stale_opportunity",
  "followup_needed",
  "close_date_passed",
  "owner_overloaded",
  "forecast_gap",
  "pipeline_coverage_low",
  "commit_risk",
  "stale_high_value_deal",
  "close_date_slipped",
  "owner_pipeline_overloaded",
  "owner_pipeline_underloaded",
  "capacity_warning",
  "workload_imbalance",
  "reply_waiting",
  "reply_overdue",
  "meeting_request_received",
  "competitor_mentioned",
  "high_priority_reply",
  "owner_response_gap",
  "meeting_requested",
  "meeting_scheduled",
  "meeting_starting_soon",
  "meeting_no_show",
  "post_meeting_followup_due",
  "meeting_outcome_missing",
  "cadence_task_due",
  "cadence_task_overdue",
  "cadence_task_completed",
  "cadence_task_skipped",
  "manual_call_due",
  "linkedin_task_due",
  "onboarding_overdue",
  "review_request_due",
  "review_received",
  "referral_eligible",
  "renewal_due",
  "renewal_risk",
  "expansion_candidate",
  "churn_risk",
  "followup_missing",
  "dogfood_failure",
  "dogfood_blocker",
  "validation_complete",
  "calendar_sync_failed",
  "meeting_synced",
  "meeting_conflict",
] as const
export type GrowthNotificationType = (typeof GROWTH_NOTIFICATION_TYPES)[number]

export const GROWTH_ATTENTION_QUEUE_VIEWS = [
  "my_work",
  "needs_action",
  "critical",
  "today",
  "overdue",
  "unassigned",
  "provider_issues",
  "approval_queue",
] as const
export type GrowthAttentionQueueView = (typeof GROWTH_ATTENTION_QUEUE_VIEWS)[number]

export type GrowthNotification = {
  id: string
  orgId: string | null
  ownerUserId: string | null
  leadId: string | null
  opportunityId: string | null
  notificationType: GrowthNotificationType
  severity: GrowthNotificationSeverity
  title: string
  body: string
  metadata: Record<string, unknown>
  createdAt: string
  acknowledgedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  sourceSystem: GrowthNotificationSourceSystem
  sourceId: string | null
  deterministicHash: string
  priorityScore: number
  actionUrl: string | null
  collapseCount: number
}

export type GrowthAttentionFeedInput = {
  ownerUserId?: string | null
  view?: GrowthAttentionQueueView
  severity?: GrowthNotificationSeverity
  notificationType?: GrowthNotificationType
  sourceSystem?: GrowthNotificationSourceSystem
  status?: "open" | "acknowledged" | "completed" | "all"
  limit?: number
  offset?: number
}

export type GrowthAttentionDashboard = {
  qaMarker: typeof GROWTH_NOTIFICATIONS_QA_MARKER
  criticalCount: number
  needsApprovalCount: number
  highFitWaitingCount: number
  providerIssueCount: number
  sequenceFailureCount: number
  followUpsDueCount: number
  staleOpportunityCount: number
  workloadImbalanceCount: number
  myWorkCount: number
  unassignedCount: number
  overdueCount: number
}

export type GrowthAttentionFeedResult = {
  items: GrowthNotification[]
  total: number
  hasMore: boolean
}

export type EmitGrowthNotificationInput = {
  orgId?: string | null
  ownerUserId?: string | null
  leadId?: string | null
  opportunityId?: string | null
  notificationType: GrowthNotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
  sourceSystem: GrowthNotificationSourceSystem
  sourceId?: string | null
  actionUrl?: string | null
  expiresInMinutes?: number | null
  cooldownMinutes?: number
  dryRun?: boolean
}
