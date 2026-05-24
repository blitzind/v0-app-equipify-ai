import type {
  GrowthConversationSentiment,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

export function computeGrowthConversationSentiment(
  input: GrowthLeadConversationInput,
): GrowthConversationSentiment {
  let positive = 0
  let negative = 0

  for (const signal of input.signals) {
    if (signal.kind === "positive_sentiment" || signal.kind.startsWith("email_reply_interested")) {
      positive += 1
    }
    if (
      signal.kind === "negative_sentiment" ||
      signal.kind.startsWith("email_reply_not_interested") ||
      signal.kind.startsWith("call_not_interested")
    ) {
      negative += 1
    }
    if (signal.kind.startsWith("objection_")) negative += 0.5
  }

  if (input.notInterested) return "negative"
  if (positive > 0 && negative > 0) return "mixed"
  if (negative >= 2) return "negative"
  if (positive >= 2) return "positive"
  if (negative > positive) return "negative"
  if (positive > negative) return "positive"
  return "neutral"
}
