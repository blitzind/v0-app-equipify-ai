/** Client-safe Live Coaching coaching trends types (Growth Engine slice 6.13C). */

import type { LiveCoachingSessionInsightsRiskLevel } from "@/lib/growth/realtime/live-coaching/session-insights-types"

export const COACHING_TRENDS_DATE_RANGE_DAYS = [7, 30, 90] as const

export type CoachingTrendsDateRangeDays = (typeof COACHING_TRENDS_DATE_RANGE_DAYS)[number]

export type CoachingTrendsFilters = {
  dateRangeDays: CoachingTrendsDateRangeDays
  providerId: string | null
  riskLevel: LiveCoachingSessionInsightsRiskLevel | null
}

export type CoachingTrendsDailyPoint = {
  date: string
  sessionCount: number
  averageHealthScore: number
  averageTranscriptLatencyMs: number
  maxTranscriptLatencyMs: number
  providerInterruptions: number
  reconnectAttempts: number
  retryAttempts: number
  fallbackCount: number
  guidanceGeneratedCount: number
  objectionCount: number
  buyingSignalCount: number
  discoveryGapCount: number
  competitorPressureCount: number
}

export type CoachingTrendsProviderSummary = {
  providerId: string
  sessionCount: number
  averageHealthScore: number
  providerInterruptions: number
  retryAttempts: number
  fallbackCount: number
}

export type CoachingTrendsRiskDistribution = Record<LiveCoachingSessionInsightsRiskLevel, number>

export type CoachingTrendsSummary = {
  sessionCount: number
  averageHealthScore: number
  averageTranscriptLatencyMs: number
  maxTranscriptLatencyMs: number
  totalProviderInterruptions: number
  totalReconnectAttempts: number
  totalRetryAttempts: number
  totalFallbackCount: number
  totalGuidanceGenerated: number
  totalObjections: number
  totalBuyingSignals: number
  totalDiscoveryGaps: number
  totalCompetitorPressure: number
}

export type CoachingTrendsPayload = {
  filters: CoachingTrendsFilters
  summary: CoachingTrendsSummary
  riskDistribution: CoachingTrendsRiskDistribution
  sessionsByProvider: CoachingTrendsProviderSummary[]
  dailyTrend: CoachingTrendsDailyPoint[]
  meta: {
    total: number
    limit: number
    truncated: boolean
  }
  qaProof: {
    marker: string
    label: string
    verified: boolean
  }
}
