import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER,
  type GrowthOperatorNotificationAnalyticsSnapshot,
} from "@/lib/growth/notifications/growth-notification-analytics-types"
import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import { resolveGrowthOperatorNotificationEntityLink } from "@/lib/growth/notifications/growth-notification-center-utils"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

type NotificationAnalyticsRow = {
  id: string
  event_type: string
  severity: string
  target_entity_type: string | null
  acknowledged_at: string | null
  dismissed_at: string | null
  expires_at: string | null
  created_at: string
}

type PushDeliveryRow = {
  status: string
}

const DEFAULT_WINDOW_DAYS = 30
const MAX_ANALYTICS_ROWS = 5000

function operatorNotificationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notifications")
}

function pushDeliveriesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notification_push_deliveries")
}

function isUnreadAt(row: NotificationAnalyticsRow, atIso: string): boolean {
  if (row.dismissed_at && row.dismissed_at <= atIso) return false
  if (row.expires_at && row.expires_at <= atIso) return false
  if (row.acknowledged_at && row.acknowledged_at <= atIso) return false
  return row.created_at <= atIso
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function toSortedCounts(map: Map<string, number>, limit = 10) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
  return sorted[index] ?? null
}

function buildUnreadOverTime(rows: NotificationAnalyticsRow[], windowDays: number, now: Date) {
  const points = []
  for (let dayOffset = windowDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    day.setUTCDate(day.getUTCDate() - dayOffset)
    const endOfDay = new Date(day)
    endOfDay.setUTCHours(23, 59, 59, 999)
    const unread = rows.filter((row) => isUnreadAt(row, endOfDay.toISOString())).length
    points.push({
      date: day.toISOString().slice(0, 10),
      unread,
    })
  }
  return points
}

export async function getGrowthOperatorNotificationAnalytics(
  admin: SupabaseClient,
  input: {
    recipientUserId: string
    includePlatformAdminPool?: boolean
    windowDays?: number
  },
): Promise<GrowthOperatorNotificationAnalyticsSnapshot> {
  const windowDays = Math.min(Math.max(input.windowDays ?? DEFAULT_WINDOW_DAYS, 1), 90)
  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays)

  let notificationQuery = operatorNotificationsTable(admin)
    .select(
      "id, event_type, severity, target_entity_type, acknowledged_at, dismissed_at, expires_at, created_at",
    )
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(MAX_ANALYTICS_ROWS)

  if (input.includePlatformAdminPool) {
    notificationQuery = notificationQuery.or(
      `recipient_user_id.eq.${input.recipientUserId},and(recipient_role.eq.platform_admin,recipient_user_id.is.null)`,
    )
  } else {
    notificationQuery = notificationQuery.eq("recipient_user_id", input.recipientUserId)
  }

  const { data: notificationData, error: notificationError } = await notificationQuery
  if (notificationError) throw new Error(notificationError.message)

  const rows = (notificationData ?? []) as NotificationAnalyticsRow[]
  const nowIso = now.toISOString()

  const byEventType = new Map<string, number>()
  const bySeverity = new Map<string, number>()
  const bySource = new Map<string, number>()
  const responseDurationsMs: number[] = []

  let unread = 0
  let criticalHigh = 0
  let acknowledged = 0
  let dismissed = 0

  for (const row of rows) {
    incrementCount(byEventType, row.event_type)
    incrementCount(bySeverity, row.severity)
    incrementCount(bySource, row.target_entity_type ?? "unknown")

    if (row.acknowledged_at) acknowledged += 1
    if (row.dismissed_at) dismissed += 1

    if (isUnreadAt(row, nowIso)) {
      unread += 1
      if (row.severity === "critical" || row.severity === "high") criticalHigh += 1
    }

    if (row.acknowledged_at) {
      const durationMs = Date.parse(row.acknowledged_at) - Date.parse(row.created_at)
      if (Number.isFinite(durationMs) && durationMs >= 0) responseDurationsMs.push(durationMs)
    }
  }

  const notificationIds = rows.map((row) => row.id)
  const pushCounts = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  if (notificationIds.length > 0) {
    const { data: deliveryData, error: deliveryError } = await pushDeliveriesTable(admin)
      .select("status")
      .in("notification_id", notificationIds)

    if (deliveryError && !deliveryError.message.includes("Could not find the table")) {
      throw new Error(deliveryError.message)
    }

    for (const delivery of (deliveryData ?? []) as PushDeliveryRow[]) {
      pushCounts.attempted += 1
      if (delivery.status === "sent") pushCounts.sent += 1
      else if (delivery.status === "failed") pushCounts.failed += 1
      else if (delivery.status === "skipped") pushCounts.skipped += 1
    }
  }

  const actionable = rows.length
  const acknowledgeRate = actionable > 0 ? acknowledged / actionable : 0
  const dismissRate = actionable > 0 ? dismissed / actionable : 0
  const averageMs =
    responseDurationsMs.length > 0
      ? responseDurationsMs.reduce((sum, value) => sum + value, 0) / responseDurationsMs.length
      : null

  return {
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER,
    windowDays,
    generatedAt: nowIso,
    totals: {
      total: rows.length,
      unread,
      criticalHigh,
      acknowledged,
      dismissed,
    },
    volumeByEventType: toSortedCounts(byEventType, 20),
    volumeBySeverity: toSortedCounts(bySeverity, 4),
    unreadOverTime: buildUnreadOverTime(rows, windowDays, now),
    rates: {
      acknowledgeRate,
      dismissRate,
    },
    push: pushCounts,
    topSources: toSortedCounts(bySource, 10),
    topEventTypes: toSortedCounts(byEventType, 10),
    responseTiming: {
      sampleSize: responseDurationsMs.length,
      medianMs: percentile(responseDurationsMs, 0.5),
      p90Ms: percentile(responseDurationsMs, 0.9),
      averageMs,
    },
  }
}

export function mapNotificationRowForDigest(row: {
  id: string
  event_type: string
  severity: string
  title: string
  body: string
  target_entity_type: string | null
  target_entity_id: string | null
  created_at: string
}) {
  const entity = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
  })

  return {
    notificationId: row.id,
    eventType: row.event_type as GrowthOperatorNotificationEvent,
    severity: row.severity as GrowthOperatorNotificationSeverity,
    title: row.title,
    body: row.body,
    targetRoute: entity.href ?? "/admin/growth/notifications",
    createdAt: row.created_at,
  }
}
