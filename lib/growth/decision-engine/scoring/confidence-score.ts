/** GE-AIOS-10B — Confidence scoring (0–100, deterministic). */

import type { DecisionCandidate, DecisionContext } from "@/lib/growth/decision-engine/types"
import { applyMemoryConfidenceBoost } from "@/lib/growth/memory/bridges/decision-memory"

export function scoreConfidence(candidate: DecisionCandidate, context: DecisionContext): number {
  if (typeof candidate.confidencePercent === "number") {
    const base = Math.min(100, Math.max(0, Math.round(candidate.confidencePercent)))
    return Math.min(100, base + applyMemoryConfidenceBoost(candidate, context))
  }

  let score = 60

  if (candidate.qualificationComplete) score += 18
  if (candidate.readyForOutreach) score += 12
  if (context.businessUnderstanding.hasApprovedProfile) score += 8
  if (context.businessUnderstanding.hasBusinessResearch) score += 5
  if (typeof context.evidenceConfidence === "number") {
    score = Math.round(score * 0.7 + context.evidenceConfidence * 0.3)
  }
  if (candidate.blocked) score -= 25

  score += applyMemoryConfidenceBoost(candidate, context)

  return Math.min(100, Math.max(0, Math.round(score)))
}
