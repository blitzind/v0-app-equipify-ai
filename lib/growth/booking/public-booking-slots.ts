import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBookingSlots, resolveBookingAvailabilityWindows } from "@/lib/growth/booking/booking-availability"
import { buildAvailableDateKeys } from "@/lib/growth/booking/booking-availability-ui"
import {
  fetchGrowthBookingPageBySlug,
  listConfirmedBookingsInRange,
} from "@/lib/growth/booking/booking-page-repository"
import type { GrowthBookingPage, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import { normalizeSchedulingHorizonDays } from "@/lib/growth/booking/booking-page-defaults"
import { publicBookingErrorMessage } from "@/lib/growth/booking/booking-public-errors"
import {
  computeBookingHorizonEnd,
  formatDateKeyInTimezone,
  monthRangeInTimezone,
  resolveBookingTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import { getGrowthCalendarConnectionWithFreshAccessToken } from "@/lib/growth/calendar/calendar-connection-service"
import { fetchGoogleCalendarBusyIntervals } from "@/lib/growth/calendar/google-calendar-client"

export type PublicBookingSlotsDiagnostics = {
  slug: string
  requestedMonth: string | null
  hostTimezone: string
  timezoneMode: GrowthBookingPage["timezoneMode"]
  schedulingHorizonDays: number
  availabilityWindowsCount: number
  enabledWeekdays: number[]
  generatedSlotCountBeforeFreeBusy: number
  generatedSlotCountAfterFreeBusy: number
  confirmedBookingBlockCount: number
  freeBusyBlockCount: number
  firstSlotStart: string | null
  lastSlotStart: string | null
  freeBusyWarning?: string | null
}

export type PublicBookingSlotsResult =
  | {
      ok: true
      slots: GrowthBookingSlot[]
      availableDateKeys: string[]
      timezone: string
      timezoneMode: GrowthBookingPage["timezoneMode"]
      schedulingHorizonDays: number
      horizonEndAt: string
      monthKey: string | null
      warning?: string | null
      diagnostics?: PublicBookingSlotsDiagnostics
    }
  | { ok: false; code: string; message: string }

function resolveMonthKey(month: string | null | undefined, now: Date, timeZone: string): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month
  return formatDateKeyInTimezone(now, timeZone).slice(0, 7)
}

function isBookingDiagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.BOOKING_AVAILABILITY_DEBUG === "1"
}

function sanitizeBusyIntervals(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  return intervals.filter((interval) => {
    const startMs = Date.parse(interval.start)
    const endMs = Date.parse(interval.end)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false
    if (endMs <= startMs) return false
    if (endMs - startMs > 31 * 24 * 60 * 60 * 1000) return false
    return true
  })
}

async function loadConfirmedBookingsInRange(
  admin: SupabaseClient,
  bookingPageId: string,
  timeMin: string,
  timeMax: string,
): Promise<Array<{ startAt: string; endAt: string }>> {
  try {
    return await listConfirmedBookingsInRange(admin, bookingPageId, timeMin, timeMax)
  } catch {
    return []
  }
}

