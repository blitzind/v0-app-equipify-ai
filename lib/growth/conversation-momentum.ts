import type {
  GrowthConversationMomentum,
  GrowthConversationTrend,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

export function computeGrowthConversationMomentum(
  input: GrowthLeadConversationInput,
  score: number,
  trend: GrowthConversationTrend,
): GrowthConversationMomentum {
  const now = input.now ?? new Date()

  const lastSignalAt = input.signals[0]?.occurredAt ?? null
  const daysSinceLast =
    lastSignalAt != null
      ? (now.getTime() - Date.parse(lastSignalAt)) / (24 * 60 * 60 * 1000)
      : Number.POSITIVE_INFINITY

  const recentPositive = input.signals.filter((s) => {
    const ageDays = (now.getTime() - Date.parse(s.occurredAt)) / (24 * 60 * 60 * 1000)
    return ageDays <= 14 && s.points >= 8
  }).length

  if (daysSinceLast > 21 && input.signals.length > 0) {
    return "stalling"
  }

  if (
    (input.previousTrend === "at_risk" || input.previousTrend === "cooling" || input.relationshipTrend === "cooling") &&
    trend === "improving" &&
    recentPositive >= 1
  ) {
    return "recovering"
  }

  if (trend === "improving" && (input.previousScore == null || score > input.previousScore + 5)) {
    return "accelerating"
  }

  if (trend === "cooling" || trend === "at_risk") {
    return "slowing"
  }

  return "stable"
}
