/** Client-safe IANA timezone helpers for booking pages. */

import { isValidGrowthCalendarTimezone } from "@/lib/growth/calendar/calendar-timezone"

export const BOOKING_TIMEZONE_MODES = ["fixed_host", "visitor_local", "visitor_override"] as const
export type GrowthBookingTimezoneMode = (typeof BOOKING_TIMEZONE_MODES)[number]

export const BOOKING_SCHEDULING_HORIZON_PRESETS = [30, 60, 90, 180, 365] as const
export type GrowthBookingSchedulingHorizonPreset = (typeof BOOKING_SCHEDULING_HORIZON_PRESETS)[number]

export const BOOKING_COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
] as const

export function listBookingIanaTimezones(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      return [...Intl.supportedValuesOf("timeZone")].sort()
    } catch {
      // fall through
    }
  }
  return [...BOOKING_COMMON_TIMEZONES]
}

export function resolveBookingTimezone(value: string | null | undefined, fallback = "UTC"): string {
  const candidate = value?.trim()
  if (candidate && isValidGrowthCalendarTimezone(candidate)) return candidate
  if (isValidGrowthCalendarTimezone(fallback)) return fallback
  return "UTC"
}

export function formatDateKeyInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveBookingTimezone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatUtcOffsetLabel(timeZone: string, referenceDate = new Date()): string {
  const tz = resolveBookingTimezone(timeZone)
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(referenceDate)
    const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "UTC"
    return raw.replace("GMT", "UTC")
  } catch {
    return "UTC"
  }
}

export function formatFriendlyTimezoneName(timeZone: string): string {
  const segments = timeZone.split("/")
  const city = segments[segments.length - 1]?.replace(/_/g, " ") ?? timeZone
  if (timeZone.startsWith("America/")) {
    if (timeZone === "America/New_York") return "Eastern Time"
    if (timeZone === "America/Chicago") return "Central Time"
    if (timeZone === "America/Denver") return "Mountain Time"
    if (timeZone === "America/Los_Angeles") return "Pacific Time"
  }
  return city
}

export function formatIanaTimezoneOption(timeZone: string, referenceDate = new Date()): string {
  const safe = resolveBookingTimezone(timeZone)
  const offset = formatUtcOffsetLabel(safe, referenceDate)
  const friendly = formatFriendlyTimezoneName(safe)
  return `(${offset}) ${friendly} — ${safe}`
}

export function zonedLocalToUtc(input: {
  dateKey: string
  hour: number
  minute: number
  timeZone: string
}): Date {
  const timeZone = resolveBookingTimezone(input.timeZone)
  const [year, month, day] = input.dateKey.split("-").map(Number)
  let candidate = new Date(Date.UTC(year, month - 1, day, input.hour, input.minute, 0, 0))
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
    )
    const currentMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    )
    const targetMs = Date.UTC(year, month - 1, day, input.hour, input.minute)
    const diffMs = targetMs - currentMs
    if (diffMs === 0) break
    candidate = new Date(candidate.getTime() + diffMs)
  }

  return candidate
}

export function addDaysToDateKey(dateKey: string, days: number, timeZone: string): string {
  const anchor = zonedLocalToUtc({ dateKey, hour: 12, minute: 0, timeZone })
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000)
  return formatDateKeyInTimezone(shifted, timeZone)
}

export function iterateDateKeys(fromKey: string, toKey: string, timeZone: string): string[] {
  if (fromKey > toKey) return []
  const keys: string[] = []
  let current = fromKey
  while (current <= toKey) {
    keys.push(current)
    if (keys.length > 400) break
    current = addDaysToDateKey(current, 1, timeZone)
  }
  return keys
}

export function monthRangeKeys(monthKey: string): { startKey: string; endKey: string } | null {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null
  const [year, month] = monthKey.split("-").map(Number)
  const startKey = `${monthKey}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endKey = addDaysToDateKey(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`, -1, "UTC")
  return { startKey, endKey: endKey.startsWith(monthKey) ? endKey : `${monthKey}-${String(daysInMonth(year, month)).padStart(2, "0")}` }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function monthRangeInTimezone(
  monthKey: string,
  timeZone: string,
): { rangeStart: Date; rangeEnd: Date; startKey: string; endKey: string } | null {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null
  const [year, month] = monthKey.split("-").map(Number)
  const startKey = `${monthKey}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`
  const endKey = addDaysToDateKey(`${nextMonthKey}-01`, -1, timeZone)
  return {
    startKey,
    endKey,
    rangeStart: zonedLocalToUtc({ dateKey: startKey, hour: 0, minute: 0, timeZone }),
    rangeEnd: zonedLocalToUtc({ dateKey: nextMonthKey, hour: 0, minute: 0, timeZone }),
  }
}

export function computeBookingHorizonEnd(now: Date, horizonDays: number): Date {
  return new Date(now.getTime() + Math.max(1, horizonDays) * 24 * 60 * 60 * 1000)
}

export function resolveBookingDisplayTimezone(input: {
  timezoneMode: GrowthBookingTimezoneMode
  hostTimezone: string
  visitorTimezone: string
  storedVisitorTimezone?: string | null
}): string {
  if (input.timezoneMode === "fixed_host") return resolveBookingTimezone(input.hostTimezone)
  const visitor = resolveBookingTimezone(input.storedVisitorTimezone ?? input.visitorTimezone, input.hostTimezone)
  return visitor
}

export function bookingTimezoneStorageKey(slug: string): string {
  return `equipify-booking-timezone:${slug}`
}

export function readStoredBookingTimezone(slug: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  try {
    const stored = window.localStorage.getItem(bookingTimezoneStorageKey(slug))
    if (stored && isValidGrowthCalendarTimezone(stored)) return stored
  } catch {
    // ignore
  }
  return fallback
}

export function writeStoredBookingTimezone(slug: string, timeZone: string): void {
  if (typeof window === "undefined") return
  if (!isValidGrowthCalendarTimezone(timeZone)) return
  try {
    window.localStorage.setItem(bookingTimezoneStorageKey(slug), timeZone)
  } catch {
    // ignore
  }
}
