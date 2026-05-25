/** Client-safe booking page UI types (booking-page-ui-v2). */

import type { GrowthBookingAvailabilityWindow } from "@/lib/growth/booking/booking-page-types"

export const GROWTH_BOOKING_PAGE_UI_QA_MARKER = "booking-page-ui-v2" as const

export const BOOKING_WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type BookingWeeklyDaySchedule = {
  dayOfWeek: number
  label: string
  enabled: boolean
  startTime: string
  endTime: string
}

export function createDefaultWeeklySchedule(): BookingWeeklyDaySchedule[] {
  return BOOKING_WEEKDAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: "09:00",
    endTime: "17:00",
  }))
}

export function weeklyScheduleToWindows(schedule: BookingWeeklyDaySchedule[]): GrowthBookingAvailabilityWindow[] {
  return schedule
    .filter((day) => day.enabled)
    .map((day) => ({
      dayOfWeek: day.dayOfWeek,
      startTime: day.startTime,
      endTime: day.endTime,
    }))
}

export function windowsToWeeklySchedule(
  windows: GrowthBookingAvailabilityWindow[] | null | undefined,
): BookingWeeklyDaySchedule[] {
  const defaults = createDefaultWeeklySchedule()
  if (!windows?.length) return defaults

  return defaults.map((day) => {
    const match = windows.find((window) => window.dayOfWeek === day.dayOfWeek)
    if (!match) return { ...day, enabled: false }
    return {
      ...day,
      enabled: true,
      startTime: match.startTime,
      endTime: match.endTime,
    }
  })
}
