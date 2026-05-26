import type {
  GrowthBuyingStage,
  GrowthBuyingStageAssessmentCandidate,
  GrowthBuyingStageScoreContribution,
} from "@/lib/growth/buying-stage/buying-stage-types"

const STAGE_POINTS: Partial<Record<GrowthBuyingStage, number>> = {
  active_opportunity: 10,
  purchase_ready: 9,
  existing_customer_expansion: 8,
  comparison: 7,
  vendor_evaluation: 6,
  solution_research: 5,
  problem_identified: 4,
  retention_risk: 3,
  awareness: 2,
}

export function computeBuyingStageScoreContribution(
  assessment: GrowthBuyingStageAssessmentCandidate | null,
): GrowthBuyingStageScoreContribution {
  if (!assessment) {
    return { points: 0, reasons: [], breakdown: {}, confidence_boost: 0 }
  }

  const reasons: string[] = []
  const breakdown: Record<string, number> = {}
  let points = STAGE_POINTS[assessment.detected_stage] ?? 3

  breakdown.buying_stage_base = points
  reasons.push(
    `Buying stage ${assessment.detected_stage.replace(/_/g, " ")} (+${points}) — candidate assessment only.`,
  )

  if (assessment.signal_summary.length >= 3) {
    breakdown.buying_stage_corroboration = 2
    points += 2
    reasons.push("Multiple corroborating buying signals (+2).")
  }

  if (assessment.stage_confidence >= 0.7) {
    breakdown.buying_stage_high_confidence = 2
    points += 2
    reasons.push("Higher-confidence buying stage assessment (+2).")
  }

  points = Math.min(12, points)

  return {
    points,
    reasons,
    breakdown,
    confidence_boost: Number(Math.min(0.12, assessment.stage_confidence * 0.1).toFixed(3)),
  }
}
