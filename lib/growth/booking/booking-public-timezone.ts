/** Client-safe visitor timezone helpers for public booking pages. */

import {
  formatFriendlyTimezoneName,
  formatIanaTimezoneOption,
  readStoredBookingTimezone,
  resolveBookingDisplayTimezone,
  resolveBookingTimezone,
  writeStoredBookingTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import type { GrowthBookingTimezoneMode } from "@/lib/growth/booking/booking-page-types"

export function resolveVisitorTimezone(fallbackTimeZone: string): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected && detected.trim().length > 0) return resolveBookingTimezone(detected, fallbackTimeZone)
  } catch {
    // fall through
  }
  return resolveBookingTimezone(fallbackTimeZone)
}

export function resolvePublicBookingDisplayTimezone(input: {
  slug: string
  timezoneMode: GrowthBookingTimezoneMode
  hostTimezone: string
  visitorTimezone?: string
}): string {
  const visitorTimezone = input.visitorTimezone ?? resolveVisitorTimezone(input.hostTimezone)
  const stored =
    input.timezoneMode === "visitor_override"
      ? readStoredBookingTimezone(input.slug, visitorTimezone)
      : null
  return resolveBookingDisplayTimezone({
    timezoneMode: input.timezoneMode,
    hostTimezone: input.hostTimezone,
    visitorTimezone,
    storedVisitorTimezone: stored,
  })
}

export function persistPublicBookingTimezone(slug: string, timeZone: string): void {
  writeStoredBookingTimezone(slug, timeZone)
}

export function formatTimezoneLabel(timeZone: string): string {
  return formatFriendlyTimezoneName(resolveBookingTimezone(timeZone))
}

export function formatTimezoneOptionLabel(timeZone: string): string {
  return formatIanaTimezoneOption(resolveBookingTimezone(timeZone))
}

export function visitorTimezoneHelperCopy(timeZone: string): string {
  return `Times shown in your timezone: ${formatTimezoneLabel(timeZone)}`
}
