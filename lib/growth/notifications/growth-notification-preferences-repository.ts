import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  formatGrowthOperatorNotificationQuietHoursTime,
  normalizeGrowthOperatorNotificationDisabledEventTypes,
  resolveEffectiveGrowthOperatorNotificationPreferences,
} from "@/lib/growth/notifications/growth-notification-preferences-utils"
import {
  type GrowthOperatorNotificationEffectivePreferences,
  type GrowthOperatorNotificationPreferenceChannel,
  type GrowthOperatorNotificationPreferencesRecord,
  type GrowthOperatorNotificationPreferencesUpsertInput,
} from "@/lib/growth/notifications/growth-notification-preferences-types"
import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"
import { isNotificationAllowedByPreferences } from "@/lib/growth/notifications/growth-notification-preferences-utils"

const SELECT =
  "id, organization_id, user_id, in_app_enabled, browser_push_enabled, email_notifications_enabled, minimum_severity, disabled_event_types, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, created_at, updated_at"

type PreferencesRow = {
  id: string
  organization_id: string | null
  user_id: string
  in_app_enabled: boolean
  browser_push_enabled: boolean
  email_notifications_enabled: boolean
  minimum_severity: string
  disabled_event_types: string[] | null
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_timezone: string | null
  created_at: string
  updated_at: string
}

function preferencesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notification_preferences")
}

function mapRow(row: PreferencesRow): GrowthOperatorNotificationPreferencesRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    inAppEnabled: row.in_app_enabled,
    browserPushEnabled: row.browser_push_enabled,
    emailNotificationsEnabled: row.email_notifications_enabled,
    minimumSeverity: row.minimum_severity as GrowthOperatorNotificationSeverity,
    disabledEventTypes: normalizeGrowthOperatorNotificationDisabledEventTypes(row.disabled_event_types ?? []),
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: formatGrowthOperatorNotificationQuietHoursTime(row.quiet_hours_start),
    quietHoursEnd: formatGrowthOperatorNotificationQuietHoursTime(row.quiet_hours_end),
    quietHoursTimezone: row.quiet_hours_timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getPreferencesForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthOperatorNotificationPreferencesRecord | null> {
  const { data, error } = await preferencesTable(admin).select(SELECT).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as PreferencesRow)
}

export async function upsertPreferencesForUser(
  admin: SupabaseClient,
  userId: string,
  input: GrowthOperatorNotificationPreferencesUpsertInput,
): Promise<GrowthOperatorNotificationPreferencesRecord> {
  const existing = await getPreferencesForUser(admin, userId)

  const payload = {
    organization_id: input.organizationId ?? existing?.organizationId ?? null,
    user_id: userId,
    in_app_enabled: input.inAppEnabled ?? existing?.inAppEnabled ?? true,
    browser_push_enabled: input.browserPushEnabled ?? existing?.browserPushEnabled ?? true,
    email_notifications_enabled:
      input.emailNotificationsEnabled ?? existing?.emailNotificationsEnabled ?? true,
    minimum_severity: input.minimumSeverity ?? existing?.minimumSeverity ?? "low",
    disabled_event_types: normalizeGrowthOperatorNotificationDisabledEventTypes(
      input.disabledEventTypes ?? existing?.disabledEventTypes ?? [],
    ),
    quiet_hours_enabled: input.quietHoursEnabled ?? existing?.quietHoursEnabled ?? false,
    quiet_hours_start:
      input.quietHoursStart !== undefined
        ? input.quietHoursStart
        : (existing?.quietHoursStart ?? null),
    quiet_hours_end:
      input.quietHoursEnd !== undefined ? input.quietHoursEnd : (existing?.quietHoursEnd ?? null),
    quiet_hours_timezone:
      input.quietHoursTimezone !== undefined
        ? input.quietHoursTimezone
        : (existing?.quietHoursTimezone ?? null),
  }

  const { data, error } = await preferencesTable(admin)
    .upsert(payload, { onConflict: "user_id" })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as PreferencesRow)
}

export async function resolveEffectivePreferences(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthOperatorNotificationEffectivePreferences> {
  const record = await getPreferencesForUser(admin, userId)
  return resolveEffectiveGrowthOperatorNotificationPreferences(record)
}

export async function isNotificationAllowedByUserPreferences(
  admin: SupabaseClient,
  input: {
    userId: string
    eventType: GrowthOperatorNotificationEvent
    severity: GrowthOperatorNotificationSeverity
    channel: GrowthOperatorNotificationPreferenceChannel
    at?: Date
  },
): Promise<boolean> {
  const preferences = await resolveEffectivePreferences(admin, input.userId)
  return isNotificationAllowedByPreferences({
    preferences,
    eventType: input.eventType,
    severity: input.severity,
    channel: input.channel,
    at: input.at,
  })
}

export async function deletePreferencesByIds(admin: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await preferencesTable(admin).delete().in("id", ids)
  if (error) throw new Error(error.message)
}

export { isNotificationAllowedByPreferences } from "@/lib/growth/notifications/growth-notification-preferences-utils"
