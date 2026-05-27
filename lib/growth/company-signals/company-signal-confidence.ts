import type { GrowthCompanySignalEvidenceTier } from "@/lib/growth/company-signals/company-signal-types"

const SINGLE_WEAK_CAP = 0.5
const OBSERVED_BASE = 0.62
const INFERRED_BASE = 0.38
const EVIDENCE_BONUS = 0.08
const MAX_CONFIDENCE = 0.92

export function scoreCompanySignalConfidence(input: {
  tier: GrowthCompanySignalEvidenceTier
  evidence_count: number
  pattern_strength?: "strong" | "moderate" | "weak"
}): number {
  const count = Math.max(1, input.evidence_count)
  let score = input.tier === "observed" ? OBSERVED_BASE : INFERRED_BASE

  if (input.pattern_strength === "strong") score += 0.12
  else if (input.pattern_strength === "moderate") score += 0.06

  if (count > 1) {
    score += Math.min(0.2, (count - 1) * EVIDENCE_BONUS)
  }

  if (count === 1 && input.pattern_strength === "weak") {
    score = Math.min(score, SINGLE_WEAK_CAP)
  }

  if (input.tier === "inferred") {
    score = Math.min(score, 0.55)
  }

  return Number(Math.min(MAX_CONFIDENCE, Math.max(0.15, score)).toFixed(3))
}
