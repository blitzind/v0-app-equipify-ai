/** Validates IANA timezone strings used for calendar event sync. */
export function isValidGrowthCalendarTimezone(timezone: string): boolean {
  const value = timezone.trim()
  if (!value) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function resolveGrowthMeetingTimezone(input?: string | null): string {
  const candidate = input?.trim()
  if (candidate && isValidGrowthCalendarTimezone(candidate)) return candidate
  return "UTC"
}

export function assertGrowthMeetingScheduleTimes(input: {
  startAt: string
  endAt?: string | null
}): { startAt: string; endAt: string } {
  const startMs = Date.parse(input.startAt)
  if (Number.isNaN(startMs)) throw new Error("Invalid meeting start time.")
  const endMs = input.endAt ? Date.parse(input.endAt) : startMs + 30 * 60 * 1000
  if (Number.isNaN(endMs)) throw new Error("Invalid meeting end time.")
  if (endMs <= startMs) throw new Error("Meeting end must be after start.")
  return { startAt: new Date(startMs).toISOString(), endAt: new Date(endMs).toISOString() }
}
