/** Transport rate limit enforcement — client-safe pure functions. */

import type { GrowthProviderRateLimitRow } from "@/lib/growth/providers/adapters/provider-adapter-types"

export type RateLimitWindow = {
  minute: number
  hour: number
  day: number
  window_started_at: string
}

export type RateLimitCheckResult = {
  allowed: boolean
  reason: string
  minute_remaining: number
  hour_remaining: number
  day_remaining: number
  next_window?: RateLimitWindow
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function rollRateLimitWindow(
  row: Pick<GrowthProviderRateLimitRow, "current_minute" | "current_hour" | "current_day" | "window_started_at">,
  now = Date.now(),
): RateLimitWindow {
  const started = new Date(row.window_started_at).getTime()
  const elapsed = Math.max(0, now - started)

  if (elapsed < MINUTE_MS) {
    return {
      minute: row.current_minute,
      hour: row.current_hour,
      day: row.current_day,
      window_started_at: row.window_started_at,
    }
  }

  let minute = row.current_minute
  let hour = row.current_hour
  let day = row.current_day
  let windowStartedAt = row.window_started_at

  if (elapsed >= DAY_MS) {
    minute = 0
    hour = 0
    day = 0
    windowStartedAt = new Date(now).toISOString()
  } else if (elapsed >= HOUR_MS) {
    minute = 0
    hour = 0
    windowStartedAt = new Date(now).toISOString()
  } else {
    minute = 0
    windowStartedAt = new Date(now).toISOString()
  }

  return { minute, hour, day, window_started_at: windowStartedAt }
}

export function checkTransportRateLimit(
  row: GrowthProviderRateLimitRow,
  volume = 1,
  now = Date.now(),
): RateLimitCheckResult {
  const rolled = rollRateLimitWindow(row, now)
  const minuteRemaining = Math.max(0, row.minute_cap - rolled.minute)
  const hourRemaining = Math.max(0, row.hour_cap - rolled.hour)
  const dayRemaining = Math.max(0, row.day_cap - rolled.day)

  if (row.minute_cap > 0 && rolled.minute + volume > row.minute_cap) {
    return {
      allowed: false,
      reason: "Minute rate cap exceeded.",
      minute_remaining: minuteRemaining,
      hour_remaining: hourRemaining,
      day_remaining: dayRemaining,
      next_window: rolled,
    }
  }

  if (row.hour_cap > 0 && rolled.hour + volume > row.hour_cap) {
    return {
      allowed: false,
      reason: "Hour rate cap exceeded.",
      minute_remaining: minuteRemaining,
      hour_remaining: hourRemaining,
      day_remaining: dayRemaining,
      next_window: rolled,
    }
  }

  if (row.day_cap > 0 && rolled.day + volume > row.day_cap) {
    return {
      allowed: false,
      reason: "Daily rate cap exceeded.",
      minute_remaining: minuteRemaining,
      hour_remaining: hourRemaining,
      day_remaining: dayRemaining,
      next_window: rolled,
    }
  }

  return {
    allowed: true,
    reason: "Within provider rate limits.",
    minute_remaining: minuteRemaining - volume,
    hour_remaining: hourRemaining - volume,
    day_remaining: dayRemaining - volume,
    next_window: rolled,
  }
}

export function incrementRateLimitCounters(
  row: GrowthProviderRateLimitRow,
  volume = 1,
  now = Date.now(),
): Pick<GrowthProviderRateLimitRow, "current_minute" | "current_hour" | "current_day" | "window_started_at"> {
  const rolled = rollRateLimitWindow(row, now)
  return {
    current_minute: rolled.minute + volume,
    current_hour: rolled.hour + volume,
    current_day: rolled.day + volume,
    window_started_at: rolled.window_started_at,
  }
}

export function defaultRateLimitsForProvider(maxDailyVolume: number): Pick<
  GrowthProviderRateLimitRow,
  "minute_cap" | "hour_cap" | "day_cap"
> {
  const dayCap = maxDailyVolume > 0 ? maxDailyVolume : 500
  return {
    minute_cap: Math.max(5, Math.min(30, Math.round(dayCap / 50))),
    hour_cap: Math.max(20, Math.min(200, Math.round(dayCap / 5))),
    day_cap: dayCap,
  }
}
