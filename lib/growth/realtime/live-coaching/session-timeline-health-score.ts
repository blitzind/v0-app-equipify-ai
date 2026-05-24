/** Deterministic session health score from timeline metrics (Growth Engine slice 6.13A). */

export type SessionTimelineHealthScoreInput = {
  providerInterruptions: number
  averageTranscriptLatencyMs: number
  reconnectCount: number
  retryCount: number
  providerDegradedEvents: number
}

export function computeSessionTimelineHealthScore(input: SessionTimelineHealthScoreInput): number {
  let score = 100
  score -= Math.min(35, input.providerInterruptions * 8)
  score -= Math.min(
    25,
    Math.max(0, Math.round((input.averageTranscriptLatencyMs - 150) / 10)),
  )
  score -= Math.min(20, input.reconnectCount * 5)
  score -= Math.min(15, input.retryCount * 4)
  score -= Math.min(25, input.providerDegradedEvents * 10)
  return Math.max(0, Math.min(100, Math.round(score)))
}
