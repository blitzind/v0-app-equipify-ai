import type {
  GrowthConversationUrgencyLevel,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

export function computeGrowthConversationUrgency(
  input: GrowthLeadConversationInput,
): GrowthConversationUrgencyLevel {
  let score = 0

  for (const signal of input.signals) {
    if (signal.kind === "urgency_detected") score += signal.points
    if (signal.kind.startsWith("call_interested")) score += 6
  }

  if (score >= 16) return "critical"
  if (score >= 10) return "high"
  if (score >= 6) return "medium"
  if (score >= 3) return "low"
  return "none"
}
