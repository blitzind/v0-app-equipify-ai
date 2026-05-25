/** Client-safe Live Coaching session insights rollup types (Growth Engine slice 6.13B). */

export const LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const

export type LiveCoachingSessionInsightsRiskLevel =
  (typeof LIVE_COACHING_SESSION_INSIGHTS_RISK_LEVELS)[number]

export type LiveCoachingSessionInsightsRollup = {
  sessionId: string
  leadId: string
  sessionDurationMs: number
  providerId: string | null
  transcriptFinalizedCount: number
  guidanceGeneratedCount: number
  objectionCount: number
  buyingSignalCount: number
  discoveryGapCount: number
  competitorPressureCount: number
  providerInterruptions: number
  reconnectAttempts: number
  retryAttempts: number
  fallbackCount: number
  averageTranscriptLatencyMs: number
  maxTranscriptLatencyMs: number
  sessionHealthScore: number
  riskLevel: LiveCoachingSessionInsightsRiskLevel
  meetingModeUsed: boolean
  meetingProvider: string | null
  mixedAudioUsed: boolean
  meetingCaptureFailures: number
  computedAt: string
}

export type LiveCoachingSessionInsightsPreview = Pick<
  LiveCoachingSessionInsightsRollup,
  | "sessionHealthScore"
  | "riskLevel"
  | "providerId"
  | "transcriptFinalizedCount"
  | "providerInterruptions"
  | "retryAttempts"
  | "sessionDurationMs"
>

export type LiveCoachingSessionInsightsPayload = {
  rollup: LiveCoachingSessionInsightsRollup | null
  qaProof: {
    marker: string
    label: string
    verified: boolean
  }
}
