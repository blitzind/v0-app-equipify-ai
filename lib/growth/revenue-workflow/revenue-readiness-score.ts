/** Sprint 4 — composite revenue readiness scoring. */

import type {
  GrowthRevenueReadinessInput,
  GrowthRevenueReadinessRisk,
  GrowthRevenueReadinessSignal,
  GrowthRevenueReadinessSnapshot,
  GrowthRevenueReadinessTier,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import {
  GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  revenueReadinessTierFromScore,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function computeRevenueReadiness(input: GrowthRevenueReadinessInput): GrowthRevenueReadinessSnapshot {
  const positives: GrowthRevenueReadinessSignal[] = []
  const risks: GrowthRevenueReadinessRisk[] = []
  let score = 0

  if (input.relationshipStage === "opportunity") {
    score += 18
    positives.push({ kind: "relationship_stage", label: "Relationship stage: opportunity", points: 18 })
  } else if (input.relationshipStage === "evaluating") {
    score += 12
    positives.push({ kind: "relationship_stage", label: "Relationship stage: evaluating", points: 12 })
  }

  if (input.engagementTrend === "warming" || input.engagementTrend === "stable") {
    score += 8
    positives.push({ kind: "engagement_trend", label: `Engagement trend: ${input.engagementTrend}`, points: 8 })
  } else if (input.engagementTrend === "declining" || input.engagementTrend === "cooling") {
    score -= 10
    risks.push({ kind: "engagement_trend", label: "Engagement trend cooling", severity: "high" })
  }

  if (input.replyCount30d > 0) {
    const points = Math.min(15, input.replyCount30d * 5)
    score += points
    positives.push({ kind: "reply_activity", label: `${input.replyCount30d} recent repl${input.replyCount30d === 1 ? "y" : "ies"}`, points })
  }

  if (input.buyingSignalCount > 0) {
    const points = Math.min(20, input.buyingSignalCount * 6)
    score += points
    positives.push({ kind: "buying_signals", label: `${input.buyingSignalCount} buying signal(s)`, points })
  }

  if (input.meetingIntentSignals > 0) {
    score += 12
    positives.push({ kind: "meeting_intent", label: "Meeting intent detected", points: 12 })
  }

  if (input.pricingIntentSignals > 0) {
    score += 10
    positives.push({ kind: "pricing_intent", label: "Pricing intent detected", points: 10 })
  }

  if (input.commitmentCount > 0) {
    const commitmentPoints = Math.min(12, input.commitmentCount * 4)
    score += commitmentPoints
    positives.push({
      kind: "commitments",
      label: `${input.commitmentCount} recorded commitment(s)`,
      points: commitmentPoints,
    })
  }

  if (input.connectedCallCount > 0) {
    score += Math.min(14, input.connectedCallCount * 7)
    positives.push({ kind: "call_activity", label: `${input.connectedCallCount} connected call(s)`, points: 14 })
  }

  if (input.meetingActivityCount > 0) {
    score += 8
    positives.push({ kind: "meeting_activity", label: "Meeting activity on record", points: 8 })
  }

  if (input.hasPositiveReply) {
    score += 10
    positives.push({ kind: "positive_reply", label: "Positive reply received", points: 10 })
  }

  if (input.opportunityReadinessScore != null) {
    const points = Math.round(input.opportunityReadinessScore * 0.2)
    score += points
    positives.push({ kind: "opportunity_readiness", label: "Opportunity readiness influence", points })
  }

  if (input.memoryCoverageScore != null && input.memoryCoverageScore >= 40) {
    const points = Math.round(input.memoryCoverageScore * 0.1)
    score += points
    positives.push({ kind: "memory_coverage", label: `Memory coverage ${input.memoryCoverageScore}%`, points })
  } else if (input.memoryCoverageScore != null && input.memoryCoverageScore < 20) {
    risks.push({ kind: "memory_coverage", label: "Low relationship memory coverage", severity: "medium" })
    score -= 5
  }

  if (input.unresolvedObjectionCount > 0) {
    score -= input.unresolvedObjectionCount * 8
    risks.push({
      kind: "objections",
      label: `${input.unresolvedObjectionCount} unresolved objection(s)`,
      severity: input.unresolvedObjectionCount >= 2 ? "high" : "medium",
    })
  }

  if (input.workflowHealth === "stalled" || input.workflowHealth === "blocked") {
    score -= 12
    risks.push({ kind: "workflow_health", label: `Workflow ${input.workflowHealth}`, severity: "high" })
  }

  const finalScore = clamp(score)
  const tier: GrowthRevenueReadinessTier = revenueReadinessTierFromScore(finalScore)

  return {
    score: finalScore,
    tier,
    summary: buildSummary(tier, positives, risks),
    topPositiveSignals: positives.sort((a, b) => b.points - a.points).slice(0, 5),
    topRisks: risks.slice(0, 5),
    computedAt: new Date().toISOString(),
    qaMarker: GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  }
}

function buildSummary(
  tier: GrowthRevenueReadinessTier,
  positives: GrowthRevenueReadinessSignal[],
  risks: GrowthRevenueReadinessRisk[],
): string {
  const lead = positives[0]?.label ?? "Limited revenue signals"
  const risk = risks[0]?.label
  if (tier === "revenue_ready" || tier === "sales_ready") {
    return `${lead}. Revenue readiness is strong — human should confirm next pipeline action.`
  }
  if (risk) return `${lead}. Primary risk: ${risk}.`
  return `${lead}. Continue nurturing before advancing pipeline.`
}
