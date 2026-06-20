/** GS-SENDR-3B — Analytics date range parsing (client-safe). */

import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsDateRangePreset,
} from "@/lib/growth/sendr/growth-sendr-types"

const PRESET_LABELS: Record<GrowthSendrAnalyticsDateRangePreset, string> = {
  today: "Today",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  custom: "Custom",
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  )
}

export function resolveSendrAnalyticsDateRange(input: {
  preset?: string | null
  startAt?: string | null
  endAt?: string | null
  now?: Date
}): GrowthSendrAnalyticsDateRange {
  const now = input.now ?? new Date()
  const preset = normalizeSendrAnalyticsPreset(input.preset)

  if (preset === "custom" && input.startAt && input.endAt) {
    const start = new Date(input.startAt)
    const end = new Date(input.endAt)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return {
        preset: "custom",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        label: PRESET_LABELS.custom,
      }
    }
  }

  const endAt = endOfUtcDay(now)
  let startAt = startOfUtcDay(now)

  if (preset === "last_7_days") {
    startAt = startOfUtcDay(new Date(now.getTime() - 6 * 86_400_000))
  } else if (preset === "last_30_days") {
    startAt = startOfUtcDay(new Date(now.getTime() - 29 * 86_400_000))
  }

  return {
    preset,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    label: PRESET_LABELS[preset],
  }
}

export function normalizeSendrAnalyticsPreset(
  value?: string | null,
): GrowthSendrAnalyticsDateRangePreset {
  if (value === "today" || value === "last_7_days" || value === "last_30_days" || value === "custom") {
    return value
  }
  return "last_7_days"
}

export const GROWTH_SENDR_ANALYTICS_DEFAULT_PRESET: GrowthSendrAnalyticsDateRangePreset = "last_7_days"
