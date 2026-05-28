/** Provider degradation detection — Phase 5B. Recommendations only. */

import type { ProviderHealthMetric } from "@/lib/voice/observability/types"

export type DegradationSignal = {
  providerId: string
  signal: "timeout_spike" | "fallback_spike" | "error_spike" | "latency_spike"
  severity: "warning" | "critical"
  evidence: string
}

export function detectDegradationSignals(metrics: ProviderHealthMetric[]): DegradationSignal[] {
  const signals: DegradationSignal[] = []

  for (const metric of metrics) {
    if (metric.sampleCount < 3) continue

    if (metric.timeoutRate >= 15) {
      signals.push({
        providerId: metric.providerId,
        signal: "timeout_spike",
        severity: "critical",
        evidence: `Timeout rate ${metric.timeoutRate}% in rolling window.`,
      })
    } else if (metric.timeoutRate >= 5) {
      signals.push({
        providerId: metric.providerId,
        signal: "timeout_spike",
        severity: "warning",
        evidence: `Timeout rate ${metric.timeoutRate}% in rolling window.`,
      })
    }

    if (metric.fallbackRate >= 20) {
      signals.push({
        providerId: metric.providerId,
        signal: "fallback_spike",
        severity: "critical",
        evidence: `Fallback rate ${metric.fallbackRate}% in rolling window.`,
      })
    } else if (metric.fallbackRate >= 10) {
      signals.push({
        providerId: metric.providerId,
        signal: "fallback_spike",
        severity: "warning",
        evidence: `Fallback rate ${metric.fallbackRate}% in rolling window.`,
      })
    }

    if (metric.avgLatencyMs >= 5000) {
      signals.push({
        providerId: metric.providerId,
        signal: "latency_spike",
        severity: "critical",
        evidence: `Average latency ${metric.avgLatencyMs}ms exceeds threshold.`,
      })
    } else if (metric.avgLatencyMs >= 3000) {
      signals.push({
        providerId: metric.providerId,
        signal: "latency_spike",
        severity: "warning",
        evidence: `Average latency ${metric.avgLatencyMs}ms elevated.`,
      })
    }

    if (metric.errorRate >= 10) {
      signals.push({
        providerId: metric.providerId,
        signal: "error_spike",
        severity: "critical",
        evidence: `Error rate ${metric.errorRate}% in rolling window.`,
      })
    }
  }

  return signals
}
