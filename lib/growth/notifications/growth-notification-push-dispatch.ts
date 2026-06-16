import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationRecord } from "@/lib/growth/notifications/growth-notification-persistence-types"
import {
  assertGrowthOperatorNotificationPushPayloadSafe,
  buildGrowthOperatorNotificationPushPayload,
} from "@/lib/growth/notifications/growth-notification-push-payload"
import {
  deleteGrowthOperatorNotificationPushSubscriptionById,
  getGrowthOperatorNotificationById,
  listEnabledGrowthOperatorNotificationPushSubscriptionsForUser,
  listUndeliveredGrowthOperatorNotificationIds,
  recordGrowthOperatorNotificationPushDelivery,
} from "@/lib/growth/notifications/growth-notification-push-repository"
import { sendGrowthOperatorNotificationBrowserPush } from "@/lib/growth/notifications/growth-notification-push-sender"
import { GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER } from "@/lib/growth/notifications/growth-notification-push-types"
import { configureGrowthOperatorWebPush } from "@/lib/growth/notifications/growth-notification-push-vapid"
import { isNotificationAllowedByUserPreferences } from "@/lib/growth/notifications/growth-notification-preferences-repository"

export type GrowthOperatorNotificationPushDispatchResult = {
  qa_marker: typeof GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER
  notificationId: string
  attempted: number
  sent: number
  failed: number
  skipped: number
}

function isEligibleForPush(record: GrowthOperatorNotificationRecord): boolean {
  if (!record.recipientUserId) return false
  if (record.dismissedAt || record.acknowledgedAt) return false
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) return false
  return true
}

export async function dispatchGrowthOperatorNotificationPushForNotification(
  admin: SupabaseClient,
  notification: GrowthOperatorNotificationRecord,
): Promise<GrowthOperatorNotificationPushDispatchResult> {
  const result: GrowthOperatorNotificationPushDispatchResult = {
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
    notificationId: notification.id,
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  if (!configureGrowthOperatorWebPush()) {
    result.skipped += 1
    return result
  }

  if (!isEligibleForPush(notification)) {
    result.skipped += 1
    return result
  }

  const pushAllowed = await isNotificationAllowedByUserPreferences(admin, {
    userId: notification.recipientUserId!,
    eventType: notification.eventType,
    severity: notification.severity,
    channel: "browser_push",
  })
  if (!pushAllowed) {
    result.skipped += 1
    return result
  }

  const subscriptions = await listEnabledGrowthOperatorNotificationPushSubscriptionsForUser(
    admin,
    notification.recipientUserId!,
  )

  if (subscriptions.length === 0) {
    result.skipped += 1
    return result
  }

  const payload = buildGrowthOperatorNotificationPushPayload(notification)
  assertGrowthOperatorNotificationPushPayloadSafe(payload)

  for (const subscription of subscriptions) {
    result.attempted += 1
    const sendResult = await sendGrowthOperatorNotificationBrowserPush(
      subscription.subscriptionJson,
      payload,
    )

    if (sendResult.ok) {
      result.sent += 1
      await recordGrowthOperatorNotificationPushDelivery(admin, {
        notificationId: notification.id,
        subscriptionId: subscription.id,
        status: "sent",
      })
      continue
    }

    result.failed += 1
    await recordGrowthOperatorNotificationPushDelivery(admin, {
      notificationId: notification.id,
      subscriptionId: subscription.id,
      status: "failed",
      errorMessage: sendResult.error,
    })

    if (sendResult.staleSubscription) {
      await deleteGrowthOperatorNotificationPushSubscriptionById(admin, subscription.id)
    }
  }

  return result
}

export async function dispatchGrowthOperatorNotificationPushSafely(
  admin: SupabaseClient,
  notification: GrowthOperatorNotificationRecord,
): Promise<void> {
  await dispatchGrowthOperatorNotificationPushForNotification(admin, notification).catch(() => undefined)
}

export async function dispatchPendingGrowthOperatorNotificationPush(
  admin: SupabaseClient,
  input: { recipientUserId: string; limit?: number },
): Promise<GrowthOperatorNotificationPushDispatchResult[]> {
  const undeliveredIds = await listUndeliveredGrowthOperatorNotificationIds(admin, input)
  const results: GrowthOperatorNotificationPushDispatchResult[] = []

  for (const notificationId of undeliveredIds) {
    const notification = await getGrowthOperatorNotificationById(admin, notificationId)
    if (!notification) continue
    results.push(await dispatchGrowthOperatorNotificationPushForNotification(admin, notification))
  }

  return results
}

export async function dispatchPendingGrowthOperatorNotificationPushSafely(
  admin: SupabaseClient,
  input: { recipientUserId: string; limit?: number },
): Promise<void> {
  await dispatchPendingGrowthOperatorNotificationPush(admin, input).catch(() => undefined)
}
