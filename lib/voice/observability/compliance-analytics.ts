/** Compliance analytics — Phase 5B. Factual only, no legal compliance score. */

import type { VoiceObservabilityComplianceSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export type ComplianceSourceCounts = {
  blocked24h: number
  manualReview24h: number
  optOut24h: number
  callHourViolation24h: number
  consentUnknown24h: number
  suppression24h: number
  channelRisk: Map<string, { blocked: number; manualReview: number }>
  auditTrend: Map<string, number>
}

export function buildComplianceAnalyticsSnapshot(
  counts: ComplianceSourceCounts,
): VoiceObservabilityComplianceSnapshot {
  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    blockedCount24h: counts.blocked24h,
    manualReviewCount24h: counts.manualReview24h,
    optOutCount24h: counts.optOut24h,
    callHourViolationCount24h: counts.callHourViolation24h,
    consentUnknownCount24h: counts.consentUnknown24h,
    suppressionCount24h: counts.suppression24h,
    channelRisk: [...counts.channelRisk.entries()]
      .map(([channel, risk]) => ({ channel, blocked: risk.blocked, manualReview: risk.manualReview }))
      .sort((a, b) => b.blocked + b.manualReview - (a.blocked + a.manualReview))
      .slice(0, 10),
    auditEventTrend: [...counts.auditTrend.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    message: "Compliance analytics — factual audit trends. No legal compliance score.",
  }
}

export function emptyComplianceSourceCounts(): ComplianceSourceCounts {
  return {
    blocked24h: 0,
    manualReview24h: 0,
    optOut24h: 0,
    callHourViolation24h: 0,
    consentUnknown24h: 0,
    suppression24h: 0,
    channelRisk: new Map(),
    auditTrend: new Map(),
  }
}

export function incrementChannelRisk(
  map: Map<string, { blocked: number; manualReview: number }>,
  channel: string,
  kind: "blocked" | "manualReview",
): void {
  const key = channel || "unknown"
  const current = map.get(key) ?? { blocked: 0, manualReview: 0 }
  if (kind === "blocked") current.blocked += 1
  else current.manualReview += 1
  map.set(key, current)
}
