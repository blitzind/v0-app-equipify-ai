/** SN-2 — operator notification persistence types (client-safe). */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationRecipientRole } from "@/lib/growth/notifications/growth-notification-routing"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

export const GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER =
  "growth-operator-notifications-sn2-v1" as const

export const GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION =
  "20270827120200_growth_operator_notifications_sn2.sql" as const

export const GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER =
  "growth-notification-center-sn7-v1" as const

export type GrowthOperatorNotificationRecord = {
  id: string
  organizationId: string | null
  eventType: GrowthOperatorNotificationEvent
  severity: GrowthOperatorNotificationSeverity
  recipientRole: GrowthOperatorNotificationRecipientRole
  recipientUserId: string | null
  dedupeKey: string
  title: string
  body: string
  payload: Record<string, unknown>
  targetEntityType: string | null
  targetEntityId: string | null
  acknowledgedAt: string | null
  dismissedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOperatorNotificationCreateInput = {
  organizationId?: string | null
  eventType: GrowthOperatorNotificationEvent
  severity: GrowthOperatorNotificationSeverity
  recipientRole: GrowthOperatorNotificationRecipientRole
  recipientUserId?: string | null
  dedupeKey: string
  title: string
  body: string
  payload?: Record<string, unknown>
  targetEntityType?: string | null
  targetEntityId?: string | null
  expiresAt?: string | null
}

export type GrowthOperatorNotificationListStatus = "unread" | "acknowledged" | "dismissed" | "all"

export type GrowthOperatorNotificationListInput = {
  organizationId?: string | null
  recipientUserId?: string | null
  recipientRole?: GrowthOperatorNotificationRecipientRole
  eventType?: GrowthOperatorNotificationEvent
  severity?: GrowthOperatorNotificationSeverity
  status?: GrowthOperatorNotificationListStatus
  unreadOnly?: boolean
  includeDismissed?: boolean
  includePlatformAdminPool?: boolean
  limit?: number
  offset?: number
}

export type GrowthOperatorNotificationListResult = {
  items: GrowthOperatorNotificationRecord[]
  total: number
  hasMore: boolean
}

export type GrowthOperatorNotificationUnreadCounts = {
  unreadTotal: number
  unreadCritical: number
  unreadHigh: number
  unreadMedium: number
  unreadLow: number
}
