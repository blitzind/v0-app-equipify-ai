import { resolveBookingAvailabilityWindows } from "@/lib/growth/booking/booking-availability"
import type { GrowthBookingAvailabilityWindow } from "@/lib/growth/booking/booking-page-types"

export type AvailabilitySuggestion = {
  summary: string
  suggestedWindows: Array<{ dayLabel: string; startTime: string; endTime: string }>
  timezone: string
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function suggestAvailabilityFoundation(input?: {
  windows?: GrowthBookingAvailabilityWindow[] | null
  timezone?: string
  durationMinutes?: number
}): AvailabilitySuggestion {
  const windows = resolveBookingAvailabilityWindows(input?.windows)
  const timezone = input?.timezone?.trim() || "America/New_York"
  const durationMinutes = input?.durationMinutes ?? 30

  const suggestedWindows = windows.slice(0, 5).map((window) => ({
    dayLabel: DAY_LABELS[window.dayOfWeek] ?? "Day",
    startTime: window.startTime,
    endTime: window.endTime,
  }))

  return {
    summary: `Suggest ${durationMinutes}-minute slots during configured business hours (${timezone}). No live calendar write — operator confirms availability manually.`,
    suggestedWindows,
    timezone,
  }
}

export function formatAvailabilityHint(suggestion: AvailabilitySuggestion): string {
  if (suggestion.suggestedWindows.length === 0) return suggestion.summary
  const windowText = suggestion.suggestedWindows
    .map((window) => `${window.dayLabel} ${window.startTime}-${window.endTime}`)
    .join("; ")
  return `${suggestion.summary} Windows: ${windowText}.`
}
