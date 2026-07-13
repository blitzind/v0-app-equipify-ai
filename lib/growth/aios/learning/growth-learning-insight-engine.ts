/** GE-AI-3D — Generate read-only learning insights from normalized outcomes (client-safe). */

import {
  GROWTH_LEARNING_MIN_SAMPLE_SIZE,
  type GrowthLearningInsight,
  type GrowthLearningOutcome,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

function averageConfidence(outcomes: GrowthLearningOutcome[]): number {
  if (outcomes.length === 0) return 0
  return outcomes.reduce((sum, row) => sum + row.confidence, 0) / outcomes.length
}

function insightStatus(sampleSize: number): GrowthLearningInsight["status"] {
  if (sampleSize < GROWTH_LEARNING_MIN_SAMPLE_SIZE) return "not_enough_data"
  return "advisory"
}

export function generateChannelPerformanceInsight(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight {
  const channelOutcomes = input.outcomes.filter(
    (row) =>
      row.dimensions.channel &&
      ["reply", "positive_intent", "meeting_booked", "completed"].includes(row.outcomeType),
  )

  const byChannel = new Map<string, GrowthLearningOutcome[]>()
  for (const row of channelOutcomes) {
    const channel = row.dimensions.channel!
    const bucket = byChannel.get(channel) ?? []
    bucket.push(row)
    byChannel.set(channel, bucket)
  }

  const ranked = [...byChannel.entries()].sort((a, b) => b[1].length - a[1].length)
  const top = ranked[0]
  const second = ranked[1]
  const sampleSize = channelOutcomes.length

  if (!top) {
    return {
      id: `insight:channel:${input.organizationId}:${input.generatedAt}`,
      organizationId: input.organizationId,
      insightType: "channel_performance",
      title: "Channel performance",
      summary: "No channel outcome signals observed yet.",
      recommendedAdjustment: "monitor",
      targetSystem: "communication_engine",
      confidence: 0,
      impact: 0,
      sampleSize: 0,
      evidence: [],
      status: "not_enough_data",
      createdAt: input.generatedAt,
    }
  }

  const smsCount = byChannel.get("sms")?.length ?? 0
  const emailCount = byChannel.get("email")?.length ?? 0
  const smsOutperforming = smsCount > emailCount && smsCount >= GROWTH_LEARNING_MIN_SAMPLE_SIZE

  return {
    id: `insight:channel:${input.organizationId}:${input.generatedAt}`,
    organizationId: input.organizationId,
    insightType: "channel_performance",
    title: smsOutperforming ? "SMS outperforming email" : `Top channel: ${top[0]}`,
    summary: smsOutperforming
      ? "SMS reply and positive-intent outcomes exceed email in recent observations — advisory only."
      : `${top[0]} shows the strongest recent positive outcome density (${top[1].length} signals).`,
    recommendedAdjustment: smsOutperforming ? "test_variant" : "monitor",
    targetSystem: "communication_engine",
    confidence: averageConfidence(top[1]),
    impact: Math.min(1, top[1].length / 10),
    sampleSize,
    evidence: top[1].slice(0, 5),
    status: insightStatus(sampleSize),
    createdAt: input.generatedAt,
  }
}

export function generateApprovalFrictionInsight(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight {
  const approvalOutcomes = input.outcomes.filter((row) => row.source === "human_approval")
  const rejected = approvalOutcomes.filter((row) => row.outcomeType === "rejected").length
  const approved = approvalOutcomes.filter((row) => row.outcomeType === "approved").length
  const sampleSize = approvalOutcomes.length
  const rejectionRate = sampleSize > 0 ? rejected / sampleSize : 0

  return {
    id: `insight:approval:${input.organizationId}:${input.generatedAt}`,
    organizationId: input.organizationId,
    insightType: "approval_friction",
    title: rejectionRate >= 0.4 ? "Elevated approval friction" : "Approval friction stable",
    summary:
      sampleSize === 0
        ? "No human approval outcomes observed yet."
        : `${approved} approved vs ${rejected} rejected/cancelled in recent observations.`,
    recommendedAdjustment: rejectionRate >= 0.4 ? "human_review" : "monitor",
    targetSystem: "revenue_director",
    confidence: averageConfidence(approvalOutcomes),
    impact: rejectionRate,
    sampleSize,
    evidence: approvalOutcomes.slice(0, 5),
    status: insightStatus(sampleSize),
    createdAt: input.generatedAt,
  }
}

export function generateOutboundRiskInsight(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight {
  const negative = input.outcomes.filter((row) =>
    ["bounce", "unsubscribe", "opt_out", "failed", "negative_intent"].includes(row.outcomeType),
  )
  const sampleSize = negative.length

  return {
    id: `insight:outbound-risk:${input.organizationId}:${input.generatedAt}`,
    organizationId: input.organizationId,
    insightType: "outbound_risk",
    title: sampleSize >= GROWTH_LEARNING_MIN_SAMPLE_SIZE ? "Outbound risk signals present" : "Outbound risk monitoring",
    summary:
      sampleSize === 0
        ? "No negative outbound outcomes observed."
        : `${sampleSize} bounce, unsubscribe, opt-out, or failure outcomes in recent window.`,
    recommendedAdjustment: sampleSize >= GROWTH_LEARNING_MIN_SAMPLE_SIZE ? "pause" : "monitor",
    targetSystem: "campaign_optimization",
    confidence: averageConfidence(negative),
    impact: Math.min(1, sampleSize / 8),
    sampleSize,
    evidence: negative.slice(0, 5),
    status: insightStatus(sampleSize),
    createdAt: input.generatedAt,
  }
}

export function generateObjectiveProgressInsight(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight {
  const progress = input.outcomes.filter((row) =>
    ["meeting_booked", "completed", "converted", "positive_intent"].includes(row.outcomeType),
  )
  const sampleSize = progress.length

  return {
    id: `insight:objective:${input.organizationId}:${input.generatedAt}`,
    organizationId: input.organizationId,
    insightType: "objective_progress",
    title: "Objective progress signals",
    summary:
      sampleSize === 0
        ? "No objective progress outcomes observed yet."
        : `${sampleSize} completion, meeting, or positive-intent outcomes support objective progress.`,
    recommendedAdjustment: "monitor",
    targetSystem: "priority_engine",
    confidence: averageConfidence(progress),
    impact: Math.min(1, sampleSize / 12),
    sampleSize,
    evidence: progress.slice(0, 5),
    status: insightStatus(sampleSize),
    createdAt: input.generatedAt,
  }
}

export function generateMessagePerformanceInsight(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight {
  const themed = input.outcomes.filter(
    (row) =>
      row.dimensions.messageTheme &&
      ["reply", "positive_intent", "negative_intent", "completed"].includes(row.outcomeType),
  )

  const byTheme = new Map<string, GrowthLearningOutcome[]>()
  for (const row of themed) {
    const theme = row.dimensions.messageTheme!
    const bucket = byTheme.get(theme) ?? []
    bucket.push(row)
    byTheme.set(theme, bucket)
  }

  const ranked = [...byTheme.entries()].sort((a, b) => b[1].length - a[1].length)
  const top = ranked[0]
  const sampleSize = themed.length

  if (!top) {
    return {
      id: `insight:message:${input.organizationId}:${input.generatedAt}`,
      organizationId: input.organizationId,
      insightType: "message_performance",
      title: "Observation theme performance",
      summary: "No observation-theme reply signals observed yet.",
      recommendedAdjustment: "monitor",
      targetSystem: "outreach_preparation",
      confidence: 0,
      impact: 0,
      sampleSize: 0,
      evidence: [],
      status: "not_enough_data",
      createdAt: input.generatedAt,
    }
  }

  const positive = top[1].filter((row) =>
    ["reply", "positive_intent", "completed"].includes(row.outcomeType),
  ).length
  const positiveRate = top[1].length > 0 ? positive / top[1].length : 0

  return {
    id: `insight:message:${input.organizationId}:${input.generatedAt}`,
    organizationId: input.organizationId,
    insightType: "message_performance",
    title: `Top observation theme: ${top[0]}`,
    summary: `${top[0]} shows ${top[1].length} recent outcomes (${Math.round(positiveRate * 100)}% positive/reply density) — advisory for future opener selection.`,
    recommendedAdjustment: positiveRate >= 0.35 ? "test_variant" : "monitor",
    targetSystem: "outreach_preparation",
    confidence: averageConfidence(top[1]),
    impact: Math.min(1, top[1].length / 10),
    sampleSize,
    evidence: top[1].slice(0, 5),
    status: insightStatus(sampleSize),
    createdAt: input.generatedAt,
  }
}

export function synthesizeGrowthLearningInsights(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
}): GrowthLearningInsight[] {
  return [
    generateChannelPerformanceInsight(input),
    generateMessagePerformanceInsight(input),
    generateApprovalFrictionInsight(input),
    generateOutboundRiskInsight(input),
    generateObjectiveProgressInsight(input),
  ].sort((a, b) => b.impact - a.impact || b.confidence - a.confidence)
}

export function buildGrowthLearningAdvisoryContext(input: {
  insights: GrowthLearningInsight[]
}): import("@/lib/growth/aios/learning/growth-closed-loop-learning-types").GrowthLearningAdvisoryContext {
  const topInsight =
    input.insights.find((row) => row.status === "advisory") ??
    input.insights[0] ??
    null

  const riskInsight = input.insights.find((row) => row.insightType === "outbound_risk")
  const channelInsight = input.insights.find((row) => row.insightType === "channel_performance")
  const approvalInsight = input.insights.find((row) => row.insightType === "approval_friction")
  const objectiveInsight = input.insights.find((row) => row.insightType === "objective_progress")

  const riskTrend: "stable" | "rising" | "falling" | "unknown" =
    riskInsight && riskInsight.sampleSize >= GROWTH_LEARNING_MIN_SAMPLE_SIZE
      ? riskInsight.impact >= 0.35
        ? "rising"
        : "stable"
      : "unknown"

  return {
    topInsight,
    riskTrend,
    channelTrend: channelInsight?.title ?? null,
    approvalFriction: approvalInsight?.impact ?? null,
    objectiveProgressSignal: objectiveInsight?.summary ?? null,
  }
}

export function buildGrowthLearningCommunicationAdvisory(input: {
  insights: GrowthLearningInsight[]
}): import("@/lib/growth/aios/learning/growth-closed-loop-learning-types").GrowthLearningCommunicationAdvisory {
  const channelInsight = input.insights.find(
    (row) => row.insightType === "channel_performance" && row.status === "advisory",
  )

  if (!channelInsight) {
    return {
      readOnly: true,
      advisoryNote: null,
      channelComparison: null,
    }
  }

  const smsOutperforming = channelInsight.title.toLowerCase().includes("sms")
  return {
    readOnly: true,
    advisoryNote: smsOutperforming
      ? "Advisory: SMS is outperforming email in recent learning outcomes — ranking weights unchanged."
      : channelInsight.summary,
    channelComparison: smsOutperforming ? "SMS > email (advisory)" : channelInsight.title,
  }
}
