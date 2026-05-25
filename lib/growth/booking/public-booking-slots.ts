import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBookingSlots } from "@/lib/growth/booking/booking-availability"
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

export type PublicBookingSlotsResult =
  | {
      ok: true
      slots: GrowthBookingSlot[]
      timezone: string
      timezoneMode: GrowthBookingPage["timezoneMode"]
      schedulingHorizonDays: number
      horizonEndAt: string
      monthKey: string | null
    }
  | { ok: false; code: string; message: string }

function resolveMonthKey(month: string | null | undefined, now: Date, timeZone: string): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month
  return formatDateKeyInTimezone(now, timeZone).slice(0, 7)
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
    // Public availability should still render when booking history table is unavailable.
    return []
  }
}

export async function fetchPublicBookingSlots(
  admin: SupabaseClient,
  slug: string,
  options?: { month?: string | null },
): Promise<PublicBookingSlotsResult> {
  try {
    const page = await fetchGrowthBookingPageBySlug(admin, slug, true)
    if (!page) return { ok: false, code: "page_disabled", message: publicBookingErrorMessage("page_disabled") }

    const now = new Date()
    const timeZone = resolveBookingTimezone(page.timezone)
    const schedulingHorizonDays = normalizeSchedulingHorizonDays(page.schedulingHorizonDays)
    const monthKey = resolveMonthKey(options?.month, now, timeZone)
    const monthRange = monthRangeInTimezone(monthKey, timeZone)
    if (!monthRange) return { ok: false, code: "invalid_month", message: publicBookingErrorMessage("invalid_month") }

    const horizonEnd = computeBookingHorizonEnd(now, schedulingHorizonDays)
    const rangeStart = monthRange.rangeStart.getTime() < now.getTime() ? now : monthRange.rangeStart
    const rangeEnd =
      monthRange.rangeEnd.getTime() > horizonEnd.getTime() ? horizonEnd : monthRange.rangeEnd

    if (rangeStart.getTime() >= rangeEnd.getTime()) {
      return {
        ok: true,
        slots: [],
        timezone: page.timezone,
        timezoneMode: page.timezoneMode,
        schedulingHorizonDays,
        horizonEndAt: horizonEnd.toISOString(),
        monthKey,
      }
    }

    const timeMin = rangeStart.toISOString()
    const timeMax = rangeEnd.toISOString()
    const existingBookings = await loadConfirmedBookingsInRange(admin, page.id, timeMin, timeMax)

    let busyIntervals: Array<{ start: string; end: string }> = []
    try {
      const connection = await getGrowthCalendarConnectionWithFreshAccessToken(admin, page.ownerUserId)
      if (connection) {
        busyIntervals = await fetchGoogleCalendarBusyIntervals({
          accessToken: connection.accessToken,
          timeMin,
          timeMax,
          timezone: page.timezone,
        })
      }
    } catch {
      // Availability falls back to booking-page windows + existing bookings only.
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
      availabilityWindows: page.availabilityWindows,
      rangeStart,
      rangeEnd,
      now,
      busyIntervals,
      existingBookings,
    })

    return {
      ok: true,
      slots,
      timezone: page.timezone,
      timezoneMode: page.timezoneMode,
      schedulingHorizonDays,
      horizonEndAt: horizonEnd.toISOString(),
      monthKey,
    }
  } catch {
    return { ok: false, code: "slots_fetch_failed", message: publicBookingErrorMessage("slots_fetch_failed") }
  }
}
