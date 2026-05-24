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
}

export const GROWTH_NOTIFICATION_EXPIRY_MINUTES: Partial<Record<GrowthNotificationType, number>> = {
  provider_degraded: 24 * 60,
  provider_retry_warning: 6 * 60,
  high_fit_lead: 7 * 24 * 60,
  engagement_spike: 3 * 24 * 60,
  stale_opportunity: 24 * 60,
  close_date_passed: 12 * 60,
  owner_overloaded: 6 * 60,
  followup_needed: 14 * 24 * 60,
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
