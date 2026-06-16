/** SN-8 — Growth operator browser push types (client-safe where noted). */

export const GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER =
  "growth-notification-push-sn8-v1" as const

export const GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION =
  "20270827120300_growth_operator_notification_push_sn8.sql" as const

export const GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH =
  "/growth-operator-notification-sw.js" as const

export type GrowthOperatorNotificationPushDeliveryStatus = "sent" | "failed" | "skipped"

export type GrowthOperatorNotificationPushSubscriptionRecord = {
  id: string
  userId: string
  endpoint: string
  subscriptionJson: Record<string, unknown>
  userAgent: string | null
  enabled: boolean
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

/** Safe browser push payload — no PII, no raw notification payload JSON. */
export type GrowthOperatorNotificationPushPayload = {
  notificationId: string
  eventType: string
  severity: string
  title: string
  body: string
  targetRoute: string
}

export type GrowthOperatorNotificationPushStatus = {
  supported: boolean
  permission: NotificationPermission | "unsupported"
  enabled: boolean
  subscriptionCount: number
  vapidPublicKey: string | null
}
