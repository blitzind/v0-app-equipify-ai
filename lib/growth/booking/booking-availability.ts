import type { GrowthBookingAvailabilityWindow, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import {
  addDaysToDateKey,
  computeBookingHorizonEnd,
  formatDateKeyInTimezone,
  iterateDateKeys,
  resolveBookingTimezone,
  zonedLocalToUtc,
} from "@/lib/growth/booking/booking-timezone-utils"

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
  })
  const weekday = formatter.format(date)
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dayOfWeek: weekdayMap[weekday] ?? 0 }
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

export function resolveBookingBufferMinutes(input: {
  bufferBeforeMinutes?: number | null
  bufferAfterMinutes?: number | null
  bufferMinutes?: number | null
}): { bufferBeforeMinutes: number; bufferAfterMinutes: number } {
  const legacyAfter = input.bufferMinutes ?? 0
  return {
    bufferBeforeMinutes: Math.max(0, input.bufferBeforeMinutes ?? 0),
    bufferAfterMinutes: Math.max(0, input.bufferAfterMinutes ?? legacyAfter),
  }
}

export function buildBookingSlots(input: {
  timezone: string
  durationMinutes: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  bufferMinutes?: number
  minimumNoticeHours?: number
  maxMeetingsPerDay?: number | null
  schedulingHorizonDays?: number
  availabilityWindows: GrowthBookingAvailabilityWindow[]
  rangeStart?: Date
  rangeEnd?: Date
  now?: Date
  busyIntervals?: Array<{ start: string; end: string }>
  existingBookings?: Array<{ startAt: string; endAt: string }>
  maxSlots?: number
}): GrowthBookingSlot[] {
  const timezone = resolveBookingTimezone(input.timezone)
  const windows = resolveBookingAvailabilityWindows(input.availabilityWindows)
  const now = input.now ?? new Date()
  const horizonDays = Math.max(1, Math.min(730, input.schedulingHorizonDays ?? 90))
  const horizonEnd = computeBookingHorizonEnd(now, horizonDays)
  const { bufferBeforeMinutes, bufferAfterMinutes } = resolveBookingBufferMinutes(input)
  const minimumNoticeMs = Math.max(0, input.minimumNoticeHours ?? 0) * 60 * 60 * 1000
  const earliestBookableMs = now.getTime() + minimumNoticeMs
  const durationMs = input.durationMinutes * 60 * 1000
  const bufferBeforeMs = bufferBeforeMinutes * 60 * 1000
  const bufferAfterMs = bufferAfterMinutes * 60 * 1000
  const slotStepMs = durationMs + bufferAfterMs

  const todayKey = formatDateKeyInTimezone(now, timezone)
  const horizonEndKey = formatDateKeyInTimezone(horizonEnd, timezone)
  const rangeStartKey = input.rangeStart
    ? formatDateKeyInTimezone(input.rangeStart, timezone)
    : todayKey
  const rangeEndKey = input.rangeEnd
    ? formatDateKeyInTimezone(new Date(input.rangeEnd.getTime() - 1), timezone)
    : addDaysToDateKey(todayKey, horizonDays - 1, timezone)

  const fromKey = rangeStartKey > todayKey ? rangeStartKey : todayKey
  const toKey = rangeEndKey < horizonEndKey ? rangeEndKey : horizonEndKey
  if (fromKey > toKey) return []

  const bookingsByDay = new Map<string, number>()
  for (const booking of input.existingBookings ?? []) {
    const key = formatDateKeyInTimezone(new Date(booking.startAt), timezone)
    bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1)
  }

  const slots: GrowthBookingSlot[] = []
  const maxSlots = input.maxSlots ?? 500

  for (const dateKey of iterateDateKeys(fromKey, toKey, timezone)) {
    if (input.maxMeetingsPerDay != null && (bookingsByDay.get(dateKey) ?? 0) >= input.maxMeetingsPerDay) {
      continue
    }

    const dayAnchor = zonedLocalToUtc({ dateKey, hour: 12, minute: 0, timeZone: timezone })
    const dayOfWeek = zonedParts(dayAnchor, timezone).dayOfWeek
    const dayWindows = windows.filter((window) => window.dayOfWeek === dayOfWeek)

    for (const window of dayWindows) {
      const startParts = parseTimeParts(window.startTime)
      const endParts = parseTimeParts(window.endTime)
      if (!startParts || !endParts) continue

      let cursor = zonedLocalToUtc({
        dateKey,
        hour: startParts.hour,
        minute: startParts.minute,
        timeZone: timezone,
      })
      const windowEnd = zonedLocalToUtc({
        dateKey,
        hour: endParts.hour,
        minute: endParts.minute,
        timeZone: timezone,
      })

      while (cursor.getTime() + durationMs <= windowEnd.getTime()) {
        const slotStart = new Date(cursor)
        const slotEnd = new Date(cursor.getTime() + durationMs)

        if (input.rangeStart && slotStart.getTime() < input.rangeStart.getTime()) {
          cursor = new Date(cursor.getTime() + slotStepMs)
          continue
        }
        if (input.rangeEnd && slotStart.getTime() >= input.rangeEnd.getTime()) {
          break
        }
        if (slotStart.getTime() < earliestBookableMs) {
          cursor = new Date(cursor.getTime() + slotStepMs)
          continue
        }
        if (slotEnd.getTime() > horizonEnd.getTime()) {
          break
        }

        const blocked = [...(input.busyIntervals ?? []), ...(input.existingBookings ?? [])].some((interval) => {
          const bounds = intervalBounds(interval)
          if (!bounds) return false
          return overlaps(
            slotStart.getTime() - bufferBeforeMs,
            slotEnd.getTime() + bufferAfterMs,
            bounds.startMs,
            bounds.endMs,
          )
        })

        if (!blocked) {
          slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() })
          if (slots.length >= maxSlots) return slots
        }

        cursor = new Date(cursor.getTime() + slotStepMs)
      }
    }
  }

  return slots
}

