import type { GrowthBuyingMomentumTrend } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export type BuyingMomentumInput = {
  threadReplyCount: number
  responseLatencyMs: number | null
  buyingSignalCount: number
  objectionCount: number
  resolvedObjectionCount: number
  outboundMessageCount: number
  stakeholderCount: number
  priorMomentumScore?: number | null
}

export type BuyingMomentumResult = {
  momentumScore: number
  momentumTrend: GrowthBuyingMomentumTrend
  replyVelocityScore: number
  engagementDepthScore: number
  objectionResolutionScore: number
  outboundInteractionScore: number
  explainability: string[]
  evidence: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeBuyingMomentum(input: BuyingMomentumInput): BuyingMomentumResult {
  const explainability: string[] = []
  const evidence: string[] = []

  let replyVelocityScore = 20
  if (input.responseLatencyMs != null) {
    if (input.responseLatencyMs <= 60 * 60 * 1000) {
      replyVelocityScore = 90
      evidence.push(`Fast reply within ${Math.round(input.responseLatencyMs / 60000)} minutes.`)
    } else if (input.responseLatencyMs <= 24 * 60 * 60 * 1000) {
      replyVelocityScore = 65
      evidence.push("Reply within 24 hours.")
    } else {
      replyVelocityScore = 35
      evidence.push("Slow reply velocity detected.")
    }
    explainability.push(`Reply velocity score: ${replyVelocityScore} (based on response latency).`)
  } else {
    explainability.push("Reply velocity score: 20 (no latency evidence).")
  }

  let engagementDepthScore = 25 + Math.min(40, input.threadReplyCount * 12) + Math.min(25, input.buyingSignalCount * 8)
  engagementDepthScore = clamp(engagementDepthScore)
  explainability.push(
    `Engagement depth: ${engagementDepthScore} (${input.threadReplyCount} thread replies, ${input.buyingSignalCount} buying signals).`,
  )
  if (input.threadReplyCount > 1) evidence.push(`${input.threadReplyCount} replies in conversation thread.`)

  const objectionResolutionScore =
    input.objectionCount === 0
      ? 70
      : clamp(Math.round((input.resolvedObjectionCount / Math.max(1, input.objectionCount)) * 100))
  explainability.push(
    `Objection resolution: ${objectionResolutionScore} (${input.resolvedObjectionCount}/${input.objectionCount} addressed).`,
  )

  const outboundInteractionScore = clamp(30 + Math.min(40, input.outboundMessageCount * 5))
  explainability.push(`Outbound interaction score: ${outboundInteractionScore}.`)

  const momentumScore = clamp(
    Math.round(
      replyVelocityScore * 0.25 +
        engagementDepthScore * 0.35 +
        objectionResolutionScore * 0.15 +
        outboundInteractionScore * 0.1 +
        Math.min(15, input.stakeholderCount * 5),
    ),
  )
  explainability.push(`Composite momentum score: ${momentumScore}/100.`)

  let momentumTrend: GrowthBuyingMomentumTrend = "steady"
  if (input.priorMomentumScore != null) {
    const delta = momentumScore - input.priorMomentumScore
    if (delta >= 10) momentumTrend = "accelerating"
    else if (delta <= -10) momentumTrend = "cooling"
    else if (momentumScore < 30) momentumTrend = "stalled"
    explainability.push(`Trend vs prior snapshot: ${momentumTrend} (delta ${delta}).`)
  } else if (momentumScore >= 65) {
    momentumTrend = "accelerating"
  } else if (momentumScore < 30) {
    momentumTrend = "stalled"
  }

  return {
    momentumScore,
    momentumTrend,
    replyVelocityScore,
    engagementDepthScore,
    objectionResolutionScore,
    outboundInteractionScore,
    explainability,
    evidence,
  }
}
