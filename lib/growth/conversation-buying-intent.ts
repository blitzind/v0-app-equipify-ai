import type {
  GrowthConversationBuyingIntent,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

export function computeGrowthConversationBuyingIntent(
  input: GrowthLeadConversationInput,
): GrowthConversationBuyingIntent {
  let score = 0

  for (const signal of input.signals) {
    if (signal.kind === "buying_intent") score += signal.points
    if (signal.kind.startsWith("email_reply_interested")) score += 12
    if (signal.kind.startsWith("call_interested")) score += 18
    if (signal.kind.startsWith("email_reply_not_interested")) score -= 15
  }

  if (input.notInterested) return "none"

  if (score >= 35) return "urgent"
  if (score >= 24) return "strong"
  if (score >= 14) return "moderate"
  if (score >= 6) return "weak"
  return "none"
}
