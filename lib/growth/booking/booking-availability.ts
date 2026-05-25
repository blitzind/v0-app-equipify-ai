import type { GrowthBookingAvailabilityWindow, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import { isValidGrowthCalendarTimezone } from "@/lib/growth/calendar/calendar-timezone"

const DEFAULT_WINDOWS: GrowthBookingAvailabilityWindow[] = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
]

function parseTimeParts(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    dayOfWeek: weekdayMap[lookup.weekday] ?? 0,
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  }
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

function intervalBounds(interval: { start?: string; end?: string; startAt?: string; endAt?: string }) {
  const start = interval.start ?? interval.startAt
  const end = interval.end ?? interval.endAt
  if (!start || !end) return null
  return { startMs: new Date(start).getTime(), endMs: new Date(end).getTime() }
}

export function resolveBookingAvailabilityWindows(
  windows: GrowthBookingAvailabilityWindow[] | null | undefined,
): GrowthBookingAvailabilityWindow[] {
  if (windows && windows.length > 0) return windows
  return DEFAULT_WINDOWS
}

export function buildBookingSlots(input: {
  timezone: string
  durationMinutes: number
  bufferMinutes: number
  availabilityWindows: GrowthBookingAvailabilityWindow[]
  daysAhead?: number
  now?: Date
  busyIntervals?: Array<{ start: string; end: string }>
  existingBookings?: Array<{ startAt: string; endAt: string }>
}): GrowthBookingSlot[] {
  const timezone = isValidGrowthCalendarTimezone(input.timezone) ? input.timezone : "UTC"
  const windows = resolveBookingAvailabilityWindows(input.availabilityWindows)
  const now = input.now ?? new Date()
  const daysAhead = input.daysAhead ?? 14
  const slots: GrowthBookingSlot[] = []
  const durationMs = input.durationMinutes * 60 * 1000
  const bufferMs = input.bufferMinutes * 60 * 1000

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
    const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const parts = zonedParts(day, timezone)
    const dayWindows = windows.filter((window) => window.dayOfWeek === parts.dayOfWeek)
    for (const window of dayWindows) {
      const startParts = parseTimeParts(window.startTime)
      const endParts = parseTimeParts(window.endTime)
      if (!startParts || !endParts) continue

      let cursor = new Date(day)
      cursor.setUTCHours(startParts.hour, startParts.minute, 0, 0)
      const windowEnd = new Date(day)
      windowEnd.setUTCHours(endParts.hour, endParts.minute, 0, 0)

      while (cursor.getTime() + durationMs <= windowEnd.getTime()) {
        const slotStart = new Date(cursor)
        const slotEnd = new Date(cursor.getTime() + durationMs)
        if (slotStart.getTime() > now.getTime() + bufferMs) {
          const blocked = [...(input.busyIntervals ?? []), ...(input.existingBookings ?? [])].some((interval) => {
            const bounds = intervalBounds(interval)
            if (!bounds) return false
            return overlaps(
              slotStart.getTime() - bufferMs,
              slotEnd.getTime() + bufferMs,
              bounds.startMs,
              bounds.endMs,
            )
          })
          if (!blocked) {
            slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() })
          }
        }
        cursor = new Date(cursor.getTime() + durationMs + bufferMs)
      }
    }
  }

  return slots.slice(0, 200)
}

export function isSlotStillAvailable(
  slot: GrowthBookingSlot,
  busyIntervals: Array<{ start: string; end: string }>,
  existingBookings: Array<{ startAt: string; endAt: string }>,
  bufferMinutes: number,
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000
  const startMs = new Date(slot.startAt).getTime() - bufferMs
  const endMs = new Date(slot.endAt).getTime() + bufferMs
  return ![...busyIntervals, ...existingBookings].some((interval) => {
    const bounds = intervalBounds(interval)
    if (!bounds) return false
    return overlaps(startMs, endMs, bounds.startMs, bounds.endMs)
  })
}
