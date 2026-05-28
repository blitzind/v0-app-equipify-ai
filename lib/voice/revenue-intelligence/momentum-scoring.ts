/** Momentum scoring — deterministic from signals and interaction cadence. */

import type { VoiceMomentumDirection } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"

export function scoreMomentum(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  buyingSignalCount: number
  objectionCount: number
  escalationCount: number
  daysSinceLastInteraction: number | null
}): { score: number; direction: VoiceMomentumDirection } {
  const { memoryEvents, buyingSignalCount, objectionCount, escalationCount, daysSinceLastInteraction } = input

  let score = 50
  score += Math.min(buyingSignalCount * 8, 24)
  score -= Math.min(objectionCount * 6, 18)
  score -= Math.min(escalationCount * 10, 20)

  const recentPositive = memoryEvents.filter((event) =>
    ["booking_interest", "urgency_signal", "positive_sentiment", "decision_maker"].includes(event.memoryType),
  ).length
  const recentNegative = memoryEvents.filter((event) =>
    ["pricing_objection", "budget_concern", "competitor_mention", "cancellation_risk", "negative_sentiment"].includes(
      event.memoryType,
    ),
  ).length

  score += Math.min(recentPositive * 5, 15)
  score -= Math.min(recentNegative * 4, 16)

  if (daysSinceLastInteraction != null) {
    if (daysSinceLastInteraction <= 7) score += 8
    else if (daysSinceLastInteraction <= 14) score += 2
    else if (daysSinceLastInteraction >= 30) score -= 12
    else if (daysSinceLastInteraction >= 21) score -= 6
  }

  score = Math.max(0, Math.min(100, score))

  let direction: VoiceMomentumDirection = "stable"
  if (score >= 70) direction = "accelerating"
  else if (score <= 30) direction = recentNegative > recentPositive ? "reversing" : "decelerating"
  else if (recentNegative > recentPositive + 1) direction = "decelerating"

  return { score, direction }
}
