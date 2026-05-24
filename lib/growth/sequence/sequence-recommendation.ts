import type {
  GrowthSequencePattern,
  GrowthSequenceRecommendationResult,
  GrowthSequenceTouch,
} from "@/lib/growth/sequence-types"
import {
  computeExecutiveSequenceWeight,
  computeLeadSequenceFatigueRisk,
} from "@/lib/growth/sequence/sequence-effectiveness-score"
import { countRecentTouches } from "@/lib/growth/sequence/sequence-pattern-matcher"
import type { GrowthLead } from "@/lib/growth/types"

function industryBucket(lead: GrowthLead): string {
  if (lead.fieldServiceStackDetected?.trim()) return lead.fieldServiceStackDetected.trim().toLowerCase()
  if (lead.crmDetected?.trim()) return lead.crmDetected.trim().toLowerCase()
  return "general"
}

function dominantObjectionKey(lead: GrowthLead): string | null {
  const clusters = lead.conversationObjectionProfile?.clusters ?? []
  if (clusters.length === 0) return null
  return [...clusters].sort((a, b) => b.severityWeight * b.count - a.severityWeight * a.count)[0]?.key ?? null
}

function nextUnmatchedStep(pattern: GrowthSequencePattern, touches: GrowthSequenceTouch[]) {
  const sortedSteps = [...pattern.steps].sort((a, b) => a.stepOrder - b.stepOrder)
  const completedOrders = new Set<number>()

  for (const step of sortedSteps) {
    const matched = touches.some(
      (touch) =>
        touch.channel === step.channel &&
        (!step.generationType || touch.generationType === step.generationType),
    )
    if (matched) completedOrders.add(step.stepOrder)
  }

  const next = sortedSteps.find((step) => !completedOrders.has(step.stepOrder))
  if (!next) return null

  return {
    stepOrder: next.stepOrder,
    channel: next.channel,
    generationType: next.generationType,
    delayDays: next.delayDaysMin,
    expectedSignal: next.expectedSignal,
    requiredHumanApproval: next.requiredHumanApproval,
  }
}

function patternFitScore(pattern: GrowthSequencePattern, lead: GrowthLead, touches: GrowthSequenceTouch[]): number {
  let score = pattern.sequenceQualityScore * 0.35 + pattern.confidenceScore * 0.25

  const hasReply = touches.some((touch) => touch.channel === "reply")
  const dormant =
    lead.engagementLastActivityAt != null
      ? (Date.now() - Date.parse(lead.engagementLastActivityAt)) / (24 * 60 * 60 * 1000) > 45
      : false

  if (pattern.key === "follow_up_after_reply" && hasReply) score += 25
  if (pattern.key === "reengagement_sequence" && dormant) score += 25
  if (pattern.key === "email_then_call" && lead.contactPhone) score += 12
  if (pattern.key === "cold_email_only" && !hasReply && lead.status === "in_outreach") score += 10

  if (pattern.key === "executive_follow_up") {
    score += computeExecutiveSequenceWeight({
      executivePriorityTier: lead.executivePriorityTier,
      relationshipStrengthTier: lead.relationshipStrengthTier,
      fitScore: lead.score,
    })
  }

  const bucket = industryBucket(lead)
  const objection = dominantObjectionKey(lead)
  if (bucket !== "general") score += 5
  if (objection && pattern.key === "follow_up_after_reply") score += 8
  if (lead.conversationBuyingIntent === "strong" || lead.conversationBuyingIntent === "urgent") {
    if (pattern.key === "email_then_call" || pattern.key === "call_then_email") score += 10
  }

  if (pattern.sequenceFatigueRisk === "high") score -= 20
  else if (pattern.sequenceFatigueRisk === "medium") score -= 10

  return score
}

export function recommendGrowthSequencePattern(input: {
  lead: GrowthLead
  patterns: GrowthSequencePattern[]
  touches: GrowthSequenceTouch[]
  now?: Date
}): GrowthSequenceRecommendationResult {
  const now = input.now ?? new Date()
  const lead = input.lead

  if (lead.contactTemperature === "suppressed" || lead.status === "disqualified" || lead.status === "archived") {
    return {
      patternId: null,
      patternKey: null,
      reason: null,
      confidence: 0,
      nextStep: null,
      fatigueRisk: "none",
    }
  }

  const fatigueRisk = computeLeadSequenceFatigueRisk(countRecentTouches(input.touches, 14, now))
  if (fatigueRisk === "high") {
    return {
      patternId: null,
      patternKey: null,
      reason: "High sequence fatigue — pause outreach before starting a new pattern.",
      confidence: 0,
      nextStep: null,
      fatigueRisk,
    }
  }

  const eligible = input.patterns.filter(
    (pattern) => pattern.isActive && pattern.attemptCount >= 0 && pattern.confidenceScore >= 0,
  )

  let best: { pattern: GrowthSequencePattern; score: number } | null = null
  for (const pattern of eligible) {
    if (pattern.key === "executive_follow_up") {
      const execWeight = computeExecutiveSequenceWeight({
        executivePriorityTier: lead.executivePriorityTier,
        relationshipStrengthTier: lead.relationshipStrengthTier,
        fitScore: lead.score,
      })
      if (execWeight < 40) continue
    }

    const score = patternFitScore(pattern, lead, input.touches)
    if (!best || score > best.score) {
      best = { pattern, score }
    }
  }

  if (!best || best.score < 35) {
    return {
      patternId: null,
      patternKey: null,
      reason: null,
      confidence: 0,
      nextStep: null,
      fatigueRisk,
    }
  }

  const confidence = Math.max(
    0,
    Math.min(100, Math.round(best.score * 0.6 + best.pattern.confidenceScore * 0.4)),
  )

  if (confidence < 40) {
    return {
      patternId: null,
      patternKey: null,
      reason: null,
      confidence,
      nextStep: null,
      fatigueRisk,
    }
  }

  const nextStep = nextUnmatchedStep(best.pattern, input.touches)
  const reason = `${best.pattern.label}: quality ${best.pattern.sequenceQualityScore}, ${Math.round(best.pattern.positiveReplyRate * 100)}% positive reply rate`

  return {
    patternId: best.pattern.id,
    patternKey: best.pattern.key,
    reason,
    confidence,
    nextStep,
    fatigueRisk,
  }
}

export function deriveLeadIndustryBucket(lead: GrowthLead): string {
  return industryBucket(lead)
}

export function deriveDominantObjectionKey(lead: GrowthLead): string | null {
  return dominantObjectionKey(lead)
}
