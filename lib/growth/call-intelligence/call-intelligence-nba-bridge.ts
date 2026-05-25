import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthCommandActionKind } from "@/lib/growth/command/command-action-types"

export function callIntelligenceActionImpactBoost(input: {
  overallScore?: number | null
  riskLevel?: string | null
  nextStepScore?: number | null
  objectionCount?: number
}): number {
  let boost = 0
  if ((input.overallScore ?? 100) < 45 || input.riskLevel === "critical") boost += 6
  else if ((input.overallScore ?? 100) < 55 || input.riskLevel === "high") boost += 3
  if ((input.nextStepScore ?? 100) < 45) boost += 4
  if ((input.objectionCount ?? 0) >= 2) boost += 3
  return boost
}

export function mapCallIntelligenceRecommendationToCommandKind(
  recommendation: string | null | undefined,
): GrowthCommandActionKind | null {
  const lower = recommendation?.toLowerCase() ?? ""
  if (lower.includes("follow-up") || lower.includes("next step")) return "follow_up_now"
  if (lower.includes("objection") || lower.includes("competitive")) return "conversation_recovery"
  if (lower.includes("advance opportunity")) return "revenue_rescue"
  if (lower.includes("outcome")) return "follow_up_now"
  return "start_call_copilot"
}

export function callIntelligenceNbaReason(scorecard: CallIntelligenceScorecardPublicView | null): string | null {
  if (!scorecard || scorecard.metrics.incomplete) return null
  return `Call intelligence suggests: ${scorecard.recommendedNextAction}`
}
