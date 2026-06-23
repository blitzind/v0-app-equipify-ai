/** GE-AUTO-1C — Deterministic outbound prepare confidence scoring (client-safe). */

export type GrowthAutonomyConfidenceInput = {
  intentType?: string | null
  eventIntensity?: number | null
  leadScore?: number | null
  engagementScore?: number | null
  recencyHours?: number | null
  priorReplyStatus?: "none" | "replied" | "bounced" | null
  bookingStatus?: "none" | "started" | "completed" | null
}

const HIGH_INTENT_TYPES = new Set([
  "pricing",
  "buying_intent",
  "booking",
  "demo_request",
  "strong_buying_signal",
])

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeOptionalScore(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return clampScore(value)
}

/**
 * Deterministic 0–100 confidence score for channel prepare decisions.
 * No ML — weighted heuristics from available lead/signal context.
 */
export function scoreAutonomyOutboundConfidence(input: GrowthAutonomyConfidenceInput): number {
  let score = 20

  const intent = String(input.intentType ?? "").toLowerCase()
  if (HIGH_INTENT_TYPES.has(intent)) score += 25
  else if (intent) score += 10

  score += normalizeOptionalScore(input.eventIntensity, 0) * 0.15
  score += normalizeOptionalScore(input.leadScore, 0) * 0.2
  score += normalizeOptionalScore(input.engagementScore, 0) * 0.15

  if (typeof input.recencyHours === "number" && Number.isFinite(input.recencyHours)) {
    if (input.recencyHours <= 2) score += 15
    else if (input.recencyHours <= 24) score += 10
    else if (input.recencyHours <= 72) score += 5
    else score -= 5
  }

  if (input.priorReplyStatus === "replied") score += 10
  if (input.priorReplyStatus === "bounced") score -= 20

  if (input.bookingStatus === "completed") score += 15
  else if (input.bookingStatus === "started") score += 12

  return clampScore(score)
}
