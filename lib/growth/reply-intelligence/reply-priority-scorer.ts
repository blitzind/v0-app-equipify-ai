import type {
  GrowthReplyEscalationSignal,
  GrowthReplyIntent,
  GrowthReplyPriority,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { ReplyIntentClassificationResult } from "@/lib/growth/reply-intelligence/reply-intent-classifier"

export function scoreReplyPriority(input: {
  intent: GrowthReplyIntent
  confidence: number
  escalationSignals: GrowthReplyEscalationSignal[]
  threadReplyCount: number
}): GrowthReplyPriority {
  if (input.intent === "meeting_request" || input.intent === "unsubscribe") return "critical"
  if (input.intent === "competitor_mention" && input.confidence >= 0.7) return "critical"
  if (input.intent === "positive_interest" && input.escalationSignals.length > 0) return "critical"

  if (
    input.intent === "positive_interest" ||
    input.intent === "pricing_question" ||
    input.intent === "competitor_mention"
  ) {
    return "high"
  }

  if (input.intent === "objection" || input.intent === "timing_delay" || input.intent === "referral") {
    return "medium"
  }

  if (input.intent === "support_request" && input.threadReplyCount > 1) return "medium"

  return "low"
}

export function scoreReplyPriorityFromClassification(result: ReplyIntentClassificationResult, threadReplyCount: number): GrowthReplyPriority {
  return scoreReplyPriority({
    intent: result.intent,
    confidence: result.confidence,
    escalationSignals: result.escalationSignals,
    threadReplyCount,
  })
}
