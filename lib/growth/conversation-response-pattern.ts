import type {
  GrowthConversationResponsePattern,
  GrowthLeadConversationInput,
} from "@/lib/growth/conversation-types"

const MS_HOUR = 60 * 60 * 1000
const MS_DAY = 24 * MS_HOUR

export function computeGrowthConversationResponsePattern(
  input: GrowthLeadConversationInput,
): GrowthConversationResponsePattern {
  if (input.replyLatenciesMs.length === 0) {
    const hasRecentReply = input.signals.some((s) => s.kind.startsWith("email_reply_"))
    if (!hasRecentReply && input.signals.some((s) => s.source === "email")) {
      return "unresponsive"
    }
    const hasCall = input.signals.some((s) => s.source === "call")
    if (hasCall) return "normal"
    return "unresponsive"
  }

  const avgMs =
    input.replyLatenciesMs.reduce((sum, ms) => sum + ms, 0) / input.replyLatenciesMs.length

  if (avgMs <= 4 * MS_HOUR) return "very_fast"
  if (avgMs <= MS_DAY) return "fast"
  if (avgMs <= 3 * MS_DAY) return "normal"
  if (avgMs <= 14 * MS_DAY) return "slow"
  return "unresponsive"
}
