import type { GrowthCommandAction, GrowthCommandActionKind } from "@/lib/growth/command/command-action-types"
import { COMMAND_ACTION_BASE_IMPACT, COMMAND_ACTION_EFFORT_MINUTES } from "@/lib/growth/command/command-action-catalog"

export function computeCommandActionImpact(input: {
  kind: GrowthCommandActionKind
  executivePriorityTier?: string | null
  revenueTrajectory?: string | null
  revenueProbabilityScore?: number | null
  conversationUrgency?: string | null
  enrollmentStalled?: boolean
  overdueFollowUp?: boolean
  dealIntelligenceBoost?: number
  callIntelligenceBoost?: number
  growthSignalBoost?: number
  externalSignalBoost?: number
}): number {
  let score = COMMAND_ACTION_BASE_IMPACT[input.kind]

  if (input.executivePriorityTier === "executive_now") score += 12
  else if (input.executivePriorityTier === "priority") score += 6

  if (input.revenueTrajectory === "at_risk") score += 10
  else if (input.revenueTrajectory === "slowing") score += 4

  if ((input.revenueProbabilityScore ?? 0) >= 75) score += 5

  if (input.conversationUrgency === "critical") score += 8
  else if (input.conversationUrgency === "high") score += 4

  if (input.enrollmentStalled) score += 6
  if (input.overdueFollowUp) score += 5
  if (input.dealIntelligenceBoost) score += input.dealIntelligenceBoost
  if (input.callIntelligenceBoost) score += input.callIntelligenceBoost
  if (input.growthSignalBoost) score += input.growthSignalBoost
  if (input.externalSignalBoost) score += input.externalSignalBoost

  score -= Math.round(COMMAND_ACTION_EFFORT_MINUTES[input.kind] / 5)

  return Math.max(0, Math.min(100, score))
}

export function estimateRevenueInfluence(input: {
  revenueProbabilityScore?: number | null
  forecastContributionWeight?: number | null
  executivePriorityTier?: string | null
}): number {
  let influence = Math.round((input.revenueProbabilityScore ?? 20) * 0.6)
  influence += Math.round((input.forecastContributionWeight ?? 0) * 20)
  if (input.executivePriorityTier === "executive_now") influence += 15
  return Math.max(5, Math.min(100, influence))
}

export function rankCommandActions(actions: GrowthCommandAction[]): GrowthCommandAction[] {
  const byLeadKind = new Map<string, GrowthCommandAction>()

  for (const action of [...actions].sort((a, b) => b.impactScore - a.impactScore)) {
    const key = `${action.leadId}:${action.kind}`
    if (!byLeadKind.has(key)) byLeadKind.set(key, action)
  }

  const deduped = [...byLeadKind.values()]
  const perLeadCount = new Map<string, number>()
  const result: GrowthCommandAction[] = []

  for (const action of deduped.sort((a, b) => b.impactScore - a.impactScore)) {
    const count = perLeadCount.get(action.leadId) ?? 0
    if (count >= 2) continue
    perLeadCount.set(action.leadId, count + 1)
    result.push(action)
  }

  return result
}

export function selectFocusSprintActions(actions: GrowthCommandAction[]): GrowthCommandAction[] {
  const picked: GrowthCommandAction[] = []
  const used = new Set<string>()

  const pick = (predicate: (action: GrowthCommandAction) => boolean) => {
    const match = actions.find((action) => !used.has(action.id) && predicate(action))
    if (!match) return
    picked.push(match)
    used.add(match.id)
  }

  pick((action) => action.kind === "start_call_copilot" || action.kind === "follow_up_now")
  pick((action) => action.kind === "approve_outreach" || action.kind === "review_draft")
  pick((action) => action.kind === "approve_outreach" || action.kind === "queue_sequence_step" || action.kind === "confirm_sequence")
  pick((action) => action.kind === "run_research")
  pick((action) => action.kind === "confirm_sequence" || action.kind === "queue_sequence_step")

  return picked.slice(0, 5)
}

export function computeMomentumState(input: {
  actionsCompletedToday: number
  approvalsWaiting: number
  revenueAtRisk: number
  criticalActions: number
}): { state: "momentum_building" | "execution_slipping" | "revenue_at_risk" | "stable"; label: string } {
  if (input.revenueAtRisk >= 5 && input.actionsCompletedToday < 2) {
    return { state: "revenue_at_risk", label: "Revenue At Risk" }
  }
  if (input.approvalsWaiting >= 8 && input.actionsCompletedToday < input.approvalsWaiting / 2) {
    return { state: "execution_slipping", label: "Execution Slipping" }
  }
  if (input.actionsCompletedToday >= 4 && input.criticalActions <= input.actionsCompletedToday) {
    return { state: "momentum_building", label: "Momentum Building" }
  }
  return { state: "stable", label: "Stable" }
}

export function computeOperatorScore(input: {
  actionsCompleted: number
  sequencesAdvanced: number
  forecastProtected: number
  relationshipsRecovered: number
  approvalsWaiting: number
  executiveAlertsIgnored: number
}): number {
  let score =
    input.actionsCompleted * 25 +
    input.sequencesAdvanced * 20 +
    input.forecastProtected * 15 +
    input.relationshipsRecovered * 20
  score -= input.approvalsWaiting * 3
  score -= input.executiveAlertsIgnored * 8
  return Math.max(0, score)
}
