import type { DealIntelligenceOperatorAction } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import type { GrowthCommandActionKind } from "@/lib/growth/command/command-action-types"

export function dealIntelligenceActionImpactBoost(input: {
  dealCloseProbability?: number | null
  dealRiskLevel?: string | null
  recommendedOperatorAction?: DealIntelligenceOperatorAction | null
}): number {
  let boost = 0
  if ((input.dealCloseProbability ?? 0) >= 70) boost += 4
  else if ((input.dealCloseProbability ?? 0) >= 55) boost += 2
  if (input.dealRiskLevel === "critical") boost += 6
  else if (input.dealRiskLevel === "high") boost += 3
  if (input.recommendedOperatorAction === "call_prospect") boost += 2
  if (input.recommendedOperatorAction === "send_followup") boost += 2
  return boost
}

export function mapDealIntelligenceActionToCommandKind(
  action: DealIntelligenceOperatorAction | null | undefined,
): GrowthCommandActionKind | null {
  switch (action) {
    case "call_prospect":
      return "start_call_copilot"
    case "send_followup":
      return "follow_up_now"
    case "schedule_meeting":
      return "follow_up_now"
    case "review_research":
      return "run_research"
    case "update_opportunity":
    case "manual_review":
      return "revenue_rescue"
    default:
      return null
  }
}
