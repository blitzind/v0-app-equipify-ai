/** GS-AI-PLAYBOOK-4C — Engagement progression (client-safe). */

import type {
  GrowthSequenceEngagementProgression,
  GrowthSequenceEngagementTrend,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"

function normalizeMemoryTrend(trend: string | null | undefined): GrowthSequenceEngagementTrend | null {
  if (!trend) return null
  const lower = trend.toLowerCase()
  if (/increas|warm|up|positive|engag/.test(lower)) return "interestIncreasing"
  if (/decreas|cold|down|negative|stall|cool/.test(lower)) return "interestDecreasing"
  if (/flat|stable|neutral|steady/.test(lower)) return "interestFlat"
  return null
}

export function buildGrowthSequenceEngagementProgression(
  input: GrowthSequenceSignalInput,
): GrowthSequenceEngagementProgression {
  const opens = input.emailOpens ?? 0
  const clicks = input.emailClicks ?? 0
  const replies = input.priorReplySummaries?.length ?? 0
  const meetings = input.meetings ?? 0
  const assetViews = (input.assetViews ?? 0) + (input.videoViews ?? 0) + (input.sharePageViews ?? 0)
  const engagementScore = input.engagementScore ?? 0
  const daysSinceLastTouch = input.daysSinceLastTouch
  const memoryTrend = normalizeMemoryTrend(input.memoryEngagementTrend)

  let score = 0
  if (replies > 0) score += 30
  if (meetings > 0) score += 25
  if (clicks > 0) score += 15
  if (opens > 1) score += 10
  if (assetViews > 0) score += 10
  if (engagementScore >= 50) score += 10
  if (daysSinceLastTouch != null && daysSinceLastTouch > 21) score -= 20
  if (daysSinceLastTouch != null && daysSinceLastTouch > 45) score -= 15
  if ((input.priorTouchCount ?? 0) >= 3 && replies === 0 && opens === 0) score -= 15

  let engagementTrend: GrowthSequenceEngagementTrend = "interestFlat"
  if (memoryTrend) {
    engagementTrend = memoryTrend
  } else if (score >= 25) {
    engagementTrend = "interestIncreasing"
  } else if (score <= -10) {
    engagementTrend = "interestDecreasing"
  }

  const confidence = Math.max(40, Math.min(92, 55 + Math.abs(score)))

  let recommendedApproach = "Continue consultative progression with fresh value."
  if (engagementTrend === "interestIncreasing") {
    recommendedApproach = "Interest is rising — advance proof and offer a concrete next step."
  } else if (engagementTrend === "interestDecreasing") {
    recommendedApproach = "Engagement is cooling — reframe value and reduce ask intensity."
  } else if (replies > 0) {
    recommendedApproach = "Active thread — respond to context and propose a clear next step."
  } else if ((input.priorTouchCount ?? 0) <= 1) {
    recommendedApproach = "Early sequence — prioritize understanding over hard asks."
  }

  return {
    engagementTrend,
    confidence,
    recommendedApproach,
  }
}

export function engagementTrendLabel(trend: GrowthSequenceEngagementTrend): string {
  if (trend === "interestIncreasing") return "Increasing"
  if (trend === "interestDecreasing") return "Decreasing"
  return "Flat"
}
