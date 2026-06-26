/** GE-AIOS-2H — Deterministic confidence calculator (client-safe). Constitutional §13.2. */

import {
  clampDecisionConfidence,
  type AiDecisionEvidenceRef,
} from "@/lib/growth/aios/ai-decision-record-types"
import { resolveDecisionConfidenceBand } from "@/lib/growth/aios/ai-decision-engine-types"

export function calculateDecisionEngineConfidence(evidence: AiDecisionEvidenceRef[]): number {
  if (evidence.length === 0) return 0

  let weighted = 0
  let totalWeight = 0

  for (const ref of evidence) {
    const trust = typeof ref.trust === "number" ? ref.trust : 50
    const weight = typeof ref.weight === "number" ? ref.weight : 1
    weighted += trust * weight
    totalWeight += weight
  }

  let confidence = totalWeight > 0 ? weighted / totalWeight : 0

  if (evidence.length >= 3) confidence += 5
  if (evidence.some((ref) => ref.evidenceKey.startsWith("memory."))) confidence += 3

  return clampDecisionConfidence(Math.round(confidence))
}

export function isDecisionEngineEvidenceSufficient(confidence: number): boolean {
  return resolveDecisionConfidenceBand(confidence) !== "insufficient"
}
