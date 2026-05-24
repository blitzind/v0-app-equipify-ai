import type { GrowthSequenceFatigueRisk, GrowthSequencePatternOutcome } from "@/lib/growth/sequence-types"

export type GrowthSequenceEffectivenessMetrics = {
  attemptCount: number
  replyRate: number
  positiveReplyRate: number
  meetingSignalRate: number
  followUpCompletionRate: number
  sequenceAbandonmentRate: number
  opportunityLift: number
  revenueProbabilityLift: number
  conversationHealthLift: number
  averageTimeToReplyHours: number | null
  averageTouchesToPositiveSignal: number | null
  sequenceQualityScore: number
  sequenceFatigueRisk: GrowthSequenceFatigueRisk
  confidenceScore: number
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeSequenceEffectivenessMetrics(
  outcomes: GrowthSequencePatternOutcome[],
): GrowthSequenceEffectivenessMetrics {
  const attemptCount = outcomes.length
  if (attemptCount === 0) {
    return {
      attemptCount: 0,
      replyRate: 0,
      positiveReplyRate: 0,
      meetingSignalRate: 0,
      followUpCompletionRate: 0,
      sequenceAbandonmentRate: 0,
      opportunityLift: 0,
      revenueProbabilityLift: 0,
      conversationHealthLift: 0,
      averageTimeToReplyHours: null,
      averageTouchesToPositiveSignal: null,
      sequenceQualityScore: 0,
      sequenceFatigueRisk: "none",
      confidenceScore: 0,
    }
  }

  const replyRate = outcomes.filter((o) => o.gotReply).length / attemptCount
  const positiveReplyRate = outcomes.filter((o) => o.gotPositiveReply).length / attemptCount
  const meetingSignalRate = outcomes.filter((o) => o.gotMeetingSignal).length / attemptCount
  const followUpCompletionRate = outcomes.filter((o) => o.followUpCompleted).length / attemptCount
  const sequenceAbandonmentRate = outcomes.filter((o) => o.abandoned).length / attemptCount

  const opportunityLift = avg(
    outcomes
      .filter((o) => o.opportunityScoreBefore != null && o.opportunityScoreAfter != null)
      .map((o) => (o.opportunityScoreAfter ?? 0) - (o.opportunityScoreBefore ?? 0)),
  )

  const revenueProbabilityLift = avg(
    outcomes
      .filter((o) => o.revenueProbabilityBefore != null && o.revenueProbabilityAfter != null)
      .map((o) => (o.revenueProbabilityAfter ?? 0) - (o.revenueProbabilityBefore ?? 0)),
  )

  const conversationHealthLift = avg(
    outcomes
      .filter((o) => o.conversationHealthBefore != null && o.conversationHealthAfter != null)
      .map((o) => (o.conversationHealthAfter ?? 0) - (o.conversationHealthBefore ?? 0)),
  )

  const replyTimes = outcomes.map((o) => o.timeToReplyHours).filter((v): v is number => v != null)
  const touchCounts = outcomes
    .map((o) => o.touchesToPositiveSignal)
    .filter((v): v is number => v != null)

  const qualityRaw =
    positiveReplyRate * 35 +
    meetingSignalRate * 25 +
    followUpCompletionRate * 15 +
    Math.max(0, opportunityLift) * 0.5 +
    Math.max(0, conversationHealthLift) * 0.3 -
    sequenceAbandonmentRate * 20

  const sequenceQualityScore = Math.max(0, Math.min(100, Math.round(qualityRaw)))
  const confidenceScore = Math.max(0, Math.min(100, 40 + attemptCount * 4))

  let sequenceFatigueRisk: GrowthSequenceFatigueRisk = "none"
  if (sequenceAbandonmentRate >= 0.45 || attemptCount >= 20) sequenceFatigueRisk = "high"
  else if (sequenceAbandonmentRate >= 0.3 || attemptCount >= 12) sequenceFatigueRisk = "medium"
  else if (sequenceAbandonmentRate >= 0.15 || attemptCount >= 6) sequenceFatigueRisk = "low"

  return {
    attemptCount,
    replyRate,
    positiveReplyRate,
    meetingSignalRate,
    followUpCompletionRate,
    sequenceAbandonmentRate,
    opportunityLift,
    revenueProbabilityLift,
    conversationHealthLift,
    averageTimeToReplyHours: replyTimes.length > 0 ? avg(replyTimes) : null,
    averageTouchesToPositiveSignal: touchCounts.length > 0 ? avg(touchCounts) : null,
    sequenceQualityScore,
    sequenceFatigueRisk,
    confidenceScore,
  }
}

export function computeLeadSequenceFatigueRisk(recentTouchCount14d: number): GrowthSequenceFatigueRisk {
  if (recentTouchCount14d >= 8) return "high"
  if (recentTouchCount14d >= 5) return "medium"
  if (recentTouchCount14d >= 3) return "low"
  return "none"
}

export function computeExecutiveSequenceWeight(input: {
  executivePriorityTier: string | null
  relationshipStrengthTier: string | null
  fitScore: number | null
}): number {
  let weight = 0
  if (input.executivePriorityTier === "executive_now") weight += 40
  else if (input.executivePriorityTier === "priority") weight += 28
  else if (input.executivePriorityTier === "important") weight += 16

  if (input.relationshipStrengthTier === "strategic") weight += 30
  else if (input.relationshipStrengthTier === "trusted") weight += 18

  if ((input.fitScore ?? 0) > 85) weight += 25

  return weight
}
