/** Deterministic coaching trends aggregation from session insights (Growth Engine slice 6.13C). */

import type { LiveCoachingSessionInsightsRollup } from "@/lib/growth/realtime/live-coaching/session-insights-types"
import { LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS } from "@/lib/growth/realtime/live-coaching/session-insights-types"
import type {
  CoachingTrendsDailyPoint,
  CoachingTrendsFilters,
  CoachingTrendsPayload,
  CoachingTrendsProviderSummary,
  CoachingTrendsRiskDistribution,
  CoachingTrendsSummary,
} from "@/lib/growth/realtime/live-coaching/coaching-trends-types"

function toUtcDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function filterCoachingTrendsRollups(
  rollups: LiveCoachingSessionInsightsRollup[],
  filters: Pick<CoachingTrendsFilters, "providerId" | "riskLevel">,
): LiveCoachingSessionInsightsRollup[] {
  return rollups.filter((rollup) => {
    if (filters.providerId) {
      const providerKey = rollup.providerId ?? "manual"
      if (providerKey !== filters.providerId) return false
    }
    if (filters.riskLevel && rollup.riskLevel !== filters.riskLevel) {
      return false
    }
    return true
  })
}

export function buildCoachingTrendsSummary(
  rollups: LiveCoachingSessionInsightsRollup[],
): CoachingTrendsSummary {
  return {
    sessionCount: rollups.length,
    averageHealthScore: average(rollups.map((rollup) => rollup.sessionHealthScore)),
    averageTranscriptLatencyMs: average(rollups.map((rollup) => rollup.averageTranscriptLatencyMs)),
    maxTranscriptLatencyMs:
      rollups.length > 0 ? Math.max(...rollups.map((rollup) => rollup.maxTranscriptLatencyMs)) : 0,
    totalProviderInterruptions: rollups.reduce((sum, rollup) => sum + rollup.providerInterruptions, 0),
    totalReconnectAttempts: rollups.reduce((sum, rollup) => sum + rollup.reconnectAttempts, 0),
    totalRetryAttempts: rollups.reduce((sum, rollup) => sum + rollup.retryAttempts, 0),
    totalFallbackCount: rollups.reduce((sum, rollup) => sum + rollup.fallbackCount, 0),
    totalGuidanceGenerated: rollups.reduce((sum, rollup) => sum + rollup.guidanceGeneratedCount, 0),
    totalObjections: rollups.reduce((sum, rollup) => sum + rollup.objectionCount, 0),
    totalBuyingSignals: rollups.reduce((sum, rollup) => sum + rollup.buyingSignalCount, 0),
    totalDiscoveryGaps: rollups.reduce((sum, rollup) => sum + rollup.discoveryGapCount, 0),
    totalCompetitorPressure: rollups.reduce((sum, rollup) => sum + rollup.competitorPressureCount, 0),
  }
}

export function buildCoachingTrendsRiskDistribution(
  rollups: LiveCoachingSessionInsightsRollup[],
): CoachingTrendsRiskDistribution {
  const distribution: CoachingTrendsRiskDistribution = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
  for (const rollup of rollups) {
    distribution[rollup.riskLevel] += 1
  }
  return distribution
}

export function buildCoachingTrendsSessionsByProvider(
  rollups: LiveCoachingSessionInsightsRollup[],
): CoachingTrendsProviderSummary[] {
  const grouped = new Map<string, LiveCoachingSessionInsightsRollup[]>()
  for (const rollup of rollups) {
    const key = rollup.providerId ?? "manual"
    const bucket = grouped.get(key) ?? []
    bucket.push(rollup)
    grouped.set(key, bucket)
  }

  return [...grouped.entries()]
    .map(([providerId, entries]) => ({
      providerId,
      sessionCount: entries.length,
      averageHealthScore: average(entries.map((entry) => entry.sessionHealthScore)),
      providerInterruptions: entries.reduce((sum, entry) => sum + entry.providerInterruptions, 0),
      retryAttempts: entries.reduce((sum, entry) => sum + entry.retryAttempts, 0),
      fallbackCount: entries.reduce((sum, entry) => sum + entry.fallbackCount, 0),
    }))
    .sort((left, right) => right.sessionCount - left.sessionCount || left.providerId.localeCompare(right.providerId))
}

export function buildCoachingTrendsDailySeries(
  rollups: LiveCoachingSessionInsightsRollup[],
): CoachingTrendsDailyPoint[] {
  const grouped = new Map<string, LiveCoachingSessionInsightsRollup[]>()
  for (const rollup of rollups) {
    const date = toUtcDateKey(rollup.computedAt)
    const bucket = grouped.get(date) ?? []
    bucket.push(rollup)
    grouped.set(date, bucket)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({
      date,
      sessionCount: entries.length,
      averageHealthScore: average(entries.map((entry) => entry.sessionHealthScore)),
      averageTranscriptLatencyMs: average(entries.map((entry) => entry.averageTranscriptLatencyMs)),
      maxTranscriptLatencyMs: Math.max(...entries.map((entry) => entry.maxTranscriptLatencyMs)),
      providerInterruptions: entries.reduce((sum, entry) => sum + entry.providerInterruptions, 0),
      reconnectAttempts: entries.reduce((sum, entry) => sum + entry.reconnectAttempts, 0),
      retryAttempts: entries.reduce((sum, entry) => sum + entry.retryAttempts, 0),
      fallbackCount: entries.reduce((sum, entry) => sum + entry.fallbackCount, 0),
      guidanceGeneratedCount: entries.reduce((sum, entry) => sum + entry.guidanceGeneratedCount, 0),
      objectionCount: entries.reduce((sum, entry) => sum + entry.objectionCount, 0),
      buyingSignalCount: entries.reduce((sum, entry) => sum + entry.buyingSignalCount, 0),
      discoveryGapCount: entries.reduce((sum, entry) => sum + entry.discoveryGapCount, 0),
      competitorPressureCount: entries.reduce((sum, entry) => sum + entry.competitorPressureCount, 0),
    }))
}

export function buildCoachingTrendsPayload(input: {
  rollups: LiveCoachingSessionInsightsRollup[]
  filters: CoachingTrendsFilters
  qaProof: CoachingTrendsPayload["qaProof"]
}): CoachingTrendsPayload {
  const filtered = filterCoachingTrendsRollups(input.rollups, input.filters)

  return {
    filters: input.filters,
    summary: buildCoachingTrendsSummary(filtered),
    riskDistribution: buildCoachingTrendsRiskDistribution(filtered),
    sessionsByProvider: buildCoachingTrendsSessionsByProvider(filtered),
    dailyTrend: buildCoachingTrendsDailySeries(filtered),
    qaProof: input.qaProof,
  }
}

export function parseCoachingTrendsDateRangeDays(value: string | null | undefined): CoachingTrendsFilters["dateRangeDays"] {
  const parsed = Number(value)
  if (parsed === 7 || parsed === 30 || parsed === 90) return parsed
  return 30
}

export function parseCoachingTrendsProviderFilter(value: string | null | undefined): string | null {
  if (!value || value === "all") return null
  return value.slice(0, 64)
}

export function parseCoachingTrendsRiskFilter(
  value: string | null | undefined,
): CoachingTrendsFilters["riskLevel"] {
  if (!value || value === "all") return null
  return LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS.includes(value as CoachingTrendsFilters["riskLevel"])
    ? (value as CoachingTrendsFilters["riskLevel"])
    : null
}

export function coachingTrendsSinceIso(dateRangeDays: CoachingTrendsFilters["dateRangeDays"], now = new Date()): string {
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - dateRangeDays)
  return since.toISOString()
}
