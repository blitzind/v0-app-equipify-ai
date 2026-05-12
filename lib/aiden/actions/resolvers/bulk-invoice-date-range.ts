export type ParsedBulkInvoiceDateRange = {
  /** Inclusive lower bound (ISO timestamp, UTC start of first day). */
  rangeStartIso: string
  /** Inclusive upper bound (ISO timestamp, UTC end of last day). */
  rangeEndIso: string
  /** Human-readable label for previews and audit. */
  label: string
}

function utcMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(23, 59, 59, 999)
  return x
}

function addUtcDays(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

/** Monday (UTC) of the week containing `d`, at 00:00 UTC. */
function mondayOfUtcWeekContaining(d: Date): Date {
  const day = d.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  return utcMidnight(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset)
}

/**
 * Best-effort date range from normalized user text (lowercased, collapsed spaces).
 * Uses **UTC calendar** boundaries. Returns null when no supported range is found.
 */
export function parseBulkInvoiceDateRangeFromNormalizedText(
  normalized: string,
  now: Date = new Date(),
): ParsedBulkInvoiceDateRange | null {
  const todayStart = utcMidnight(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const todayEnd = endOfUtcDay(todayStart)

  if (/\byesterday\b/.test(normalized)) {
    const start = addUtcDays(todayStart, -1)
    return {
      rangeStartIso: start.toISOString(),
      rangeEndIso: endOfUtcDay(start).toISOString(),
      label: "Yesterday (UTC)",
    }
  }

  if (/\btoday\b/.test(normalized)) {
    return {
      rangeStartIso: todayStart.toISOString(),
      rangeEndIso: todayEnd.toISOString(),
      label: "Today (UTC)",
    }
  }

  if (/\blast\s+7\s+days\b/.test(normalized) || /\bpast\s+7\s+days\b/.test(normalized) || /\blast\s+seven\s+days\b/.test(normalized)) {
    const start = addUtcDays(todayStart, -6)
    return {
      rangeStartIso: start.toISOString(),
      rangeEndIso: todayEnd.toISOString(),
      label: "Last 7 days (UTC)",
    }
  }

  if (/\blast\s+week\b/.test(normalized) || /\bprevious\s+week\b/.test(normalized)) {
    const thisMonday = mondayOfUtcWeekContaining(now)
    const lastMonday = addUtcDays(thisMonday, -7)
    const lastSunday = endOfUtcDay(addUtcDays(lastMonday, 6))
    return {
      rangeStartIso: lastMonday.toISOString(),
      rangeEndIso: lastSunday.toISOString(),
      label: "Last calendar week (Mon–Sun, UTC)",
    }
  }

  if (/\bthis\s+week\b/.test(normalized)) {
    const mon = mondayOfUtcWeekContaining(now)
    const sun = endOfUtcDay(addUtcDays(mon, 6))
    return {
      rangeStartIso: mon.toISOString(),
      rangeEndIso: sun.toISOString(),
      label: "This week (Mon–Sun, UTC)",
    }
  }

  return null
}
