import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import {
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
  type GrowthOperatorNotificationCreateInput,
  type GrowthOperatorNotificationListInput,
  type GrowthOperatorNotificationListResult,
  type GrowthOperatorNotificationRecord,
  type GrowthOperatorNotificationUnreadCounts,
} from "@/lib/growth/notifications/growth-notification-persistence-types"
import type { GrowthOperatorNotificationRecipientRole } from "@/lib/growth/notifications/growth-notification-routing"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

const SELECT =
  "id, organization_id, event_type, severity, recipient_role, recipient_user_id, dedupe_key, title, body, payload, target_entity_type, target_entity_id, acknowledged_at, dismissed_at, expires_at, created_at, updated_at"

type OperatorNotificationRow = {
  id: string
  organization_id: string | null
  event_type: string
  severity: string
  recipient_role: string
  recipient_user_id: string | null
  dedupe_key: string
  title: string
  body: string
  payload: Record<string, unknown> | null
  target_entity_type: string | null
  target_entity_id: string | null
  acknowledged_at: string | null
  dismissed_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

function operatorNotificationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notifications")
}

function mapRow(row: OperatorNotificationRow): GrowthOperatorNotificationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventType: row.event_type as GrowthOperatorNotificationEvent,
    severity: row.severity as GrowthOperatorNotificationSeverity,
    recipientRole: row.recipient_role as GrowthOperatorNotificationRecipientRole,
    recipientUserId: row.recipient_user_id,
    dedupeKey: row.dedupe_key,
    title: row.title,
    body: row.body,
    payload: row.payload ?? {},
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isUnreadRow(row: OperatorNotificationRow, nowIso: string): boolean {
  if (row.dismissed_at) return false
  if (row.expires_at && row.expires_at <= nowIso) return false
  return !row.acknowledged_at
}

export async function createNotification(
  admin: SupabaseClient,
  input: GrowthOperatorNotificationCreateInput,
): Promise<GrowthOperatorNotificationRecord> {
  const { data, error } = await operatorNotificationsTable(admin)
    .insert({
      organization_id: input.organizationId ?? null,
      event_type: input.eventType,
      severity: input.severity,
      recipient_role: input.recipientRole,
      recipient_user_id: input.recipientUserId ?? null,
      dedupe_key: input.dedupeKey,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      target_entity_type: input.targetEntityType ?? null,
      target_entity_id: input.targetEntityId ?? null,
      expires_at: input.expiresAt ?? null,
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as OperatorNotificationRow)
}

export async function createNotifications(
  admin: SupabaseClient,
  inputs: GrowthOperatorNotificationCreateInput[],
): Promise<GrowthOperatorNotificationRecord[]> {
  if (inputs.length === 0) return []

  const { data, error } = await operatorNotificationsTable(admin)
    .insert(
      inputs.map((input) => ({
        organization_id: input.organizationId ?? null,
        event_type: input.eventType,
        severity: input.severity,
        recipient_role: input.recipientRole,
        recipient_user_id: input.recipientUserId ?? null,
        dedupe_key: input.dedupeKey,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
        target_entity_type: input.targetEntityType ?? null,
        target_entity_id: input.targetEntityId ?? null,
        expires_at: input.expiresAt ?? null,
        qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      })),
    )
    .select(SELECT)

  if (error) throw new Error(error.message)
  return ((data ?? []) as OperatorNotificationRow[]).map(mapRow)
}

export async function listNotifications(
  admin: SupabaseClient,
  input: GrowthOperatorNotificationListInput = {},
): Promise<GrowthOperatorNotificationListResult> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const now = new Date().toISOString()

  let query = operatorNotificationsTable(admin).select(SELECT, { count: "exact" })

  if (input.organizationId) query = query.eq("organization_id", input.organizationId)
  if (input.recipientRole) query = query.eq("recipient_role", input.recipientRole)

  if (input.recipientUserId && input.includePlatformAdminPool) {
    query = query.or(
      `recipient_user_id.eq.${input.recipientUserId},and(recipient_role.eq.platform_admin,recipient_user_id.is.null)`,
    )
  } else if (input.recipientUserId) {
    query = query.eq("recipient_user_id", input.recipientUserId)
  }

  if (input.eventType) query = query.eq("event_type", input.eventType)
  if (input.severity) query = query.eq("severity", input.severity)

  query = query.or(`expires_at.is.null,expires_at.gt.${now}`)

  if (input.status) {
    switch (input.status) {
      case "unread":
        query = query.is("dismissed_at", null).is("acknowledged_at", null)
        break
      case "acknowledged":
        query = query.is("dismissed_at", null).not("acknowledged_at", "is", null)
        break
      case "dismissed":
        query = query.not("dismissed_at", "is", null)
        break
      case "all":
        break
      default: {
        const _exhaustive: never = input.status
        return _exhaustive
      }
    }
  } else {
    if (!input.includeDismissed) query = query.is("dismissed_at", null)
    if (input.unreadOnly) query = query.is("acknowledged_at", null)
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    items: ((data ?? []) as OperatorNotificationRow[]).map(mapRow),
    total,
    hasMore: offset + limit < total,
  }
}

