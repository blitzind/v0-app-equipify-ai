/** Deterministic session insights risk level from timeline metrics (Growth Engine slice 6.13B). */

import type { LiveCoachingSessionInsightsRiskLevel } from "@/lib/growth/realtime/live-coaching/session-insights-types"

export type SessionInsightsRiskLevelInput = {
  sessionHealthScore: number
  providerInterruptions: number
  retryAttempts: number
  fallbackCount: number
  circuitBreakerTriggered: boolean
  objectionCount: number
  competitorPressureCount: number
  providerDegradedCount: number
}

export function computeSessionInsightsRiskLevel(
  input: SessionInsightsRiskLevelInput,
): LiveCoachingSessionInsightsRiskLevel {
  if (
    input.circuitBreakerTriggered ||
    input.sessionHealthScore < 35 ||
    input.providerInterruptions >= 4 ||
    input.fallbackCount >= 2
  ) {
    return "critical"
  }

  if (
    input.sessionHealthScore < 55 ||
    input.providerInterruptions >= 2 ||
    input.retryAttempts >= 3 ||
    input.objectionCount >= 4 ||
    input.providerDegradedCount >= 2
  ) {
    return "high"
  }

  if (
    input.sessionHealthScore < 75 ||
    input.providerInterruptions >= 1 ||
    input.retryAttempts >= 1 ||
    input.objectionCount >= 2 ||
    input.competitorPressureCount >= 1 ||
    input.fallbackCount >= 1
  ) {
    return "medium"
  }

  return "low"
}

export function sessionInsightsRiskLevelTone(
  riskLevel: LiveCoachingSessionInsightsRiskLevel,
): "healthy" | "attention" | "critical" | "neutral" {
  switch (riskLevel) {
    case "critical":
      return "critical"
    case "high":
      return "critical"
    case "medium":
      return "attention"
    default:
      return "healthy"
  }
}
