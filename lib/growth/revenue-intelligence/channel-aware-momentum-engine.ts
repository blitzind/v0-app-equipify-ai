import type { BuyingMomentumResult, BuyingMomentumInput } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"
import { computeBuyingMomentum } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"
import type { GrowthMultichannelChannel } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

export type ChannelAwareMomentumInput = BuyingMomentumInput & {
  connectedCallCount: number
  totalCallDurationSeconds: number
  meetingsBooked: number
  meetingsAttended: number
  meetingsNoShow: number
  smsTouchCount: number
  smsReplyCount: number
  channelTouchCounts: Partial<Record<GrowthMultichannelChannel | string, number>>
  engagementGapDays: number | null
}

export type ChannelAwareMomentumResult = BuyingMomentumResult & {
  callEngagementScore: number
  meetingEngagementScore: number
  smsResponsivenessScore: number
  channelDiversityScore: number
  engagementConsistencyScore: number
  channelMix: Record<string, number>
  compositeMomentumScore: number
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function computeCallEngagementScore(input: ChannelAwareMomentumInput, evidence: string[], explainability: string[]): number {
  let score = 15
  if (input.connectedCallCount > 0) {
    score += Math.min(40, input.connectedCallCount * 15)
    evidence.push(`${input.connectedCallCount} connected call(s) recorded.`)
  }
  if (input.totalCallDurationSeconds >= 300) {
    score += 25
    evidence.push(`Call duration evidence: ${Math.round(input.totalCallDurationSeconds / 60)} minutes total.`)
  } else if (input.totalCallDurationSeconds >= 60) {
    score += 12
    evidence.push("Short connected call(s) recorded.")
  }
  score = clamp(score)
  explainability.push(`Call engagement score: ${score} (${input.connectedCallCount} connected, ${input.totalCallDurationSeconds}s total).`)
  return score
}

function computeMeetingEngagementScore(input: ChannelAwareMomentumInput, evidence: string[], explainability: string[]): number {
  let score = 10
  if (input.meetingsBooked > 0) {
    score += Math.min(30, input.meetingsBooked * 15)
    evidence.push(`${input.meetingsBooked} meeting(s) booked.`)
  }
  if (input.meetingsAttended > 0) {
    score += Math.min(40, input.meetingsAttended * 20)
    evidence.push(`${input.meetingsAttended} meeting(s) attended.`)
  }
  if (input.meetingsNoShow > 0) {
    score = clamp(score - input.meetingsNoShow * 10)
    evidence.push(`${input.meetingsNoShow} meeting no-show(s) recorded.`)
  }
  score = clamp(score)
  explainability.push(
    `Meeting engagement score: ${score} (booked ${input.meetingsBooked}, attended ${input.meetingsAttended}, no-show ${input.meetingsNoShow}).`,
  )
  return score
}

function computeSmsResponsivenessScore(input: ChannelAwareMomentumInput, explainability: string[]): number {
  if (input.smsTouchCount === 0) {
    explainability.push("SMS responsiveness score: 0 (no SMS touches).")
    return 0
  }
  const rate = input.smsReplyCount / Math.max(1, input.smsTouchCount)
  const score = clamp(Math.round(rate * 100))
  explainability.push(`SMS responsiveness score: ${score} (${input.smsReplyCount}/${input.smsTouchCount} responsive).`)
  return score
}

function computeChannelDiversityScore(
  channelTouchCounts: Partial<Record<string, number>>,
  explainability: string[],
  evidence: string[],
): number {
  const activeChannels = Object.entries(channelTouchCounts).filter(([, count]) => (count ?? 0) > 0)
  const diversity = activeChannels.length
  if (diversity >= 3) evidence.push(`Multi-channel engagement across ${diversity} channels.`)
  const score = clamp(Math.min(100, diversity * 22))
  explainability.push(`Channel diversity score: ${score} (${diversity} active channel(s)).`)
  return score
}

function computeEngagementConsistencyScore(input: ChannelAwareMomentumInput, explainability: string[]): number {
  if (input.engagementGapDays == null) {
    explainability.push("Engagement consistency score: 50 (no gap evidence).")
    return 50
  }
  if (input.engagementGapDays <= 3) {
    explainability.push(`Engagement consistency score: 90 (last touch ${input.engagementGapDays}d ago).`)
    return 90
  }
  if (input.engagementGapDays <= 7) {
    explainability.push(`Engagement consistency score: 65 (last touch ${input.engagementGapDays}d ago).`)
    return 65
  }
  explainability.push(`Engagement consistency score: 25 (engagement gap ${input.engagementGapDays}d).`)
  return 25
}

/** Deterministic channel-aware momentum — explainable, evidence-backed weighting. */
export function computeChannelAwareBuyingMomentum(input: ChannelAwareMomentumInput): ChannelAwareMomentumResult {
  const base = computeBuyingMomentum(input)
  const explainability = [...base.explainability]
  const evidence = [...base.evidence]

  const callEngagementScore = computeCallEngagementScore(input, evidence, explainability)
  const meetingEngagementScore = computeMeetingEngagementScore(input, evidence, explainability)
  const smsResponsivenessScore = computeSmsResponsivenessScore(input, explainability)
  const channelDiversityScore = computeChannelDiversityScore(input.channelTouchCounts, explainability, evidence)
  const engagementConsistencyScore = computeEngagementConsistencyScore(input, explainability)

  const channelMix: Record<string, number> = {}
  for (const [channel, count] of Object.entries(input.channelTouchCounts)) {
    if ((count ?? 0) > 0) channelMix[channel] = count ?? 0
  }

  const compositeMomentumScore = clamp(
    Math.round(
      base.momentumScore * 0.45 +
        callEngagementScore * 0.15 +
        meetingEngagementScore * 0.15 +
        smsResponsivenessScore * 0.05 +
        channelDiversityScore * 0.1 +
        engagementConsistencyScore * 0.1,
    ),
  )
  explainability.push(`Channel-aware composite momentum: ${compositeMomentumScore}/100.`)

  let momentumTrend = base.momentumTrend
  if (input.priorMomentumScore != null) {
    const delta = compositeMomentumScore - input.priorMomentumScore
    if (delta >= 10) momentumTrend = "accelerating"
    else if (delta <= -10) momentumTrend = "cooling"
    else if (compositeMomentumScore < 30) momentumTrend = "stalled"
  }

  return {
    ...base,
    momentumScore: compositeMomentumScore,
    momentumTrend,
    callEngagementScore,
    meetingEngagementScore,
    smsResponsivenessScore,
    channelDiversityScore,
    engagementConsistencyScore,
    channelMix,
    compositeMomentumScore,
    explainability,
    evidence,
  }
}
