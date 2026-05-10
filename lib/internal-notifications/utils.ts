const DAY_MS = 24 * 60 * 60 * 1000

export function dateTodayYmd(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function dateDaysFromNowYmd(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

export function diffDaysUtc(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

export function numConfig(raw: Record<string, unknown>, key: string, fallback: number): number {
  const v = raw[key]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return fallback
}
