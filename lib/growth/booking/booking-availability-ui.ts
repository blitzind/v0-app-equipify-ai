import type {
  GrowthBookingAvailabilityWindow,
  GrowthBookingSlot,
  GrowthBookingTimezoneMode,
} from "@/lib/growth/booking/booking-page-types"
import { formatDateKeyInTimezone } from "@/lib/growth/booking/booking-timezone-utils"

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidAvailabilityTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim())
}

export function validateBookingAvailabilityWindows(
  windows: GrowthBookingAvailabilityWindow[],
): { ok: true } | { ok: false; message: string } {
  if (windows.length === 0) {
    return { ok: false, message: "Enable at least one availability day." }
  }

  for (const window of windows) {
    if (window.dayOfWeek < 0 || window.dayOfWeek > 6) {
      return { ok: false, message: "Availability day is invalid." }
    }
    if (!isValidAvailabilityTime(window.startTime) || !isValidAvailabilityTime(window.endTime)) {
      return { ok: false, message: "Availability times must use HH:MM format." }
    }
    const [startHour, startMinute] = window.startTime.split(":").map(Number)
    const [endHour, endMinute] = window.endTime.split(":").map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    if (endMinutes <= startMinutes) {
      return { ok: false, message: "Availability end time must be after start time." }
    }
  }

  return { ok: true }
}

export function formatSlotDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

export function calendarDateToSlotKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatDateKeyLabel(dateKey: string, timeZone: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(anchor)
}

export function groupSlotsByDateKey(
  slots: GrowthBookingSlot[],
  timeZone: string,
): Map<string, GrowthBookingSlot[]> {
  const groups = new Map<string, GrowthBookingSlot[]>()
  for (const slot of slots) {
    const key = formatSlotDateKey(slot.startAt, timeZone)
    const list = groups.get(key) ?? []
    list.push(slot)
    groups.set(key, list)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  }
  return groups
}

export function datesWithAvailableSlots(slots: GrowthBookingSlot[], timeZone: string): Set<string> {
  return buildAvailableDateKeys(slots, timeZone)
}

export function buildAvailableDateKeys(slots: GrowthBookingSlot[], timeZone: string): Set<string> {
  return new Set(slots.map((slot) => formatSlotDateKey(slot.startAt, timeZone)))
}

/** Calendar grid civil date — matches react-day-picker local cells for visitor modes. */
export function resolveBookingCalendarDateKey(
  date: Date,
  displayTimezone: string,
  timezoneMode: GrowthBookingTimezoneMode = "visitor_local",
): string {
  if (timezoneMode === "fixed_host") {
    return calendarDateToSlotKey(date, displayTimezone)
  }
  return dateKeyFromLocalDate(date)
}

export function resolveBookingTodayDateKey(
  displayTimezone: string,
  timezoneMode: GrowthBookingTimezoneMode = "visitor_local",
): string {
  return resolveBookingCalendarDateKey(new Date(), displayTimezone, timezoneMode)
}

export function apiMonthKeyFromDate(date: Date, hostTimezone: string): string {
  const anchor = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)
  return formatDateKeyInTimezone(anchor, hostTimezone).slice(0, 7)
}

export function countAvailableDatesInMonth(availableDateKeys: Set<string>, monthKey: string): number {
  const prefix = `${monthKey}-`
  let count = 0
  for (const key of availableDateKeys) {
    if (key.startsWith(prefix)) count += 1
  }
  return count
}

export function dateKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function formatSlotTimeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function formatSlotDateTimeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}
