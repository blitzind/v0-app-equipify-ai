import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import {
  WORKSPACE_ALERT_TYPES,
  getWorkspaceAlertEntry,
  isWorkspaceAlertType,
  type WorkspaceAlertType,
} from "@/lib/notifications/workspace-alert-registry"
import { DEFAULT_DIGEST_TIME_LOCAL, normalizeLocalHm } from "@/lib/notifications/notification-time-local"

export type NotificationPreferenceDto = {
  alertType: WorkspaceAlertType
  inAppEnabled: boolean
  emailEnabled: boolean
  /** SMS delivery is not wired yet; always false in API responses and persisted rows. */
  smsEnabled: boolean
}

export type DigestSettingsDto = {
  digestEnabled: boolean
  digestFrequency: "daily" | "weekly"
  digestTimeLocal: string
  quietHoursEnabled: boolean
  quietHoursStartLocal: string | null
  quietHoursEndLocal: string | null
}

export type OrganizationNotificationSettingsBundle = {
  preferences: NotificationPreferenceDto[]
  digest: DigestSettingsDto
}

/** True when both notification tables are available for read/write (false if migration not applied or schema drift). */
export type FetchNotificationSettingsBundleResult = {
  data: OrganizationNotificationSettingsBundle | null
  error: Error | null
  persistenceReady: boolean
}

export function looksLikeMissingNotificationTablesError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = String(err.message ?? "").toLowerCase()
  const code = String(err.code ?? "")
  if (code === "42P01" || code === "PGRST205" || code === "42703") return true
  if (m.includes("schema cache") && m.includes("could not find")) return true
  if (m.includes("does not exist") && (m.includes("relation") || m.includes("column"))) return true
  if (
    m.includes("organization_notification_preferences") ||
    m.includes("organization_notification_digest")
  ) {
    return m.includes("does not exist") || m.includes("could not find")
  }
  return false
}

export function defaultNotificationSettingsBundle(): OrganizationNotificationSettingsBundle {
  return {
    preferences: mergePreferenceDtos(null),
    digest: normalizeDigestRow(null),
  }
}

function defaultPreferenceDto(alertType: WorkspaceAlertType): NotificationPreferenceDto {
  const e = getWorkspaceAlertEntry(alertType)
  return {
    alertType,
    inAppEnabled: e.defaultInApp,
    emailEnabled: e.defaultEmail,
    smsEnabled: false,
  }
}

export function mergePreferenceDtos(
  rows: { alert_type: string; in_app_enabled: boolean; email_enabled: boolean; sms_enabled: boolean }[] | null,
): NotificationPreferenceDto[] {
  const byType = new Map<WorkspaceAlertType, NotificationPreferenceDto>()
  for (const t of WORKSPACE_ALERT_TYPES) {
    byType.set(t, defaultPreferenceDto(t))
  }
  for (const r of rows ?? []) {
    if (!isWorkspaceAlertType(r.alert_type)) continue
    byType.set(r.alert_type, {
      alertType: r.alert_type,
      inAppEnabled: Boolean(r.in_app_enabled),
      emailEnabled: Boolean(r.email_enabled),
      smsEnabled: false,
    })
  }
  return WORKSPACE_ALERT_TYPES.map((t) => byType.get(t)!)
}

type DigestRow = {
  digest_enabled: boolean
  digest_frequency: string
  digest_time_local: string
  quiet_hours_enabled: boolean
  quiet_hours_start_local: string | null
  quiet_hours_end_local: string | null
}

