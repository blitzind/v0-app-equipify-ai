/** SN-9 — operator notification preferences types (client-safe). */

import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"

export const GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER =
  "growth-notification-preferences-sn9-v1" as const

export const GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION =
  "20270827120400_growth_operator_notification_preferences_sn9.sql" as const

export type GrowthOperatorNotificationPreferencesRecord = {
  id: string
  organizationId: string | null
  userId: string
  inAppEnabled: boolean
  browserPushEnabled: boolean
  minimumSeverity: GrowthOperatorNotificationSeverity
  disabledEventTypes: GrowthOperatorNotificationEvent[]
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  quietHoursTimezone: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOperatorNotificationPreferencesUpsertInput = {
  organizationId?: string | null
  inAppEnabled?: boolean
  browserPushEnabled?: boolean
  minimumSeverity?: GrowthOperatorNotificationSeverity
  disabledEventTypes?: GrowthOperatorNotificationEvent[]
  quietHoursEnabled?: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  quietHoursTimezone?: string | null
}

export type GrowthOperatorNotificationEffectivePreferences = {
  inAppEnabled: boolean
  browserPushEnabled: boolean
  minimumSeverity: GrowthOperatorNotificationSeverity
  disabledEventTypes: GrowthOperatorNotificationEvent[]
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  quietHoursTimezone: string | null
}

export type GrowthOperatorNotificationPreferenceChannel = "in_app" | "browser_push"

export const DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES: GrowthOperatorNotificationEffectivePreferences =
  {
    inAppEnabled: true,
    browserPushEnabled: true,
    minimumSeverity: "low",
    disabledEventTypes: [],
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursTimezone: null,
  }
