/** GE-AIOS-8A-1 — Detect contradictions without silent AI resolution (client-safe). */

import { applyContradictionPenalty } from "@/lib/growth/evidence-engine/evidence-confidence"
import type {
  AvaContradiction,
  AvaEvidenceItem,
  AvaFact,
  EvidenceEngineContradictionSeverity,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `contradiction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeComparableValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function valuesConflict(a: string, b: string): boolean {
  const left = normalizeComparableValue(a)
  const right = normalizeComparableValue(b)
  if (!left || !right) return false
  if (left === right) return false
  if (left.includes(right) || right.includes(left)) return false
  return true
}

function severityForConflict(count: number): EvidenceEngineContradictionSeverity {
  if (count >= 3) return "high"
  if (count >= 2) return "medium"
  return "low"
}

export type ContradictionDetectionResult = {
  contradictions: AvaContradiction[]
  facts: AvaFact[]
  evidence: AvaEvidenceItem[]
  warnings: string[]
}

export function detectEvidenceContradictions(input: {
  organization_id: string
  facts: AvaFact[]
  evidence: AvaEvidenceItem[]
}): ContradictionDetectionResult {
  const contradictions: AvaContradiction[] = []
  const warnings: string[] = []
  const facts = input.facts.map((fact) => ({ ...fact }))
  const evidence = input.evidence.map((item) => ({ ...item, confidence: { ...item.confidence } }))

  const evidenceById = new Map(evidence.map((item) => [item.evidence_id, item]))

  for (const fact of facts) {
    const relatedEvidence = fact.supporting_evidence_ids
      .map((id) => evidenceById.get(id))
      .filter((item): item is AvaEvidenceItem => Boolean(item))

    const distinctValues = new Map<string, string[]>()
    for (const item of relatedEvidence) {
      const value = item.value_text?.trim()
      if (!value) continue
      const normalized = normalizeComparableValue(value)
      const bucket = distinctValues.get(normalized) ?? []
      bucket.push(item.evidence_id)
      distinctValues.set(normalized, bucket)
    }

    const valueEntries = [...distinctValues.entries()]
    if (valueEntries.length < 2) continue

    const conflictingValues: string[] = []
    const conflictingEvidenceIds = new Set<string>()

    for (let i = 0; i < valueEntries.length; i++) {
      for (let j = i + 1; j < valueEntries.length; j++) {
        const valueA = valueEntries[i]?.[0] ?? ""
        const valueB = valueEntries[j]?.[0] ?? ""
        if (!valuesConflict(valueA, valueB)) continue

        conflictingValues.push(valueA, valueB)
        for (const id of valueEntries[i]?.[1] ?? []) conflictingEvidenceIds.add(id)
        for (const id of valueEntries[j]?.[1] ?? []) conflictingEvidenceIds.add(id)
      }
    }

    const uniqueConflictingValues = [...new Set(conflictingValues)]
    if (uniqueConflictingValues.length < 2) continue

    const evidenceIds = [...conflictingEvidenceIds]
    const severity = severityForConflict(uniqueConflictingValues.length)

    fact.lifecycle_status = "contradicted"
    fact.contradicting_evidence_ids = evidenceIds
    fact.confidence = applyContradictionPenalty(fact.confidence, uniqueConflictingValues.length)

    for (const evidenceId of evidenceIds) {
      const item = evidenceById.get(evidenceId)
      if (!item) continue
      item.lifecycle_status = "contradicted"
      item.confidence = applyContradictionPenalty(item.confidence, 1)
    }

    contradictions.push({
      contradiction_id: createId(),
      organization_id: input.organization_id,
      fact_key: fact.fact_key,
      conflicting_values: uniqueConflictingValues,
      evidence_ids: evidenceIds,
      severity,
      recommended_resolution:
        "Review conflicting website evidence and confirm the correct value before Ava uses this fact.",
      requires_human_review: true,
    })

    warnings.push(
      `Contradiction detected for ${fact.fact_key}: ${uniqueConflictingValues.join(" vs ")}`,
    )
  }

  return { contradictions, facts, evidence, warnings }
}
