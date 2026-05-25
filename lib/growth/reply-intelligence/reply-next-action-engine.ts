import type {
  GrowthReplyIntent,
  GrowthReplyNextAction,
  GrowthReplyPriority,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { ReplyIntentClassificationResult } from "@/lib/growth/reply-intelligence/reply-intent-classifier"

export function resolveReplyNextAction(input: {
  intent: GrowthReplyIntent
  priority: GrowthReplyPriority
  hasCallablePhone: boolean
  classification: ReplyIntentClassificationResult
}): GrowthReplyNextAction {
  switch (input.intent) {
    case "meeting_request":
      return "schedule_meeting"
    case "pricing_question":
      return input.hasCallablePhone ? "call_prospect" : "reply_email"
    case "positive_interest":
      return input.hasCallablePhone ? "call_prospect" : "reply_email"
    case "competitor_mention":
      return "update_opportunity"
    case "timing_delay":
      return "follow_up_later"
    case "referral":
      return "verify_contact"
    case "objection":
      return input.priority === "high" || input.priority === "critical" ? "call_prospect" : "manual_review"
    case "not_interested":
    case "unsubscribe":
    case "wrong_contact":
    case "out_of_office":
      return "manual_review"
    case "support_request":
      return "manual_review"
    default:
      return input.priority === "critical" || input.priority === "high" ? "reply_email" : "manual_review"
  }
}
