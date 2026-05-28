import type { VoiceBusinessHoursRecord, VoiceBusinessHoursStatus } from "@/lib/voice/types"

export type VoiceWeeklyDaySchedule = {
  closed?: boolean
  open?: string
  close?: string
}

export type VoiceHolidayRule = {
  date?: string
  name?: string
  closed?: boolean
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

function parseTimeToMinutes(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number.parseInt(match[1]!, 10)
  const minutes = Number.parseInt(match[2]!, 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function localParts(now: Date, timezone: string): { dayKey: string; dateKey: string; minutes: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    const weekday = (lookup.weekday ?? "").toLowerCase()
    const dayKey = DAY_KEYS.find((d) => d === weekday) ?? weekday
    const dateKey = `${lookup.year}-${lookup.month}-${lookup.day}`
    const minutes = parseTimeToMinutes(`${lookup.hour}:${lookup.minute}`)
    if (minutes == null) return null
    return { dayKey, dateKey, minutes }
  } catch {
    return null
  }
}

export function evaluateVoiceBusinessHours(
  profile: Pick<
    VoiceBusinessHoursRecord,
    "timezone" | "weeklyScheduleJson" | "holidayRulesJson"
  > | null,
  now: Date = new Date(),
): VoiceBusinessHoursStatus {
  if (!profile) return "unknown"

  const local = localParts(now, profile.timezone)
  if (!local) return "unknown"

  const holidays = Array.isArray(profile.holidayRulesJson) ? profile.holidayRulesJson : []
  for (const raw of holidays) {
    const rule = raw as VoiceHolidayRule
    if (rule.date === local.dateKey && rule.closed !== false) {
      return "holiday"
    }
  }

  const schedule = profile.weeklyScheduleJson ?? {}
  const daySchedule = schedule[local.dayKey] as VoiceWeeklyDaySchedule | undefined
  if (!daySchedule || daySchedule.closed) return "closed"

  const openMinutes = parseTimeToMinutes(daySchedule.open)
  const closeMinutes = parseTimeToMinutes(daySchedule.close)
  if (openMinutes == null || closeMinutes == null) return "unknown"

  if (local.minutes >= openMinutes && local.minutes < closeMinutes) {
    return "open"
  }
  return "closed"
}

export function voiceBusinessHoursStatusLabel(status: VoiceBusinessHoursStatus): string {
  switch (status) {
    case "open":
      return "Open"
    case "closed":
      return "Closed"
    case "holiday":
      return "Holiday"
    default:
      return "Unknown"
  }
}
