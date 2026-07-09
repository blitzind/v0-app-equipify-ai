/** GE-AIOS-10B — Urgency scoring (0–100, deterministic). */

import type { DecisionCandidate } from "@/lib/growth/decision-engine/types"

const BASE: Record<DecisionCandidate["kind"], number> = {
  review_approval: 95,
  review_reply: 88,
  meeting_prep: 82,
  prepare_outreach: 76,
  continue_qualification: 68,
  research_company: 62,
  continue_mission: 48,
  request_business_clarification: 55,
  refresh_bi: 45,
  wait: 5,
}

const PRIORITY_BOOST: Record<NonNullable<DecisionCandidate["queuePriority"]>, number> = {
  critical: 10,
  high: 6,
  medium: 2,
  low: 0,
}

export function scoreUrgency(candidate: DecisionCandidate): number {
  let score = BASE[candidate.kind] ?? 50

  if (typeof candidate.severity === "number") {
    score += Math.min(15, candidate.severity * 3)
  }
  if (candidate.queuePriority) score += PRIORITY_BOOST[candidate.queuePriority]
  if (candidate.requiresHumanApproval) score += 8
  if (candidate.blocked) score -= 20

  return Math.min(100, Math.max(0, Math.round(score)))
}