export async function acknowledgeNotification(
  admin: SupabaseClient,
  notificationId: string,
): Promise<GrowthOperatorNotificationRecord | null> {
  const { data, error } = await operatorNotificationsTable(admin)
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("dismissed_at", null)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as OperatorNotificationRow) : null
}

export async function dismissNotification(
  admin: SupabaseClient,
  notificationId: string,
): Promise<GrowthOperatorNotificationRecord | null> {
  const now = new Date().toISOString()
  const { data, error } = await operatorNotificationsTable(admin)
    .update({ dismissed_at: now, acknowledged_at: now })
    .eq("id", notificationId)
    .is("dismissed_at", null)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as OperatorNotificationRow) : null
}

export async function expireNotifications(admin: SupabaseClient): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await operatorNotificationsTable(admin)
    .update({ dismissed_at: now })
    .lt("expires_at", now)
    .is("dismissed_at", null)
    .select("id")

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function getUnreadCounts(
  admin: SupabaseClient,
  input: {
    recipientUserId?: string | null
    organizationId?: string | null
    includePlatformAdminPool?: boolean
  } = {},
): Promise<GrowthOperatorNotificationUnreadCounts> {
  await expireNotifications(admin)

  const now = new Date().toISOString()
  let query = operatorNotificationsTable(admin)
    .select("severity")
    .is("dismissed_at", null)
    .is("acknowledged_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (input.organizationId) query = query.eq("organization_id", input.organizationId)

  if (input.recipientUserId && input.includePlatformAdminPool) {
    query = query.or(
      `recipient_user_id.eq.${input.recipientUserId},and(recipient_role.eq.platform_admin,recipient_user_id.is.null)`,
    )
  } else if (input.recipientUserId) {
    query = query.eq("recipient_user_id", input.recipientUserId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const counts: GrowthOperatorNotificationUnreadCounts = {
    unreadTotal: 0,
    unreadCritical: 0,
    unreadHigh: 0,
    unreadMedium: 0,
    unreadLow: 0,
  }

  for (const row of (data ?? []) as Array<{ severity: string }>) {
    counts.unreadTotal += 1
    switch (row.severity) {
      case "critical":
        counts.unreadCritical += 1
        break
      case "high":
        counts.unreadHigh += 1
        break
      case "medium":
        counts.unreadMedium += 1
        break
      case "low":
        counts.unreadLow += 1
        break
      default:
        break
    }
  }

  return counts
}

export async function listActiveNotificationsForDedupeScope(
  admin: SupabaseClient,
  input: {
    dedupeKey: string
    recipientRole: GrowthOperatorNotificationRecipientRole
    recipientUserId?: string | null
  },
): Promise<GrowthOperatorNotificationRecord[]> {
  const now = new Date().toISOString()
  let query = operatorNotificationsTable(admin)
    .select(SELECT)
    .eq("dedupe_key", input.dedupeKey)
    .eq("recipient_role", input.recipientRole)
    .is("dismissed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })

  if (input.recipientUserId) {
    query = query.eq("recipient_user_id", input.recipientUserId)
  } else {
    query = query.is("recipient_user_id", null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as OperatorNotificationRow[]).map(mapRow)
}

export async function dismissNotificationsByIds(
  admin: SupabaseClient,
  notificationIds: string[],
): Promise<number> {
  if (notificationIds.length === 0) return 0
  const now = new Date().toISOString()
  const { data, error } = await operatorNotificationsTable(admin)
    .update({ dismissed_at: now, acknowledged_at: now })
    .in("id", notificationIds)
    .is("dismissed_at", null)
    .select("id")

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function deleteNotificationsByIds(
  admin: SupabaseClient,
  notificationIds: string[],
): Promise<number> {
  if (notificationIds.length === 0) return 0
  const { data, error } = await operatorNotificationsTable(admin)
    .delete()
    .in("id", notificationIds)
    .select("id")

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export { isUnreadRow as isGrowthOperatorNotificationUnread }
