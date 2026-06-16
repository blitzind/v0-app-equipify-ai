/** SN-7 — client-safe operator notification center helpers. */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationRecord } from "@/lib/growth/notifications/growth-notification-persistence-types"
import type { GrowthOperatorNotificationRecipientRole } from "@/lib/growth/notifications/growth-notification-routing"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

export type GrowthOperatorNotificationCenterStatus = "unread" | "acknowledged" | "dismissed" | "all"

export type GrowthOperatorNotificationCenterListItem = {
  id: string
  eventType: GrowthOperatorNotificationEvent
  severity: GrowthOperatorNotificationSeverity
  recipientRole: GrowthOperatorNotificationRecipientRole
  title: string
  body: string
  createdAt: string
  acknowledgedAt: string | null
  dismissedAt: string | null
  entityHref: string | null
  entityLabel: string | null
  status: Exclude<GrowthOperatorNotificationCenterStatus, "all">
}

export function resolveGrowthOperatorNotificationEntityLink(input: {
  targetEntityType: string | null
  targetEntityId: string | null
}): { href: string | null; label: string | null } {
  if (!input.targetEntityType || !input.targetEntityId) {
    return { href: null, label: null }
  }

  switch (input.targetEntityType) {
    case "lead":
      return {
        href: `/admin/growth/leads/${input.targetEntityId}`,
        label: "Open lead",
      }
    case "reply":
      return {
        href: `/admin/growth/replies?replyId=${encodeURIComponent(input.targetEntityId)}`,
        label: "Open reply",
      }
    case "share_page":
      return {
        href: `/admin/growth/share-pages/${input.targetEntityId}`,
        label: "Open share page",
      }
    case "sequence_enrollment":
      return {
        href: `/admin/growth/sequences/enrollments/${input.targetEntityId}`,
        label: "Open enrollment",
      }
    case "inbox_thread":
      return {
        href: `/admin/growth/inbox?threadId=${encodeURIComponent(input.targetEntityId)}`,
        label: "Open thread",
      }
    default:
      return { href: null, label: null }
  }
}

export function mapGrowthOperatorNotificationCenterItem(
  record: GrowthOperatorNotificationRecord,
): GrowthOperatorNotificationCenterListItem {
  const entity = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: record.targetEntityType,
    targetEntityId: record.targetEntityId,
  })

  let status: GrowthOperatorNotificationCenterListItem["status"] = "unread"
  if (record.dismissedAt) status = "dismissed"
  else if (record.acknowledgedAt) status = "acknowledged"

  return {
    id: record.id,
    eventType: record.eventType,
    severity: record.severity,
    recipientRole: record.recipientRole,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
    acknowledgedAt: record.acknowledgedAt,
    dismissedAt: record.dismissedAt,
    entityHref: entity.href,
    entityLabel: entity.label,
    status,
  }
}

export function formatGrowthOperatorNotificationEventLabel(event: GrowthOperatorNotificationEvent): string {
  return event.replace(/_/g, " ")
}

export function formatGrowthOperatorNotificationRecipientRoleLabel(
  role: GrowthOperatorNotificationRecipientRole,
): string {
  return role.replace(/_/g, " ")
}

export function growthOperatorNotificationSeverityTone(
  severity: GrowthOperatorNotificationSeverity,
): "critical" | "high" | "medium" | "low" | "neutral" {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "medium"
  if (severity === "low") return "low"
  return "neutral"
}
