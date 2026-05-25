import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthResearchRecommendedAction } from "@/lib/growth/research/research-types"

const RECOMMENDATION_TO_NBA: Record<GrowthResearchRecommendedAction, GrowthNextBestAction> = {
  "Call Prospect": "call_primary_contact",
  "Enroll Sequence": "start_recommended_sequence",
  "Review Website": "fix_website_research",
  "Schedule Demo": "immediate_sales_action",
  "Follow Up": "immediate_follow_up",
  "Manual Review": "manual_review",
}

export function mapProspectResearchRecommendationToNba(
  recommendation: string | null | undefined,
): GrowthNextBestAction | null {
  if (!recommendation?.trim()) return null
  const trimmed = recommendation.trim() as GrowthResearchRecommendedAction
  if (trimmed in RECOMMENDATION_TO_NBA) {
    return RECOMMENDATION_TO_NBA[trimmed]
  }

  const lower = recommendation.toLowerCase()
  if (lower.includes("call")) return "call_primary_contact"
  if (lower.includes("sequence")) return "start_recommended_sequence"
  if (lower.includes("website")) return "fix_website_research"
  if (lower.includes("demo")) return "immediate_sales_action"
  if (lower.includes("follow")) return "immediate_follow_up"
  return "manual_review"
}

export function prospectResearchNbaReason(recommendation: string | null | undefined): string | null {
  if (!recommendation?.trim()) return null
  return `Prospect intelligence suggests: ${recommendation.trim()}`
}