export function normalizeDigestRow(row: DigestRow | null): DigestSettingsDto {
  if (!row) {
    return {
      digestEnabled: false,
      digestFrequency: "daily",
      digestTimeLocal: DEFAULT_DIGEST_TIME_LOCAL,
      quietHoursEnabled: false,
      quietHoursStartLocal: null,
      quietHoursEndLocal: null,
    }
  }
  const freq = row.digest_frequency === "weekly" ? "weekly" : "daily"
  const digestTimeLocal = normalizeLocalHm(row.digest_time_local, DEFAULT_DIGEST_TIME_LOCAL)
  const qh = Boolean(row.quiet_hours_enabled)
  return {
    digestEnabled: Boolean(row.digest_enabled),
    digestFrequency: freq,
    digestTimeLocal,
    quietHoursEnabled: qh,
    quietHoursStartLocal: qh ? normalizeLocalHm(row.quiet_hours_start_local, "22:00") : null,
    quietHoursEndLocal: qh ? normalizeLocalHm(row.quiet_hours_end_local, "07:00") : null,
  }
}

export async function fetchOrganizationNotificationSettingsBundle(
  client: SupabaseClient,
  organizationId: string,
): Promise<FetchNotificationSettingsBundleResult> {
  const [prefsRes, digestRes] = await Promise.all([
    client
      .from("organization_notification_preferences")
      .select("alert_type, in_app_enabled, email_enabled, sms_enabled")
      .eq("organization_id", organizationId),
    client
      .from("organization_notification_digest_settings")
      .select(
        "digest_enabled, digest_frequency, digest_time_local, quiet_hours_enabled, quiet_hours_start_local, quiet_hours_end_local",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ])

  let persistenceReady = true
  let prefsRows: { alert_type: string; in_app_enabled: boolean; email_enabled: boolean; sms_enabled: boolean }[] | null =
    null
  let digestRow: DigestRow | null = null

  if (prefsRes.error) {
    if (looksLikeMissingNotificationTablesError(prefsRes.error)) {
      console.warn("[notification-preferences] organization_notification_preferences unavailable; using defaults.", {
        organizationId,
        code: prefsRes.error.code,
      })
      persistenceReady = false
      prefsRows = null
    } else {
      return {
        data: null,
        error: new Error(prefsRes.error.message),
        persistenceReady: false,
      }
    }
  } else {
    prefsRows = prefsRes.data as
      | { alert_type: string; in_app_enabled: boolean; email_enabled: boolean; sms_enabled: boolean }[]
      | null
  }

  if (digestRes.error) {
    if (looksLikeMissingNotificationTablesError(digestRes.error)) {
      console.warn("[notification-preferences] organization_notification_digest_settings unavailable; using defaults.", {
        organizationId,
        code: digestRes.error.code,
      })
      persistenceReady = false
      digestRow = null
    } else {
      return {
        data: null,
        error: new Error(digestRes.error.message),
        persistenceReady: false,
      }
    }
  } else {
    digestRow = digestRes.data as DigestRow | null
  }

  return {
    data: {
      preferences: mergePreferenceDtos(prefsRows),
      digest: normalizeDigestRow(digestRow),
    },
    error: null,
    persistenceReady,
  }
}

export async function upsertOrganizationNotificationPreferences(
  svc: SupabaseClient,
  organizationId: string,
  preferences: NotificationPreferenceDto[],
): Promise<{ error: PostgrestError | null }> {
  const rows = preferences.map((p) => ({
    organization_id: organizationId,
    alert_type: p.alertType,
    in_app_enabled: p.inAppEnabled,
    email_enabled: p.emailEnabled,
    sms_enabled: false,
  }))
  const { error } = await svc.from("organization_notification_preferences").upsert(rows, {
    onConflict: "organization_id,alert_type",
  })
  return { error }
}

export async function upsertOrganizationDigestSettings(
  svc: SupabaseClient,
  organizationId: string,
  digest: DigestSettingsDto,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await svc.from("organization_notification_digest_settings").upsert(
    {
      organization_id: organizationId,
      digest_enabled: digest.digestEnabled,
      digest_frequency: digest.digestFrequency,
      digest_time_local: digest.digestTimeLocal,
      quiet_hours_enabled: digest.quietHoursEnabled,
      quiet_hours_start_local: digest.quietHoursEnabled ? digest.quietHoursStartLocal : null,
      quiet_hours_end_local: digest.quietHoursEnabled ? digest.quietHoursEndLocal : null,
    },
    { onConflict: "organization_id" },
  )
  return { error }
}
