import type {
  GrowthProviderPerformanceMetrics,
  GrowthPerformanceTrend,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { emptyProviderMetrics } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"
import { detectPerformanceTrend } from "@/lib/growth/revenue-intelligence/trend-detector"

export function buildProviderPerformanceMetrics(input: {
  attempts?: number
  successes?: number
  failures?: number
  bounces?: number
  complaints?: number
  totalLatencyMs?: number
}): GrowthProviderPerformanceMetrics {
  const metrics = emptyProviderMetrics()
  const attempts = input.attempts ?? 0
  const successes = input.successes ?? 0
  const failures = input.failures ?? 0
  const bounces = input.bounces ?? 0
  const complaints = input.complaints ?? 0

  metrics.delivery_latency_ms = attempts > 0 ? Math.round((input.totalLatencyMs ?? 0) / attempts) : 0
  metrics.failure_pct = attempts > 0 ? Math.round((failures / attempts) * 10_000) / 100 : 0
  metrics.bounce_pct = attempts > 0 ? Math.round((bounces / attempts) * 10_000) / 100 : 0
  metrics.complaint_pct = attempts > 0 ? Math.round((complaints / attempts) * 10_000) / 100 : 0
  metrics.delivery_success_pct = attempts > 0 ? Math.round((successes / attempts) * 10_000) / 100 : 0
  metrics.route_performance_score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        metrics.delivery_success_pct -
          metrics.failure_pct * 0.5 -
          metrics.bounce_pct * 2 -
          metrics.complaint_pct * 5 -
          metrics.delivery_latency_ms / 100,
      ),
    ),
  )
  return metrics
}

export function providerHealthScore(metrics: GrowthProviderPerformanceMetrics): number {
  return Math.max(0, Math.min(100, metrics.route_performance_score))
}

export function providerPerformanceTrend(
  current: GrowthProviderPerformanceMetrics,
  previous: GrowthProviderPerformanceMetrics,
): GrowthPerformanceTrend {
  return detectPerformanceTrend({
    current: current.delivery_success_pct,
    previous: previous.delivery_success_pct,
    higherIsBetter: true,
  })
}

export function mergeProviderMetrics(
  base: GrowthProviderPerformanceMetrics,
  delta: Partial<GrowthProviderPerformanceMetrics>,
): GrowthProviderPerformanceMetrics {
  return buildProviderPerformanceMetrics({
    attempts: 100,
    successes: Math.round(base.delivery_success_pct + (delta.delivery_success_pct ?? 0)),
    failures: Math.round(base.failure_pct + (delta.failure_pct ?? 0)),
    bounces: Math.round(base.bounce_pct),
    complaints: Math.round(base.complaint_pct),
    totalLatencyMs: base.delivery_latency_ms + (delta.delivery_latency_ms ?? 0),
  })
}
