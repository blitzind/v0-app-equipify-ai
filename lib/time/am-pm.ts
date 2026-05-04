/** 24h HH:MM helpers for scheduling UI (display AM/PM, parse typed input). */

const HH_MM = /^(\d{1,2}):(\d{2})$/

/** Every 15 minutes from 00:00 .. 23:45 */
export function quarterHourHhMmSlots(): string[] {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return out
}

export function formatHhMmAmPm(hhmm: string): string {
  const match = HH_MM.exec(hhmm.trim())
  if (!match) return hhmm.trim()
  let h = parseInt(match[1], 10)
  const min = match[2]
  if (Number.isNaN(h) || h < 0 || h > 23) return hhmm.trim()
  const period = h < 12 ? "AM" : "PM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${min} ${period}`
}

/**
 * Accepts:
 * - 24h "09:00", "14:30"
 * - 12h "9:00 AM", "2:30 pm", "12:15 PM"
 */
export function parseFlexibleTimeToHhMm(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const upper = raw.toUpperCase()
  const ampm =
    upper.endsWith(" AM") || upper.endsWith(" PM")
      ? upper.endsWith(" AM")
        ? "AM"
        : "PM"
      : null

  let body = raw
  if (ampm) {
    body = raw.slice(0, raw.toUpperCase().lastIndexOf(ampm === "AM" ? "AM" : "PM")).trim()
  }

  const numMatch = /^(\d{1,2})(?::(\d{2}))?$/.exec(body)
  if (!numMatch) return null

  let h = parseInt(numMatch[1], 10)
  let m = numMatch[2] != null ? parseInt(numMatch[2], 10) : 0

  if (Number.isNaN(h) || Number.isNaN(m)) return null
  if (m < 0 || m > 59) return null

  if (ampm) {
    if (h < 1 || h > 12) return null
    if (ampm === "AM") {
      h = h === 12 ? 0 : h
    } else {
      h = h === 12 ? 12 : h + 12
    }
  } else {
    if (h < 0 || h > 23) return null
  }

  // Snap to 15-minute grid when parsed from typed input
  const snapped = Math.round(m / 15) * 15
  const mm = snapped === 60 ? 0 : snapped
  let hh = h
  if (snapped === 60) {
    hh += 1
  }
  if (hh > 23) return null

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}
