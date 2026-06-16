import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOperatorNotificationPushDeliveryStatus,
  GrowthOperatorNotificationPushSubscriptionRecord,
} from "@/lib/growth/notifications/growth-notification-push-types"

type SubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  subscription_json: Record<string, unknown> | null
  user_agent: string | null
  enabled: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
}

function subscriptionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notification_push_subscriptions")
}

function deliveriesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notification_push_deliveries")
}

function mapSubscription(row: SubscriptionRow): GrowthOperatorNotificationPushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    subscriptionJson: row.subscription_json ?? {},
    userAgent: row.user_agent,
    enabled: row.enabled,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertGrowthOperatorNotificationPushSubscription(
  admin: SupabaseClient,
  input: {
    userId: string
    endpoint: string
    subscriptionJson: Record<string, unknown>
    userAgent?: string | null
  },
): Promise<GrowthOperatorNotificationPushSubscriptionRecord> {
  const now = new Date().toISOString()
  const { data, error } = await subscriptionsTable(admin)
    .upsert(
      {
        user_id: input.userId,
        endpoint: input.endpoint,
        subscription_json: input.subscriptionJson,
        user_agent: input.userAgent ?? null,
        enabled: true,
        last_seen_at: now,
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapSubscription(data as SubscriptionRow)
}

export async function disableGrowthOperatorNotificationPushSubscription(
  admin: SupabaseClient,
  input: { userId: string; endpoint: string },
): Promise<void> {
  const { error } = await subscriptionsTable(admin)
    .update({ enabled: false })
    .eq("user_id", input.userId)
    .eq("endpoint", input.endpoint)

  if (error) throw new Error(error.message)
}

export async function listEnabledGrowthOperatorNotificationPushSubscriptionsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthOperatorNotificationPushSubscriptionRecord[]> {
  const { data, error } = await subscriptionsTable(admin)
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("last_seen_at", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as SubscriptionRow[]).map(mapSubscription)
}

export async function countEnabledGrowthOperatorNotificationPushSubscriptions(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await subscriptionsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("enabled", true)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function deleteGrowthOperatorNotificationPushSubscriptionById(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<void> {
  const { error } = await subscriptionsTable(admin).delete().eq("id", subscriptionId)
  if (error) throw new Error(error.message)
}

export async function recordGrowthOperatorNotificationPushDelivery(
  admin: SupabaseClient,
  input: {
    notificationId: string
    subscriptionId: string
    status: GrowthOperatorNotificationPushDeliveryStatus
    errorMessage?: string | null
  },
): Promise<void> {
  const { error } = await deliveriesTable(admin).upsert(
    {
      notification_id: input.notificationId,
      subscription_id: input.subscriptionId,
      status: input.status,
      error_message: input.errorMessage ?? null,
      attempted_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,subscription_id" },
  )

  if (error) throw new Error(error.message)
}

export async function listUndeliveredGrowthOperatorNotificationIds(
  admin: SupabaseClient,
  input: { recipientUserId: string; limit?: number },
): Promise<string[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const now = new Date().toISOString()

  const { data: notifications, error } = await admin
    .schema("growth")
    .from("operator_notifications")
    .select("id")
    .eq("recipient_user_id", input.recipientUserId)
    .is("dismissed_at", null)
    .is("acknowledged_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const ids = (notifications ?? []).map((row) => String((row as { id: string }).id))
  if (ids.length === 0) return []

  const { data: deliveries, error: deliveryError } = await deliveriesTable(admin)
    .select("notification_id")
    .in("notification_id", ids)
    .eq("status", "sent")

  if (deliveryError) throw new Error(deliveryError.message)

  const sentIds = new Set((deliveries ?? []).map((row) => String((row as { notification_id: string }).notification_id)))
  return ids.filter((id) => !sentIds.has(id))
}

export async function getGrowthOperatorNotificationById(
  admin: SupabaseClient,
  notificationId: string,
): Promise<import("@/lib/growth/notifications/growth-notification-persistence-types").GrowthOperatorNotificationRecord | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("operator_notifications")
    .select(
      "id, organization_id, event_type, severity, recipient_role, recipient_user_id, dedupe_key, title, body, payload, target_entity_type, target_entity_id, acknowledged_at, dismissed_at, expires_at, created_at, updated_at",
    )
    .eq("id", notificationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    organizationId: (row.organization_id as string | null) ?? null,
    eventType: row.event_type as import("@/lib/growth/notifications/growth-notification-events").GrowthOperatorNotificationEvent,
    severity: row.severity as import("@/lib/growth/notifications/growth-notification-severity").GrowthOperatorNotificationSeverity,
    recipientRole: row.recipient_role as import("@/lib/growth/notifications/growth-notification-routing").GrowthOperatorNotificationRecipientRole,
    recipientUserId: (row.recipient_user_id as string | null) ?? null,
    dedupeKey: String(row.dedupe_key),
    title: String(row.title),
    body: String(row.body),
    payload: (row.payload as Record<string, unknown>) ?? {},
    targetEntityType: (row.target_entity_type as string | null) ?? null,
    targetEntityId: (row.target_entity_id as string | null) ?? null,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    dismissedAt: (row.dismissed_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function deleteGrowthOperatorNotificationPushDeliveriesByNotificationIds(
  admin: SupabaseClient,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return
  await deliveriesTable(admin).delete().in("notification_id", notificationIds)
}

export async function deleteGrowthOperatorNotificationPushSubscriptionsByIds(
  admin: SupabaseClient,
  subscriptionIds: string[],
): Promise<void> {
  if (subscriptionIds.length === 0) return
  await subscriptionsTable(admin).delete().in("id", subscriptionIds)
}
