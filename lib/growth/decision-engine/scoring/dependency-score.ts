/** GE-AIOS-10B — Dependency / blocker scoring (0–100, higher = fewer blockers). */

import type { DecisionCandidate } from "@/lib/growth/decision-engine/types"

export function scoreDependencies(candidate: DecisionCandidate): number {
  const blockedCount = candidate.blockedBy?.length ?? 0
  const dependsCount = candidate.dependsOn?.length ?? 0

  if (candidate.blocked) return Math.max(0, 30 - blockedCount * 10)

  let score = 100 - blockedCount * 18 - dependsCount * 8

  if (candidate.kind === "review_approval" && blockedCount === 0) {
    score = 95
  }
  if (candidate.kind === "prepare_outreach" && candidate.readyForOutreach && blockedCount === 0) {
    score = 90
  }

  return Math.min(100, Math.max(0, Math.round(score)))
}
