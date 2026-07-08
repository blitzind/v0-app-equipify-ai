/** GE-AIOS-8A-2 — Build Ava org understanding snapshots (client-safe). */

import type {
  AvaContradiction,
  AvaEvidenceItem,
  AvaFact,
  EvidenceEngineConfidence,
  EvidenceEngineDecisionTier,
  EvidenceEngineLifecycleStatus,
  EvidenceEngineProvider,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

export type EvidenceEngineSnapshotConfidenceSummary = {
  overall_confidence: number
  average_fact_confidence: number
  average_evidence_confidence: number
  lowest_fact_confidence: number
}

export type EvidenceEngineSnapshotCounts = {
  evidence_by_provider: Record<string, number>
  evidence_by_decision_tier: Record<string, number>
  needs_review_count: number
  deprecated_count: number
  expired_count: number
  contradicted_count: number
}

export type EvidenceEngineSnapshotPayload = {
  organization_id: string
  run_id: string
  generated_at: string
  source_providers: EvidenceEngineProvider[]
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: AvaContradiction[]
  confidence_summary: EvidenceEngineSnapshotConfidenceSummary
  evidence_counts: EvidenceEngineSnapshotCounts
  metadata: Record<string, unknown>
}

function averageConfidence(values: EvidenceEngineConfidence[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, item) => acc + item.overall_confidence, 0)
  return sum / values.length
}

export function buildEvidenceEngineSnapshotPayload(input: {
  organization_id: string
  run_id: string
  generated_at?: string
  source_providers: EvidenceEngineProvider[]
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: AvaContradiction[]
  metadata?: Record<string, unknown>
}): EvidenceEngineSnapshotPayload {
  const generatedAt = input.generated_at ?? new Date().toISOString()

  const evidenceByProvider: Record<string, number> = {}
  const evidenceByTier: Record<string, number> = {}
  let needsReviewCount = 0
  let deprecatedCount = 0
  let expiredCount = 0
  let contradictedCount = 0

  for (const item of input.evidence) {
    evidenceByProvider[item.provider] = (evidenceByProvider[item.provider] ?? 0) + 1
    evidenceByTier[item.decision_tier] = (evidenceByTier[item.decision_tier] ?? 0) + 1
    if (item.lifecycle_status === "needs_review") needsReviewCount += 1
    if (item.lifecycle_status === "deprecated") deprecatedCount += 1
    if (item.lifecycle_status === "expired") expiredCount += 1
    if (item.lifecycle_status === "contradicted") contradictedCount += 1
  }

  for (const fact of input.facts) {
    if (fact.lifecycle_status === "needs_review") needsReviewCount += 1
    if (fact.lifecycle_status === "deprecated") deprecatedCount += 1
    if (fact.lifecycle_status === "expired") expiredCount += 1
    if (fact.lifecycle_status === "contradicted") contradictedCount += 1
  }

  const factConfidences = input.facts.map((fact) => fact.confidence)
  const evidenceConfidences = input.evidence.map((item) => item.confidence)
  const averageFactConfidence = averageConfidence(factConfidences)
  const averageEvidenceConfidence = averageConfidence(evidenceConfidences)
  const lowestFactConfidence =
    factConfidences.length > 0
      ? Math.min(...factConfidences.map((item) => item.overall_confidence))
      : 0

  return {
    organization_id: input.organization_id,
    run_id: input.run_id,
    generated_at: generatedAt,
    source_providers: [...input.source_providers],
    evidence: input.evidence,
    facts: input.facts,
    contradictions: input.contradictions,
    confidence_summary: {
      overall_confidence: averageFactConfidence,
      average_fact_confidence: averageFactConfidence,
      average_evidence_confidence: averageEvidenceConfidence,
      lowest_fact_confidence: lowestFactConfidence,
    },
    evidence_counts: {
      evidence_by_provider: evidenceByProvider,
      evidence_by_decision_tier: evidenceByTier as Record<EvidenceEngineDecisionTier, number>,
      needs_review_count: needsReviewCount,
      deprecated_count: deprecatedCount,
      expired_count: expiredCount,
      contradicted_count: contradictedCount,
    },
    metadata: input.metadata ?? {},
  }
}

export function lifecycleCountsFromSnapshot(
  snapshot: EvidenceEngineSnapshotPayload,
): Pick<EvidenceEngineSnapshotCounts, "needs_review_count" | "deprecated_count" | "expired_count" | "contradicted_count"> {
  return {
    needs_review_count: snapshot.evidence_counts.needs_review_count,
    deprecated_count: snapshot.evidence_counts.deprecated_count,
    expired_count: snapshot.evidence_counts.expired_count,
    contradicted_count: snapshot.evidence_counts.contradicted_count,
  }
}

export function isReviewableSnapshot(snapshot: EvidenceEngineSnapshotPayload): boolean {
  return (
    snapshot.contradictions.some((item) => item.requires_human_review) ||
    snapshot.facts.some((fact) => fact.lifecycle_status === "needs_review" || fact.lifecycle_status === "contradicted")
  )
}

export type EvidenceEngineSnapshotRecord = {
  snapshot_id: string
  organization_id: string
  run_id: string
  generated_at: string
  input_hash: string
  is_current: boolean
  snapshot: EvidenceEngineSnapshotPayload
}

export function mapSnapshotLifecycleStatus(value: string): EvidenceEngineLifecycleStatus {
  if (
    value === "active" ||
    value === "needs_review" ||
    value === "contradicted" ||
    value === "deprecated" ||
    value === "expired"
  ) {
    return value
  }
  return "active"
}
