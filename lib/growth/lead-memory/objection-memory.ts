import type { IngestedMemoryCandidate } from "@/lib/growth/lead-memory/memory-ingestion"
import { mergeConfidence } from "@/lib/growth/lead-memory/memory-ingestion"
import type { GrowthLeadObjectionMemory, GrowthMemoryConfidence } from "@/lib/growth/lead-memory/memory-types"

const OBJECTION_TYPE_FROM_TITLE: Record<string, string> = {
  "Budget objection": "budget",
  "Timing objection": "timing",
  "Authority objection": "authority",
  "Competitor mention": "competitor",
  "Not interested": "not_interested",
}

export function mapCandidateToObjection(candidate: IngestedMemoryCandidate): {
  objectionType: string
  objectionLabel: string
  severity: GrowthLeadObjectionMemory["severity"]
  confidence: GrowthMemoryConfidence
  evidenceSnippet: string
} | null {
  if (candidate.memoryCategory !== "objection") return null
  const objectionType = OBJECTION_TYPE_FROM_TITLE[candidate.title] ?? "general"
  const severity =
    objectionType === "not_interested" || objectionType === "competitor"
      ? "high"
      : objectionType === "budget"
        ? "medium"
        : "low"
  return {
    objectionType,
    objectionLabel: candidate.title,
    severity,
    confidence: candidate.confidence,
    evidenceSnippet: candidate.evidenceSnippet,
  }
}

export function rankObjections(objections: GrowthLeadObjectionMemory[]): GrowthLeadObjectionMemory[] {
  const severityRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
  return [...objections].sort((a, b) => {
    const sev = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)
    if (sev !== 0) return sev
    return b.occurrenceCount - a.occurrenceCount
  })
}

export function mergeObjectionConfidence(
  existing: GrowthMemoryConfidence,
  incoming: GrowthMemoryConfidence,
): GrowthMemoryConfidence {
  return mergeConfidence(existing, incoming)
}
