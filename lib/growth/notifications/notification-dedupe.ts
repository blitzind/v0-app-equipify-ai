import { createHash } from "node:crypto"
import type { GrowthNotificationType } from "@/lib/growth/notifications/notification-types"

export const GROWTH_NOTIFICATION_COOLDOWN_MINUTES: Partial<Record<GrowthNotificationType, number>> = {
  provider_degraded: 60,
  provider_circuit_open: 30,
  provider_disconnected: 30,
  provider_retry_warning: 15,
  high_priority_unassigned: 120,
  capacity_warning: 180,
  workload_imbalance: 360,
  approval_required: 30,
  sequence_failed: 60,
  engagement_spike: 240,
  buying_signal_detected: 240,
  reply_waiting: 30,
  reply_overdue: 60,
  meeting_request_received: 15,
  competitor_mentioned: 60,
  high_priority_reply: 30,
  owner_response_gap: 120,
  meeting_requested: 15,
  meeting_scheduled: 30,
  meeting_starting_soon: 15,
  meeting_no_show: 60,
  post_meeting_followup_due: 60,
  meeting_outcome_missing: 120,
}

export const GROWTH_NOTIFICATION_EXPIRY_MINUTES: Partial<Record<GrowthNotificationType, number>> = {
  provider_degraded: 24 * 60,
  provider_retry_warning: 6 * 60,
  high_fit_lead: 7 * 24 * 60,
  engagement_spike: 3 * 24 * 60,
  stale_opportunity: 24 * 60,
  close_date_passed: 12 * 60,
  owner_overloaded: 6 * 60,
  forecast_gap: 12 * 60,
  pipeline_coverage_low: 12 * 60,
  commit_risk: 6 * 60,
  stale_high_value_deal: 24 * 60,
  close_date_slipped: 12 * 60,
  owner_pipeline_overloaded: 24 * 60,
  owner_pipeline_underloaded: 24 * 60,
  followup_needed: 14 * 24 * 60,
  reply_waiting: 7 * 24 * 60,
  reply_overdue: 3 * 24 * 60,
  meeting_request_received: 7 * 24 * 60,
  competitor_mentioned: 7 * 24 * 60,
  high_priority_reply: 7 * 24 * 60,
  owner_response_gap: 3 * 24 * 60,
  meeting_requested: 7 * 24 * 60,
  meeting_scheduled: 7 * 24 * 60,
  meeting_starting_soon: 24 * 60,
  meeting_no_show: 7 * 24 * 60,
  post_meeting_followup_due: 7 * 24 * 60,
  meeting_outcome_missing: 3 * 24 * 60,
}

export function buildGrowthNotificationDeterministicHash(input: {
  notificationType: GrowthNotificationType
  sourceSystem: string
  sourceId?: string | null
  ownerUserId?: string | null
  leadId?: string | null
  orgId?: string | null
}): string {
  const payload = [
    input.notificationType,
    input.sourceSystem,
    input.sourceId ?? "",
    input.ownerUserId ?? "",
    input.leadId ?? "",
    input.orgId ?? "",
  ].join("|")
  return createHash("sha256").update(payload).digest("hex").slice(0, 64)
}

export function resolveGrowthNotificationCooldownMinutes(
  notificationType: GrowthNotificationType,
  override?: number,
): number {
  if (override != null) return override
  return GROWTH_NOTIFICATION_COOLDOWN_MINUTES[notificationType] ?? 15
}

export function resolveGrowthNotificationExpiryMinutes(
  notificationType: GrowthNotificationType,
  override?: number | null,
): number | null {
  if (override === null) return null
  if (override != null) return override
  return GROWTH_NOTIFICATION_EXPIRY_MINUTES[notificationType] ?? 7 * 24 * 60
}
