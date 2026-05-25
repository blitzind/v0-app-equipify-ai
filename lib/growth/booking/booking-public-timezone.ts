/** Client-safe visitor timezone helpers for public booking pages. */

export function resolveVisitorTimezone(fallbackTimeZone: string): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected && detected.trim().length > 0) return detected
  } catch {
    // fall through
  }
  return fallbackTimeZone
}

export function formatTimezoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, " ")
}

export function visitorTimezoneHelperCopy(timeZone: string): string {
  return `Times shown in your timezone: ${formatTimezoneLabel(timeZone)}`
}
