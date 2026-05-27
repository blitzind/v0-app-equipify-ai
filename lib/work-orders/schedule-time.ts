/** Client-safe schedule time helpers for work orders and service schedule. */

export const SCHEDULE_WORK_ORDER_FLOW_QA_MARKER = "schedule-work-order-flow-v1" as const

/** Normalize HH:MM or HH:MM:SS to minutes from midnight. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time?.trim()) return null
  const parts = time.trim().slice(0, 8).split(":")
  const h = Number(parts[0])
  const m = Number(parts[1] ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Add minutes to HH:MM, wrap within same day (0–1439). */
export function addMinutesToTimeHm(startHm: string, minutes: number): string {
  const base = timeToMinutes(startHm) ?? 8 * 60
  const total = Math.min(23 * 60 + 59, Math.max(0, base + minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** True when both times are set and end is strictly after start (same-day). */
export function isEndTimeAfterStart(start: string | null | undefined, end: string | null | undefined): boolean {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s == null || e == null) return true
  return e > s
}

export function scheduleTimeRangeError(start: string, end: string): string | null {
  if (!start.trim() || !end.trim()) return null
  if (isEndTimeAfterStart(start, end)) return null
  return "End time must be after start time."
}

export function formatScheduleTimeHm(t: string | null | undefined): string {
  if (!t) return ""
  const s = t.trim()
  return s.length >= 5 ? s.slice(0, 5) : s
}

/** Human-readable duration, e.g. "1h 30m" or "45m". */
export function formatScheduleDurationMinutes(minutes: number): string {
  if (minutes <= 0) return ""
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function computeScheduleDurationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s == null || e == null || e <= s) return null
  return e - s
}

/** Display line: "08:00 – 10:00 (2h)" or start only when no valid end. */
export function formatScheduleTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const startHm = formatScheduleTimeHm(start)
  if (!startHm) return "No time"
  const endHm = formatScheduleTimeHm(end)
  const duration = computeScheduleDurationMinutes(start, end)
  if (!endHm || duration == null) return startHm
  const dur = formatScheduleDurationMinutes(duration)
  return dur ? `${startHm} – ${endHm} (${dur})` : `${startHm} – ${endHm}`
}
