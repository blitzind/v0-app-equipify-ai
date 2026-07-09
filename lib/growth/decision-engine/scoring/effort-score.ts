/** GE-AIOS-10B — Effort scoring (0–100, higher = more effort required). */

import type { DecisionCandidate } from "@/lib/growth/decision-engine/types"

const BASE_EFFORT: Record<DecisionCandidate["kind"], number> = {
  review_approval: 15,
  review_reply: 20,
  meeting_prep: 25,
  prepare_outreach: 35,
  continue_qualification: 30,
  research_company: 45,
  continue_mission: 40,
  request_business_clarification: 50,
  refresh_bi: 55,
  wait: 5,
}

export function scoreEffort(candidate: DecisionCandidate): number {
  if (typeof candidate.estimatedMinutes === "number") {
    return Math.min(100, Math.max(5, Math.round(candidate.estimatedMinutes * 1.5)))
  }
  return BASE_EFFORT[candidate.kind] ?? 35
}

export function scoreCustomerImpact(candidate: DecisionCandidate): number {
  const base: Record<DecisionCandidate["kind"], number> = {
    review_reply: 92,
    meeting_prep: 88,
    prepare_outreach: 82,
    review_approval: 78,
    continue_qualification: 70,
    research_company: 62,
    continue_mission: 55,
    request_business_clarification: 48,
    refresh_bi: 40,
    wait: 5,
  }
  let score = base[candidate.kind] ?? 50
  if (candidate.hotCompany) score += 6
  return Math.min(100, Math.max(0, Math.round(score)))
}

export function scoreBusinessUnderstanding(
  candidate: DecisionCandidate,
  profileComplete: boolean,
): number {
  if (candidate.kind === "request_business_clarification" || candidate.kind === "refresh_bi") {
    return profileComplete ? 70 : 35
  }
  return profileComplete ? 85 : 45
}
