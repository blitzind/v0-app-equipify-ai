/** Provider health aggregation — Phase 5B. Visibility only, no auto-switch. */

import type { ProviderHealthMetric } from "@/lib/voice/observability/types"
import {
  VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
} from "@/lib/voice/observability/types"

export type ProviderHealthEventRow = {
  sourceProvider: string | null
  eventType: string
  latencyMs: number | null
  metadata: Record<string, unknown>
}

const KNOWN_PROVIDERS = [
  "deterministic",
  "deepgram",
  "openai_realtime",
  "elevenlabs",
  "stub",
  "twilio",
  "retell",
] as const

export function aggregateProviderHealthMetrics(
  events: ProviderHealthEventRow[],
  windowHours: number,
): ProviderHealthMetric[] {
  const byProvider = new Map<string, ProviderHealthEventRow[]>()

  for (const event of events) {
    const provider = event.sourceProvider?.trim() || "unknown"
    const list = byProvider.get(provider) ?? []
    list.push(event)
    byProvider.set(provider, list)
  }

  const providers = [...byProvider.entries()].map(([providerId, rows]) => {
    const sampleCount = rows.length
    const latencies = rows.map((r) => r.latencyMs).filter((v): v is number => typeof v === "number" && v >= 0)
    const avgLatencyMs =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

    const timeouts = rows.filter((r) => r.eventType.includes("timeout")).length
    const fallbacks = rows.filter((r) => r.eventType.includes("fallback") || r.eventType === "provider_fallback").length
    const errors = rows.filter((r) => r.eventType.includes("error") || r.eventType.includes("failed")).length

    const timeoutRate = sampleCount > 0 ? Math.round((timeouts / sampleCount) * 1000) / 10 : 0
    const fallbackRate = sampleCount > 0 ? Math.round((fallbacks / sampleCount) * 1000) / 10 : 0
    const errorRate = sampleCount > 0 ? Math.round((errors / sampleCount) * 1000) / 10 : 0

    const degradationDetected = timeoutRate >= 5 || fallbackRate >= 10 || errorRate >= 5 || avgLatencyMs >= 3000

    let recommendation = "Provider operating within expected bounds."
    if (degradationDetected) {
      recommendation = VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED
        ? "Degradation detected — review provider configuration. Auto-switch disabled; operator action required."
        : "Degradation detected."
    } else if (fallbackRate > 0) {
      recommendation = "Fallback events observed — monitor provider configuration."
    }

    return {
      providerId,
      sampleCount,
      avgLatencyMs,
      timeoutRate,
      fallbackRate,
      errorRate,
      degradationDetected,
      recommendation,
    }
  })

  for (const known of KNOWN_PROVIDERS) {
    if (!providers.some((p) => p.providerId === known)) {
      providers.push({
        providerId: known,
        sampleCount: 0,
        avgLatencyMs: 0,
        timeoutRate: 0,
        fallbackRate: 0,
        errorRate: 0,
        degradationDetected: false,
        recommendation: "No events in rolling window.",
      })
    }
  }

  return providers.sort((a, b) => b.sampleCount - a.sampleCount).slice(0, 12)
}

export function detectProviderDegradation(metrics: ProviderHealthMetric[]): ProviderHealthMetric[] {
  return metrics.filter((m) => m.degradationDetected)
}
