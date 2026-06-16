/** SN-9 — pure preference resolution and eligibility checks (client-safe). */

import {
  isGrowthOperatorNotificationEvent,
  type GrowthOperatorNotificationEvent,
} from "@/lib/growth/notifications/growth-notification-events"
import {
  DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES,
  type GrowthOperatorNotificationEffectivePreferences,
  type GrowthOperatorNotificationPreferenceChannel,
  type GrowthOperatorNotificationPreferencesRecord,
} from "@/lib/growth/notifications/growth-notification-preferences-types"
import {
  GROWTH_OPERATOR_NOTIFICATION_SEVERITIES,
  type GrowthOperatorNotificationSeverity,
} from "@/lib/growth/notifications/growth-notification-severity"

const SEVERITY_RANK: Record<GrowthOperatorNotificationSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function meetsGrowthOperatorNotificationMinimumSeverity(
  severity: GrowthOperatorNotificationSeverity,
  minimumSeverity: GrowthOperatorNotificationSeverity,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimumSeverity]
}

export function normalizeGrowthOperatorNotificationDisabledEventTypes(
  values: readonly string[],
): GrowthOperatorNotificationEvent[] {
  const seen = new Set<GrowthOperatorNotificationEvent>()
  const normalized: GrowthOperatorNotificationEvent[] = []
  for (const value of values) {
    if (!isGrowthOperatorNotificationEvent(value) || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}

export function resolveEffectiveGrowthOperatorNotificationPreferences(
  record: GrowthOperatorNotificationPreferencesRecord | null,
): GrowthOperatorNotificationEffectivePreferences {
  if (!record) return { ...DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES }

  return {
    inAppEnabled: record.inAppEnabled,
    browserPushEnabled: record.browserPushEnabled,
    minimumSeverity: record.minimumSeverity,
    disabledEventTypes: [...record.disabledEventTypes],
    quietHoursEnabled: record.quietHoursEnabled,
    quietHoursStart: record.quietHoursStart,
    quietHoursEnd: record.quietHoursEnd,
    quietHoursTimezone: record.quietHoursTimezone,
  }
}

function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatGrowthOperatorNotificationQuietHoursTime(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (TIME_PATTERN.test(trimmed)) return trimmed
  const match = /^(\d{2}):(\d{2}):(\d{2})/.exec(trimmed)
  if (match) return `${match[1]}:${match[2]}`
  return null
}

export function isWithinGrowthOperatorNotificationQuietHours(
  preferences: GrowthOperatorNotificationEffectivePreferences,
  at: Date = new Date(),
): boolean {
  if (!preferences.quietHoursEnabled) return false

  const start = formatGrowthOperatorNotificationQuietHoursTime(preferences.quietHoursStart)
  const end = formatGrowthOperatorNotificationQuietHoursTime(preferences.quietHoursEnd)
  const timezone = preferences.quietHoursTimezone?.trim()
  if (!start || !end || !timezone) return false

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(at)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  const currentMinutes = hour * 60 + minute

  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)
  if (startMinutes == null || endMinutes == null) return false

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export function isNotificationAllowedByPreferences(input: {
  preferences: GrowthOperatorNotificationEffectivePreferences
  eventType: GrowthOperatorNotificationEvent
  severity: GrowthOperatorNotificationSeverity
  channel: GrowthOperatorNotificationPreferenceChannel
  at?: Date
}): boolean {
  const { preferences, eventType, severity, channel, at } = input

  if (preferences.disabledEventTypes.includes(eventType)) return false
  if (!meetsGrowthOperatorNotificationMinimumSeverity(severity, preferences.minimumSeverity)) {
    return false
  }

  if (channel === "in_app" && !preferences.inAppEnabled) return false
  if (channel === "browser_push" && !preferences.browserPushEnabled) return false
  if (channel === "browser_push" && isWithinGrowthOperatorNotificationQuietHours(preferences, at)) {
    return false
  }

  return true
}

export function isGrowthOperatorNotificationSeverity(value: string): value is GrowthOperatorNotificationSeverity {
  return (GROWTH_OPERATOR_NOTIFICATION_SEVERITIES as readonly string[]).includes(value)
}
