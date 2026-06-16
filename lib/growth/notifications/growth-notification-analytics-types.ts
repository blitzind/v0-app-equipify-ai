/** SN-10 — operator notification analytics types (client-safe). */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

export const GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER =
  "growth-notification-analytics-sn10-v1" as const

export const GROWTH_NOTIFICATIONS_E2E_QA_MARKER = "growth-notifications-e2e-sn10-v1" as const

export type GrowthOperatorNotificationAnalyticsCount = {
  key: string
  count: number
}

export type GrowthOperatorNotificationAnalyticsUnreadPoint = {
  date: string
  unread: number
}

export type GrowthOperatorNotificationAnalyticsResponseTiming = {
  sampleSize: number
  medianMs: number | null
  p90Ms: number | null
  averageMs: number | null
}

export type GrowthOperatorNotificationAnalyticsSnapshot = {
  qa_marker: typeof GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER
  windowDays: number
  generatedAt: string
  totals: {
    total: number
    unread: number
    criticalHigh: number
    acknowledged: number
    dismissed: number
  }
  volumeByEventType: GrowthOperatorNotificationAnalyticsCount[]
  volumeBySeverity: GrowthOperatorNotificationAnalyticsCount[]
  unreadOverTime: GrowthOperatorNotificationAnalyticsUnreadPoint[]
  rates: {
    acknowledgeRate: number
    dismissRate: number
  }
  push: {
    attempted: number
    sent: number
    failed: number
    skipped: number
  }
  topSources: GrowthOperatorNotificationAnalyticsCount[]
  topEventTypes: GrowthOperatorNotificationAnalyticsCount[]
  responseTiming: GrowthOperatorNotificationAnalyticsResponseTiming
}

export type GrowthOperatorNotificationDigestItem = {
  notificationId: string
  eventType: GrowthOperatorNotificationEvent
  severity: GrowthOperatorNotificationSeverity
  title: string
  body: string
  targetRoute: string
  createdAt: string
}

export type GrowthOperatorNotificationDigestPreview = {
  qa_marker: typeof GROWTH_NOTIFICATIONS_E2E_QA_MARKER
  kind: "daily" | "critical"
  generatedAt: string
  itemCount: number
  summary: string
  items: GrowthOperatorNotificationDigestItem[]
}
