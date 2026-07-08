/** GE-AIOS-8A-1 — Evidence confidence calculation (client-safe). */

import type { EvidenceEngineConfidence } from "@/lib/growth/evidence-engine/evidence-engine-types"

export const EVIDENCE_CONFIDENCE_MIN = 0 as const
export const EVIDENCE_CONFIDENCE_MAX = 1 as const

/** Default freshness half-life before confidence decays (30 days). */
export const EVIDENCE_FRESHNESS_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000

export const EVIDENCE_CONTRADICTION_PENALTY = 0.2 as const
export const EVIDENCE_STALE_PENALTY_CAP = 0.35 as const

export type EvidenceConfidenceDimensions = {
  evidence_confidence: number
  extraction_confidence: number
  verification_confidence: number
  freshness_confidence: number
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return EVIDENCE_CONFIDENCE_MIN
  return Math.min(EVIDENCE_CONFIDENCE_MAX, Math.max(EVIDENCE_CONFIDENCE_MIN, value))
}

/** Weighted blend of the four confidence dimensions. */
export function calculateOverallEvidenceConfidence(
  dimensions: EvidenceConfidenceDimensions,
): number {
  const evidence = clampConfidence(dimensions.evidence_confidence)
  const extraction = clampConfidence(dimensions.extraction_confidence)
  const verification = clampConfidence(dimensions.verification_confidence)
  const freshness = clampConfidence(dimensions.freshness_confidence)

  const overall =
    evidence * 0.35 + extraction * 0.3 + verification * 0.2 + freshness * 0.15

  return clampConfidence(overall)
}

export function buildEvidenceConfidence(
  dimensions: EvidenceConfidenceDimensions,
): EvidenceEngineConfidence {
  const normalized: EvidenceConfidenceDimensions = {
    evidence_confidence: clampConfidence(dimensions.evidence_confidence),
    extraction_confidence: clampConfidence(dimensions.extraction_confidence),
    verification_confidence: clampConfidence(dimensions.verification_confidence),
    freshness_confidence: clampConfidence(dimensions.freshness_confidence),
  }

  return {
    ...normalized,
    overall_confidence: calculateOverallEvidenceConfidence(normalized),
  }
}

export function defaultFreshnessConfidence(extractedAt: string, now = Date.now()): number {
  const extractedMs = Date.parse(extractedAt)
  if (!Number.isFinite(extractedMs)) return 0.5

  const ageMs = Math.max(0, now - extractedMs)
  const ratio = ageMs / EVIDENCE_FRESHNESS_HALF_LIFE_MS
  return clampConfidence(Math.exp(-ratio * Math.LN2))
}

export function applyStaleEvidencePenalty(
  confidence: EvidenceEngineConfidence,
  extractedAt: string,
  now = Date.now(),
): EvidenceEngineConfidence {
  const freshness = defaultFreshnessConfidence(extractedAt, now)
  const stalePenalty = clampConfidence((1 - freshness) * EVIDENCE_STALE_PENALTY_CAP)

  const adjusted = buildEvidenceConfidence({
    evidence_confidence: confidence.evidence_confidence,
    extraction_confidence: confidence.extraction_confidence,
    verification_confidence: confidence.verification_confidence,
    freshness_confidence: freshness,
  })

  return buildEvidenceConfidence({
    evidence_confidence: clampConfidence(adjusted.evidence_confidence - stalePenalty),
    extraction_confidence: adjusted.extraction_confidence,
    verification_confidence: adjusted.verification_confidence,
    freshness_confidence: adjusted.freshness_confidence,
  })
}

export function applyContradictionPenalty(
  confidence: EvidenceEngineConfidence,
  contradictionCount: number,
): EvidenceEngineConfidence {
  const penalty = clampConfidence(contradictionCount * EVIDENCE_CONTRADICTION_PENALTY)
  return buildEvidenceConfidence({
    evidence_confidence: clampConfidence(confidence.evidence_confidence - penalty),
    extraction_confidence: clampConfidence(confidence.extraction_confidence - penalty * 0.5),
    verification_confidence: clampConfidence(confidence.verification_confidence - penalty),
    freshness_confidence: confidence.freshness_confidence,
  })
}

export function mergeFactConfidence(confidences: EvidenceEngineConfidence[]): EvidenceEngineConfidence {
  if (confidences.length === 0) {
    return buildEvidenceConfidence({
      evidence_confidence: 0,
      extraction_confidence: 0,
      verification_confidence: 0,
      freshness_confidence: 0,
    })
  }

  const sum = confidences.reduce(
    (acc, item) => ({
      evidence_confidence: acc.evidence_confidence + item.evidence_confidence,
      extraction_confidence: acc.extraction_confidence + item.extraction_confidence,
      verification_confidence: acc.verification_confidence + item.verification_confidence,
      freshness_confidence: acc.freshness_confidence + item.freshness_confidence,
    }),
    {
      evidence_confidence: 0,
      extraction_confidence: 0,
      verification_confidence: 0,
      freshness_confidence: 0,
    },
  )

  const count = confidences.length
  return buildEvidenceConfidence({
    evidence_confidence: sum.evidence_confidence / count,
    extraction_confidence: sum.extraction_confidence / count,
    verification_confidence: sum.verification_confidence / count,
    freshness_confidence: sum.freshness_confidence / count,
  })
}
