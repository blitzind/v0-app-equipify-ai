import type { GrowthRevenueForecastPeriod } from "@/lib/growth/revenue-operating/revenue-operating-types"

export type GrowthRevenueDateRange = {
  start: Date
  end: Date
  label: string
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
}

export function resolveGrowthRevenueDateRange(
  period: GrowthRevenueForecastPeriod,
  now = new Date(),
  custom?: { start: string; end: string },
): GrowthRevenueDateRange {
  if (period === "custom" && custom?.start && custom?.end) {
    return {
      start: new Date(custom.start),
      end: new Date(custom.end),
      label: "Custom range",
    }
  }

  if (period === "this_month") {
    return { start: startOfMonth(now), end: endOfMonth(now), label: "This month" }
  }
  if (period === "next_month") {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { start: startOfMonth(next), end: endOfMonth(next), label: "Next month" }
  }
  if (period === "next_quarter") {
    const nextQ = new Date(now.getFullYear(), now.getMonth() + 3, 1)
    return { start: startOfQuarter(nextQ), end: endOfQuarter(nextQ), label: "Next quarter" }
  }

  return { start: startOfQuarter(now), end: endOfQuarter(now), label: "This quarter" }
}

export function isDateInRange(iso: string | null, range: GrowthRevenueDateRange): boolean {
  if (!iso) return true
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00.000Z` : iso)
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export function periodUsesQuarterlyGoal(period: GrowthRevenueForecastPeriod): boolean {
  return period === "this_quarter" || period === "next_quarter"
}