export function isSlotStillAvailable(
  slot: GrowthBookingSlot,
  busyIntervals: Array<{ start: string; end: string }>,
  existingBookings: Array<{ startAt: string; endAt: string }>,
  bufferInput: number | { bufferBeforeMinutes?: number; bufferAfterMinutes?: number; bufferMinutes?: number },
): boolean {
  const { bufferBeforeMinutes, bufferAfterMinutes } =
    typeof bufferInput === "number"
      ? { bufferBeforeMinutes: 0, bufferAfterMinutes: bufferInput }
      : resolveBookingBufferMinutes(bufferInput)
  const bufferBeforeMs = bufferBeforeMinutes * 60 * 1000
  const bufferAfterMs = bufferAfterMinutes * 60 * 1000
  const startMs = new Date(slot.startAt).getTime() - bufferBeforeMs
  const endMs = new Date(slot.endAt).getTime() + bufferAfterMs
  return ![...busyIntervals, ...existingBookings].some((interval) => {
    const bounds = intervalBounds(interval)
    if (!bounds) return false
    return overlaps(startMs, endMs, bounds.startMs, bounds.endMs)
  })
}

export function countWeekdaySlotsInHorizon(input: {
  timezone: string
  schedulingHorizonDays: number
  availabilityWindows: GrowthBookingAvailabilityWindow[]
  now?: Date
}): number {
  const timezone = resolveBookingTimezone(input.timezone)
  const now = input.now ?? new Date()
  const todayKey = formatDateKeyInTimezone(now, timezone)
  const endKey = addDaysToDateKey(todayKey, Math.max(1, input.schedulingHorizonDays) - 1, timezone)
  const windows = resolveBookingAvailabilityWindows(input.availabilityWindows)
  const enabledDays = new Set(windows.map((window) => window.dayOfWeek))
  let count = 0
  for (const dateKey of iterateDateKeys(todayKey, endKey, timezone)) {
    const dayAnchor = zonedLocalToUtc({ dateKey, hour: 12, minute: 0, timeZone: timezone })
    if (enabledDays.has(zonedParts(dayAnchor, timezone).dayOfWeek)) count += 1
  }
  return count
}
