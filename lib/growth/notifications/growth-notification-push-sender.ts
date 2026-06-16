import "server-only"

import webpush from "web-push"
import type { GrowthOperatorNotificationPushPayload } from "@/lib/growth/notifications/growth-notification-push-types"
import { configureGrowthOperatorWebPush } from "@/lib/growth/notifications/growth-notification-push-vapid"

export type GrowthOperatorNotificationPushSendResult =
  | { ok: true }
  | { ok: false; error: string; staleSubscription?: boolean }

export async function sendGrowthOperatorNotificationBrowserPush(
  subscriptionJson: Record<string, unknown>,
  payload: GrowthOperatorNotificationPushPayload,
): Promise<GrowthOperatorNotificationPushSendResult> {
  const vapid = configureGrowthOperatorWebPush()
  if (!vapid) {
    return { ok: false, error: "vapid_not_configured" }
  }

  try {
    await webpush.sendNotification(
      subscriptionJson as webpush.PushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
        urgency: payload.severity === "critical" || payload.severity === "high" ? "high" : "normal",
      },
    )
    return { ok: true }
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null
    const message = error instanceof Error ? error.message : "push_send_failed"
    const staleSubscription = statusCode === 404 || statusCode === 410
    return { ok: false, error: message, staleSubscription }
  }
}
