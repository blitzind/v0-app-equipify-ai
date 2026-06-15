/** Phase GS-3E — Deterministic human intervention prioritization (client-safe). */

import type {
  HumanIntervention,
  HumanInterventionFilter,
  HumanInterventionPriority,
  HumanInterventionResolution,
  HumanInterventionType,
} from "@/lib/growth/human-interventions/human-intervention-types"

const PRIORITY_RANK: Record<HumanInterventionPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const TYPE_BOOST: Record<HumanInterventionType, number> = {
  risk_detected: 28,
  approval_required: 26,
  reply_required: 24,
  high_intent: 22,
  campaign_blocked: 20,
  channel_issue: 18,
  opportunity: 14,
  manual_review: 10,
}

const RESOLUTION_PENALTY: Record<HumanInterventionResolution["resolution_status"], number> = {
  pending: 0,
  reviewed: -25,
  dismissed: -100,
  resolved: -30,
}

export function scoreHumanIntervention(intervention: HumanIntervention): number {
  const priorityScore = PRIORITY_RANK[intervention.priority] * 25
  const typeBoost = TYPE_BOOST[intervention.intervention_type] ?? 0
  const resolutionPenalty = RESOLUTION_PENALTY[intervention.resolution.resolution_status] ?? 0
  const recencyMs = Date.now() - Date.parse(intervention.occurred_at)
  const recencyBoost =
    Number.isFinite(recencyMs) && recencyMs <= 6 * 60 * 60 * 1000
      ? Math.round(12 * (1 - recencyMs / (6 * 60 * 60 * 1000)))
      : 0
  const evidenceBoost = Math.min(10, intervention.trigger.evidence.length * 2)

  return priorityScore + typeBoost + resolutionPenalty + recencyBoost + evidenceBoost
}

export function rankHumanInterventions(interventions: HumanIntervention[]): HumanIntervention[] {
  return [...interventions].sort((left, right) => {
    const scoreDiff = scoreHumanIntervention(right) - scoreHumanIntervention(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.occurred_at.localeCompare(left.occurred_at)
  })
}

export function filterHumanInterventions(
  interventions: HumanIntervention[],
  filter: HumanInterventionFilter,
): HumanIntervention[] {
  switch (filter) {
    case "urgent":
      return interventions.filter(
        (item) => item.priority === "urgent" || item.priority === "high",
      )
    case "replies":
      return interventions.filter((item) => item.intervention_type === "reply_required")
    case "approvals":
      return interventions.filter((item) => item.intervention_type === "approval_required")
    case "risks":
      return interventions.filter(
        (item) =>
          item.intervention_type === "risk_detected" ||
          item.intervention_type === "campaign_blocked" ||
          item.intervention_type === "channel_issue",
      )
    case "opportunities":
      return interventions.filter(
        (item) =>
          item.intervention_type === "opportunity" || item.intervention_type === "high_intent",
      )
    default:
      return interventions.filter((item) => item.resolution.resolution_status !== "dismissed")
  }
}
