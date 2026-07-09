/** GE-AIOS-12A / GE-AIOS-17C — Memory + Knowledge → Decision Engine bridge. */

import type { DecisionCandidate, DecisionContext } from "@/lib/growth/decision-engine/types"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"
import { memoryPatternMatchesCandidate } from "@/lib/growth/memory/patterns/detect-patterns"

export function applyMemoryToDecisionContext(
  context: DecisionContext,
  memorySummary: AvaMemorySummary | null | undefined,
): DecisionContext {
  if (!memorySummary) return context
  return {
    ...context,
    memorySummary,
  }
}

export function applyMemoryConfidenceBoost(
  candidate: DecisionCandidate,
  context: DecisionContext,
): number {
  const memory = context.memorySummary
  if (!memory) return 0

  let boost = 0
  const matchedPattern = memoryPatternMatchesCandidate({
    patterns: memory.detected_patterns,
    companyName: candidate.companyName,
    kind: candidate.kind,
  })
  if (matchedPattern) {
    boost += Math.min(15, Math.round(matchedPattern.confidence / 10))
  }

  const medicalPreference = memory.preferences.find((row) =>
    /medical equipment|hospitals/i.test(row.statement),
  )
  if (medicalPreference && /medical|biomedical|hospital|health/i.test(candidate.companyName ?? candidate.title)) {
    boost += 8
  }

  const carryForward = memory.recent_events.find(
    (row) => row.category === "win" && candidate.title.includes(String(row.metadata.companyName ?? "")),
  )
  if (carryForward) boost += 5

  const knowledge = memory.organizational_knowledge ?? []
  const industry = inferIndustry(candidate.companyName ?? candidate.title)
  for (const item of knowledge) {
    if (!item.active) continue
    if (item.category === "industry" && /medical|equipment|hospital|health/i.test(item.finding) && industry === "medical_equipment") {
      boost += Math.min(12, Math.round(item.confidence / 12))
    }
    if (item.category === "persona" && /research|qualif|outreach|prepare/.test(candidate.kind)) {
      boost += Math.min(8, Math.round(item.confidence / 15))
    }
    if (item.category === "messaging" && candidate.kind === "prepare_outreach") {
      boost += Math.min(10, Math.round(item.confidence / 12))
    }
    if (item.category === "timing" && /meeting|reply|review/.test(candidate.kind)) {
      boost += Math.min(6, Math.round(item.confidence / 18))
    }
  }

  return boost
}

export function buildMemoryDecisionReasons(memorySummary: AvaMemorySummary | null | undefined): string[] {
  if (!memorySummary) return []
  const knowledgeReasons = (memorySummary.organizational_knowledge ?? [])
    .filter((row) => row.active)
    .slice(0, 2)
    .map((row) => row.finding.replace(/\.$/, ""))
  if (knowledgeReasons.length > 0) return knowledgeReasons
  return memorySummary.detected_patterns.slice(0, 2).map((row) => row.label)
}
