/** Coerce local time strings to HH:00–HH:59 for digest / quiet-hour fields (matches Postgres check constraints). */
export function normalizeLocalHm(raw: string | null | undefined, fallback: string): string {
  if (raw == null) return fallback
  const s = String(raw).trim()
  if (!s) return fallback
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return fallback
  const h = Number.parseInt(m[1]!, 10)
  const min = Number.parseInt(m[2]!, 10)
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return fallback
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export const DEFAULT_DIGEST_TIME_LOCAL = "08:00"
