/**
 * Draft scheduling helpers for future automated delivery (no persistence in v1).
 * Workers should persist schedules separately and call the executive report API with service role.
 */

export type ExecutiveReportScheduleKind = "weekly" | "monthly"

/** Next UTC instant after `from` on the given weekday at hour:minute (weekday: 0=Sun … 6=Sat). */
export function computeNextUtcRunAt(args: {
  from: Date
  weekdayUtc: number
  hourUtc: number
  minuteUtc: number
}): string {
  const targetDow = ((args.weekdayUtc % 7) + 7) % 7
  const fromMs = args.from.getTime()
  for (let add = 0; add < 14; add += 1) {
    const day = new Date(fromMs + add * 86400000)
    const c = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        args.hourUtc,
        args.minuteUtc,
        0,
        0,
      ),
    )
    if (c.getUTCDay() === targetDow && c.getTime() > fromMs) {
      return c.toISOString()
    }
  }
  return new Date(fromMs + 7 * 86400000).toISOString()
}