export async function fetchPublicBookingSlots(
  admin: SupabaseClient,
  slug: string,
  options?: { month?: string | null },
): Promise<PublicBookingSlotsResult> {
  const requestedMonth = options?.month ?? null
  try {
    const page = await fetchGrowthBookingPageBySlug(admin, slug, true)
    if (!page) return { ok: false, code: "page_disabled", message: publicBookingErrorMessage("page_disabled") }

    const now = new Date()
    const hostTimezone = resolveBookingTimezone(page.timezone)
    const schedulingHorizonDays = normalizeSchedulingHorizonDays(page.schedulingHorizonDays)
    const monthKey = resolveMonthKey(requestedMonth, now, hostTimezone)
    const monthRange = monthRangeInTimezone(monthKey, hostTimezone)
    if (!monthRange) return { ok: false, code: "invalid_month", message: publicBookingErrorMessage("invalid_month") }

    const horizonEnd = computeBookingHorizonEnd(now, schedulingHorizonDays)
    const rangeStart = monthRange.rangeStart.getTime() < now.getTime() ? now : monthRange.rangeStart
    const rangeEnd =
      monthRange.rangeEnd.getTime() > horizonEnd.getTime() ? horizonEnd : monthRange.rangeEnd

    const windows = resolveBookingAvailabilityWindows(page.availabilityWindows)
    const enabledWeekdays = [...new Set(windows.map((window) => window.dayOfWeek))].sort((a, b) => a - b)

    if (rangeStart.getTime() >= rangeEnd.getTime()) {
      const diagnostics: PublicBookingSlotsDiagnostics | undefined = isBookingDiagnosticsEnabled()
        ? {
            slug,
            requestedMonth,
            hostTimezone,
            timezoneMode: page.timezoneMode,
            schedulingHorizonDays,
            availabilityWindowsCount: windows.length,
            enabledWeekdays,
            generatedSlotCountBeforeFreeBusy: 0,
            generatedSlotCountAfterFreeBusy: 0,
            confirmedBookingBlockCount: 0,
            freeBusyBlockCount: 0,
            firstSlotStart: null,
            lastSlotStart: null,
          }
        : undefined

      return {
        ok: true,
        slots: [],
        availableDateKeys: [],
        timezone: page.timezone,
        timezoneMode: page.timezoneMode,
        schedulingHorizonDays,
        horizonEndAt: horizonEnd.toISOString(),
        monthKey,
        diagnostics,
      }
    }

    const timeMin = rangeStart.toISOString()
    const timeMax = rangeEnd.toISOString()
    const existingBookings = await loadConfirmedBookingsInRange(admin, page.id, timeMin, timeMax)

    const slotsBeforeFreeBusy = buildBookingSlots({
      timezone: page.timezone,
      durationMinutes: page.durationMinutes,
      bufferBeforeMinutes: page.bufferBeforeMinutes,
      bufferAfterMinutes: page.bufferAfterMinutes,
      bufferMinutes: page.bufferMinutes,
      minimumNoticeHours: page.minimumNoticeHours,
      maxMeetingsPerDay: page.maxMeetingsPerDay,
      schedulingHorizonDays,
      availabilityWindows: windows,
      rangeStart,
      rangeEnd,
      now,
      busyIntervals: [],
      existingBookings,
    })

    let busyIntervals: Array<{ start: string; end: string }> = []
    let freeBusyWarning: string | null = null
    try {
      const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, page.ownerUserId)
      if (connection) {
        const rawBusy = await fetchGoogleCalendarBusyIntervals({
          accessToken: connection.accessToken,
          timeMin,
          timeMax,
          timezone: page.timezone,
        })
        busyIntervals = sanitizeBusyIntervals(rawBusy)
      }
    } catch {
      freeBusyWarning = "calendar_busy_unavailable"
    }

    const slots = buildBookingSlots({
      timezone: page.timezone,
      durationMinutes: page.durationMinutes,
      bufferBeforeMinutes: page.bufferBeforeMinutes,
      bufferAfterMinutes: page.bufferAfterMinutes,
      bufferMinutes: page.bufferMinutes,
      minimumNoticeHours: page.minimumNoticeHours,
      maxMeetingsPerDay: page.maxMeetingsPerDay,
      schedulingHorizonDays,
      availabilityWindows: windows,
      rangeStart,
      rangeEnd,
      now,
      busyIntervals,
      existingBookings,
    })

    const availableDateKeys = [...buildAvailableDateKeys(slots, hostTimezone, page.timezoneMode)].sort()

    const diagnostics: PublicBookingSlotsDiagnostics | undefined = isBookingDiagnosticsEnabled()
      ? {
          slug,
          requestedMonth,
          hostTimezone,
          timezoneMode: page.timezoneMode,
          schedulingHorizonDays,
          availabilityWindowsCount: windows.length,
          enabledWeekdays,
          generatedSlotCountBeforeFreeBusy: slotsBeforeFreeBusy.length,
          generatedSlotCountAfterFreeBusy: slots.length,
          confirmedBookingBlockCount: existingBookings.length,
          freeBusyBlockCount: busyIntervals.length,
          firstSlotStart: slots[0]?.startAt ?? null,
          lastSlotStart: slots[slots.length - 1]?.startAt ?? null,
          freeBusyWarning,
        }
      : undefined

    return {
      ok: true,
      slots,
      availableDateKeys,
      timezone: page.timezone,
      timezoneMode: page.timezoneMode,
      schedulingHorizonDays,
      horizonEndAt: horizonEnd.toISOString(),
      monthKey,
      warning: freeBusyWarning,
      diagnostics,
    }
  } catch (error) {
    if (isBookingDiagnosticsEnabled() && error instanceof Error) {
      console.error("[public-booking-slots]", slug, requestedMonth, error.message)
    }
    return { ok: false, code: "slots_fetch_failed", message: publicBookingErrorMessage("slots_fetch_failed") }
  }
}
