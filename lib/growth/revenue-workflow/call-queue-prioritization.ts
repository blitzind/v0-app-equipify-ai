/** Sprint 4 — call queue prioritization boost (no auto-dial, no auto tasks). */

import type { GrowthRevenueReadinessTier } from "@/lib/growth/revenue-workflow/revenue-workflow-types"

export type CallQueueRevenueWorkflowInput = {
  revenueReadinessScore?: number | null
  revenueReadinessTier?: GrowthRevenueReadinessTier | string | null
  opportunityRecommendationScore?: number | null
  replyUrgencyBoost?: number
  engagementTrend?: string | null
  meetingIntentPending?: boolean
}

export type CallQueueRevenueWorkflowBoost = {
  boostPoints: number
  priorityReason: string | null
}

export function computeCallQueueRevenueWorkflowBoost(
  input: CallQueueRevenueWorkflowInput,
): CallQueueRevenueWorkflowBoost {
  let boostPoints = 0
  const reasons: string[] = []

  if (input.revenueReadinessScore != null && input.revenueReadinessScore >= 65) {
    boostPoints += Math.round(input.revenueReadinessScore * 0.12)
    reasons.push(`revenue readiness ${input.revenueReadinessScore}`)
  } else if (input.revenueReadinessScore != null && input.revenueReadinessScore >= 45) {
    boostPoints += Math.round(input.revenueReadinessScore * 0.06)
    reasons.push(`warming revenue readiness ${input.revenueReadinessScore}`)
  }

  if (input.revenueReadinessTier === "revenue_ready" || input.revenueReadinessTier === "sales_ready") {
    boostPoints += 8
    reasons.push(String(input.revenueReadinessTier).replace(/_/g, " "))
  }

  if (input.opportunityRecommendationScore != null && input.opportunityRecommendationScore >= 50) {
    boostPoints += Math.round(input.opportunityRecommendationScore * 0.1)
    reasons.push(`opportunity rec ${input.opportunityRecommendationScore}`)
  }

  if ((input.replyUrgencyBoost ?? 0) > 0) {
    boostPoints += input.replyUrgencyBoost!
    reasons.push("reply urgency")
  }

  if (input.engagementTrend === "warming" || input.engagementTrend === "stable") {
    boostPoints += 4
    reasons.push(`engagement ${input.engagementTrend}`)
  } else if (input.engagementTrend === "cooling" || input.engagementTrend === "declining") {
    boostPoints -= 6
    reasons.push("engagement cooling")
  }

  if (input.meetingIntentPending) {
    boostPoints += 10
    reasons.push("meeting intent")
  }

  return {
    boostPoints: Math.min(25, Math.max(-10, Math.round(boostPoints))),
    priorityReason: reasons.length ? reasons.slice(0, 3).join(" · ") : null,
  }
}

export function sortCallQueueByRevenueWorkflow<T extends { effectiveScore: number; leadId: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => b.effectiveScore - a.effectiveScore || a.leadId.localeCompare(b.leadId))
}
