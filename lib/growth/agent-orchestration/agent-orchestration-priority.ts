/** Phase GS-4D — Agent orchestration prioritization (client-safe). */

import type {
  AgentOrchestrationFilter,
  GrowthAgentPlan,
  GrowthAgentRecommendation,
  GrowthAgentStatus,
  GrowthAgentTask,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"

const STATUS_RANK: Record<GrowthAgentStatus, number> = {
  blocked: 4,
  needs_review: 3,
  ready_for_human_approval: 2,
  draft: 1,
}

const TASK_PRIORITY_RANK: Record<GrowthAgentTask["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const REVIEW_PENALTY: Record<GrowthAgentPlan["review_status"], number> = {
  pending: 0,
  reviewed: -20,
  dismissed: -100,
}

export function scoreGrowthAgentPlan(plan: GrowthAgentPlan): number {
  const statusScore = STATUS_RANK[plan.plan_status] * 20
  const taskScore = plan.tasks.filter((t) => t.status === "ready" || t.status === "complete").length * 5
  const blockedPenalty = plan.tasks.filter((t) => t.status === "blocked").length * 10
  const riskPenalty = plan.risks.filter((r) => r.severity === "critical").length * 15
  const reviewPenalty = REVIEW_PENALTY[plan.review_status] ?? 0
  return Math.round(plan.plan_score + statusScore + taskScore - blockedPenalty - riskPenalty + reviewPenalty)
}

export function rankGrowthAgentPlans(plans: GrowthAgentPlan[]): GrowthAgentPlan[] {
  return [...plans].sort((left, right) => {
    const scoreDiff = scoreGrowthAgentPlan(right) - scoreGrowthAgentPlan(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.generated_at.localeCompare(left.generated_at)
  })
}

export function filterGrowthAgentPlans(
  plans: GrowthAgentPlan[],
  filter: AgentOrchestrationFilter,
): GrowthAgentPlan[] {
  switch (filter) {
    case "blocked":
      return plans.filter((p) => p.plan_status === "blocked")
    case "needs_review":
      return plans.filter((p) => p.plan_status === "needs_review")
    case "ready":
      return plans.filter((p) => p.plan_status === "ready_for_human_approval")
    default:
      return plans.filter((p) => p.review_status !== "dismissed")
  }
}

/**
 * Deterministic recommendation ranking — planning only.
 */
export function rankGrowthAgentRecommendations(
  recommendations: GrowthAgentRecommendation[],
): GrowthAgentRecommendation[] {
  const priorityRank = { high: 3, medium: 2, low: 1 }
  return [...recommendations].sort((a, b) => {
    const diff = priorityRank[b.priority] - priorityRank[a.priority]
    if (diff !== 0) return diff
    return a.title.localeCompare(b.title)
  })
}

export function rankGrowthAgentTasks(tasks: GrowthAgentTask[]): GrowthAgentTask[] {
  return [...tasks].sort((a, b) => {
    const diff = TASK_PRIORITY_RANK[b.priority] - TASK_PRIORITY_RANK[a.priority]
    if (diff !== 0) return diff
    return a.order - b.order
  })
}
