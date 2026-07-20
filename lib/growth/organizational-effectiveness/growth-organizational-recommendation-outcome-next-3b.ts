/** GE-AIOS-NEXT-3B — Recommendation outcome evidence (client-safe). */

import type {
  GrowthEvidenceCompletenessClassification,
  GrowthRecommendationOutcomeFinding,
} from "./growth-organizational-evidence-completeness-next-3b-types"

export function buildRecommendationOutcomeFinding(input: {
  workflowRequestsTotal: number
  workflowRequestsAcceptedInPeriod: number
  workflowRequestsCompletedInPeriod: number
  packageApprovedInPeriod: number
}): GrowthRecommendationOutcomeFinding {
  const recommendedCount = input.workflowRequestsTotal
  const acceptedCount = input.workflowRequestsAcceptedInPeriod
  const implementedCount = input.workflowRequestsCompletedInPeriod
  const observedOutcomeCount = input.packageApprovedInPeriod

  let completeness: GrowthEvidenceCompletenessClassification = "partially_available"
  if (recommendedCount === 0) completeness = "insufficient_evidence"
  else if (acceptedCount > 0 && observedOutcomeCount > 0) completeness = "available"

  let confidence: GrowthRecommendationOutcomeFinding["confidence"] = "low"
  if (acceptedCount >= 3 && observedOutcomeCount >= 1) confidence = "moderate"
  if (acceptedCount >= 5 && observedOutcomeCount >= 2 && implementedCount >= 2) confidence = "high"

  return {
    completeness,
    recommendedCount,
    acceptedCount,
    implementedCount,
    observedOutcomeCount,
    confidence,
    causationNote:
      "Accepted workflow requests and package approvals are correlated — not proof that a recommendation directly caused an outcome.",
    completenessNote:
      recommendedCount === 0
        ? "No durable revenue-director workflow requests in observation window."
        : null,
  }
}
