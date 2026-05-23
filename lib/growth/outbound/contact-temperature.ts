import type { GrowthContactTemperature, GrowthLeadEmailEventSummary } from "@/lib/growth/outbound/types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export function computeGrowthContactTemperature(input: {
  status: GrowthLeadStatus
  emailSummary: GrowthLeadEmailEventSummary
}): GrowthContactTemperature {
  if (input.emailSummary.isSuppressed) return "suppressed"

  if (
    input.emailSummary.interestedReply7d ||
    input.status === "call_ready" ||
    (input.emailSummary.latestReplyClassification === "interested" && input.emailSummary.replyCount14d > 0)
  ) {
    return "hot"
  }

  if (
    input.emailSummary.replyCount14d > 0 ||
    input.emailSummary.clickCount14d > 0 ||
    input.status === "replied" ||
    input.status === "in_outreach"
  ) {
    return "engaged"
  }

  if (input.emailSummary.sentCount14d > 0 || input.emailSummary.openCount14d > 0) {
    return "warming"
  }

  return "cold"
}
