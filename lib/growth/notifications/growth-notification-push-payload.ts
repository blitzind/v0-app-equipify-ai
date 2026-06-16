import type { GrowthOperatorNotificationRecord } from "@/lib/growth/notifications/growth-notification-persistence-types"
import { resolveGrowthOperatorNotificationEntityLink } from "@/lib/growth/notifications/growth-notification-center-utils"
import type { GrowthOperatorNotificationPushPayload } from "@/lib/growth/notifications/growth-notification-push-types"

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /(?:\+\d|\(\d{3}\))[\d\s().-]{6,}\d/g
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export function sanitizeGrowthOperatorNotificationPushText(value: string): string {
  return value
    .replace(new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags), "[redacted]")
    .replace(new RegExp(PHONE_PATTERN.source, PHONE_PATTERN.flags), "[redacted]")
    .trim()
}

export function buildGrowthOperatorNotificationPushPayload(
  record: GrowthOperatorNotificationRecord,
): GrowthOperatorNotificationPushPayload {
  const entity = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: record.targetEntityType,
    targetEntityId: record.targetEntityId,
  })

  return {
    notificationId: record.id,
    eventType: record.eventType,
    severity: record.severity,
    title: sanitizeGrowthOperatorNotificationPushText(record.title),
    body: sanitizeGrowthOperatorNotificationPushText(record.body),
    targetRoute: entity.href ?? "/admin/growth/notifications",
  }
}

export function assertGrowthOperatorNotificationPushPayloadSafe(
  payload: GrowthOperatorNotificationPushPayload,
): void {
  const serialized = JSON.stringify(payload)
  if (new RegExp(EMAIL_PATTERN.source, "i").test(serialized)) {
    throw new Error("push_payload_contains_email")
  }
  const withoutUuids = serialized.replace(new RegExp(UUID_PATTERN.source, UUID_PATTERN.flags), "")
  if (new RegExp(PHONE_PATTERN.source).test(withoutUuids)) {
    throw new Error("push_payload_contains_phone")
  }
  if (serialized.includes("payload")) {
    throw new Error("push_payload_contains_sensitive_key")
  }
}
