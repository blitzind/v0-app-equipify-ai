/** GE-AIOS-10B — Approval gate scoring (0–100, deterministic). */

import type { DecisionCandidate } from "@/lib/growth/decision-engine/types"

export function scoreApprovalGate(candidate: DecisionCandidate): number {
  if (candidate.kind === "review_approval") {
    return Math.min(100, 85 + (candidate.severity ?? 0) * 3)
  }
  if (candidate.requiresHumanApproval) {
    return 72
  }
  if (candidate.blocked && candidate.blockedBy?.some((row) => /approval|approve/i.test(row))) {
    return 88
  }
  return 20
}
