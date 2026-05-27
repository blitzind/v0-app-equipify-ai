import {
  computeSenderReputationScore,
  tierFromSenderReputationScore,
} from "@/lib/growth/compliance/sender-reputation"
import type {
  GrowthSenderPerformanceMetrics,
  GrowthPerformanceTrend,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { emptySenderMetrics } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { detectPerformanceTrend } from "@/lib/growth/revenue-intelligence/trend-detector"

export function buildSenderPerformanceMetrics(input: {
  sent?: number
  hardBounces?: number
  softBounces?: number
  complaints?: number
  opens?: number
  clicks?: number
  replies?: number
  warmupProgress?: number
  cleanDays?: number
  previousEngagementRate?: number
}): GrowthSenderPerformanceMetrics {
  const metrics = emptySenderMetrics()
  const sent = input.sent ?? 0
  const hardBounces = input.hardBounces ?? 0
  const softBounces = input.softBounces ?? 0
  const complaints = input.complaints ?? 0
  const opens = input.opens ?? 0
  const clicks = input.clicks ?? 0
  const replies = input.replies ?? 0

  metrics.reputation_score = computeSenderReputationScore({
    hardBounces,
    softBounces,
    complaints,
    spamEvents: 0,
    cleanDays: input.cleanDays ?? 0,
  })
  metrics.deliverability = sent > 0 ? Math.max(0, 100 - Math.round(((hardBounces + softBounces) / sent) * 100)) : 100
  metrics.bounce_trend = sent > 0 ? Math.round(((hardBounces + softBounces) / sent) * 10_000) / 100 : 0
  metrics.complaint_trend = sent > 0 ? Math.round((complaints / sent) * 10_000) / 100 : 0
  metrics.warmup_trend = input.warmupProgress ?? 0

  const engagementRate = sent > 0 ? ((opens + clicks + replies) / sent) * 100 : 0
  metrics.engagement_trend = Math.round(engagementRate * 100) / 100

  const fatigueFromVolume = sent > 500 ? Math.min(40, Math.round(sent / 50)) : 0
  const fatigueFromBounces = metrics.bounce_trend * 2
  const fatigueFromComplaints = metrics.complaint_trend * 10
  const engagementDrop =
    input.previousEngagementRate != null && input.previousEngagementRate > 0
      ? Math.max(0, ((input.previousEngagementRate - engagementRate) / input.previousEngagementRate) * 100)
      : 0
  metrics.fatigue_score = Math.min(
    100,
    Math.round(fatigueFromVolume + fatigueFromBounces + fatigueFromComplaints + engagementDrop),
  )

  return metrics
}

export function senderHealthScore(metrics: GrowthSenderPerformanceMetrics): number {
  const tier = tierFromSenderReputationScore(metrics.reputation_score)
  const tierPenalty = tier === "healthy" ? 0 : tier === "monitor" ? 10 : tier === "warning" ? 25 : 45
  return Math.max(0, Math.min(100, Math.round(metrics.reputation_score - tierPenalty - metrics.fatigue_score * 0.3)))
}

export function senderPerformanceTrend(metrics: GrowthSenderPerformanceMetrics): GrowthPerformanceTrend {
  return detectPerformanceTrend({
    current: metrics.engagement_trend,
    previous: Math.max(metrics.engagement_trend, metrics.warmup_trend),
    higherIsBetter: true,
  })
}

export function mergeSenderMetrics(
  base: GrowthSenderPerformanceMetrics,
  delta: Partial<GrowthSenderPerformanceMetrics>,
): GrowthSenderPerformanceMetrics {
  return buildSenderPerformanceMetrics({
    sent: (base.deliverability > 0 ? 100 : 0) + (delta.deliverability ?? 0),
    hardBounces: Math.round(base.bounce_trend),
    complaints: Math.round(base.complaint_trend),
    warmupProgress: base.warmup_trend + (delta.warmup_trend ?? 0),
    cleanDays: Math.round(base.reputation_score / 10),
  })
}
