/** GE-AIOS-10B — Revenue impact scoring (0–100, deterministic). */

import type { DecisionCandidate, DecisionContext } from "@/lib/growth/decision-engine/types"

const BASE: Record<DecisionCandidate["kind"], number> = {
  review_approval: 88,
  prepare_outreach: 92,
  continue_qualification: 78,
  research_company: 72,
  review_reply: 80,
  meeting_prep: 74,
  continue_mission: 58,
  request_business_clarification: 42,
  refresh_bi: 38,
  wait: 8,
}

const PRIORITY_BOOST: Record<NonNullable<DecisionCandidate["queuePriority"]>, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 0,
}

export function scoreRevenueImpact(candidate: DecisionCandidate, context: DecisionContext): number {
  let score = BASE[candidate.kind] ?? 50

  if (candidate.readyForOutreach) score += 6
  if (candidate.hotCompany) score += 5
  if (candidate.qualificationComplete) score += 4
  if (candidate.queuePriority) score += PRIORITY_BOOST[candidate.queuePriority]
  if (context.businessUnderstanding.hasApprovedProfile) score += 3
  if (context.opportunities.length > 2) score += 2

  return Math.min(100, Math.max(0, Math.round(score)))
}
