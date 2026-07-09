/** GE-AIOS-12A — Memory → Decision Engine bridge (confidence boosts, no duplicate scoring). */

import type { DecisionCandidate, DecisionContext } from "@/lib/growth/decision-engine/types"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
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

  return boost
}

export function buildMemoryDecisionReasons(memorySummary: AvaMemorySummary | null | undefined): string[] {
  if (!memorySummary) return []
  return memorySummary.detected_patterns.slice(0, 2).map((row) => row.label)
}
