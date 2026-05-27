import type { GrowthPerformanceTrend } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"

export function detectPerformanceTrend(input: {
  current: number
  previous: number
  higherIsBetter?: boolean
  criticalDropPct?: number
  improvingGainPct?: number
}): GrowthPerformanceTrend {
  const higherIsBetter = input.higherIsBetter ?? true
  const criticalDropPct = input.criticalDropPct ?? 40
  const improvingGainPct = input.improvingGainPct ?? 15

  if (input.previous <= 0 && input.current <= 0) return "stable"
  if (input.previous <= 0) return higherIsBetter && input.current > 0 ? "improving" : "stable"

  const deltaPct = ((input.current - input.previous) / input.previous) * 100
  const effectiveDelta = higherIsBetter ? deltaPct : -deltaPct

  if (effectiveDelta <= -criticalDropPct) return "critical"
  if (effectiveDelta <= -10) return "declining"
  if (effectiveDelta >= improvingGainPct) return "improving"
  return "stable"
}

export function detectRateTrend(currentRate: number, previousRate: number): GrowthPerformanceTrend {
  return detectPerformanceTrend({
    current: currentRate,
    previous: previousRate,
    higherIsBetter: true,
    criticalDropPct: 35,
    improvingGainPct: 12,
  })
}

export function aggregateTrendFromSeries(values: number[]): GrowthPerformanceTrend {
  if (values.length < 2) return "stable"
  const midpoint = Math.floor(values.length / 2)
  const previous = values.slice(0, midpoint)
  const current = values.slice(midpoint)
  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length
  const currentAvg = current.reduce((sum, value) => sum + value, 0) / current.length
  return detectPerformanceTrend({ current: currentAvg, previous: previousAvg })
}

export function trendSeverity(trend: GrowthPerformanceTrend): "info" | "low" | "medium" | "high" | "critical" {
  switch (trend) {
    case "improving":
      return "info"
    case "stable":
      return "low"
    case "declining":
      return "medium"
    case "critical":
      return "critical"
  }
}
