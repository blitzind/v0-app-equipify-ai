import type {
  DealIntelligenceOperatorAction,
  DealIntelligenceRiskLevel,
  DealIntelligenceScoreInputs,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function recommendDealOperatorAction(input: {
  scoreInputs: DealIntelligenceScoreInputs
  riskLevel: DealIntelligenceRiskLevel
  closeProbability: number
  unansweredReplies: number
  meetingsScheduled: number
  researchConfidence: number | null
}): DealIntelligenceOperatorAction {
  if (input.unansweredReplies > 0) return "send_followup"
  if (input.scoreInputs.meetingNoShows && input.scoreInputs.meetingNoShows > 0) return "call_prospect"
  if (input.meetingsScheduled === 0 && input.closeProbability >= 45) return "schedule_meeting"
  if (input.riskLevel === "critical" || input.riskLevel === "high") {
    if (input.scoreInputs.closeDateOverdue || input.scoreInputs.isStale) return "update_opportunity"
    if (!input.scoreInputs.hasOwner) return "manual_review"
    return "call_prospect"
  }
  if ((input.researchConfidence ?? 0) < 40) return "review_research"
  if (input.scoreInputs.overdueFollowUp) return "send_followup"
  if (input.closeProbability >= 65 && input.meetingsScheduled > 0) return "update_opportunity"
  if (input.closeProbability < 35 && input.riskLevel === "low") return "wait"
  return "manual_review"
}

export function dealNeedsOperatorAction(action: DealIntelligenceOperatorAction): boolean {
  return action !== "wait"
}
