/** GS-AI-PLAYBOOK-4A — Conversation state detection (client-safe). */

import type {
  GrowthBuyingStage,
  GrowthConversationState,
  GrowthConversationStateAssessment,
  GrowthBuyingStageConfidence,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthBuyingStageSignalInput } from "@/lib/growth/buyer-journey/growth-buying-stage-signals"

function resolveConfidence(score: number): GrowthBuyingStageConfidence {
  if (score >= 75) return "high"
  if (score >= 55) return "medium"
  return "low"
}

export function buildGrowthConversationStateAssessment(input: {
  signals: GrowthBuyingStageSignalInput
  buyingStage: GrowthBuyingStage
}): GrowthConversationStateAssessment {
  const signals = input.signals
  const touchCount = signals.priorTouchCount ?? 0
  const replies = signals.priorReplyCount ?? 0
  const meetings = signals.priorMeetingCount ?? 0
  const assetViews = (signals.sharePageViews ?? 0) + (signals.emailClicks ?? 0)
  const daysSinceLastTouch = signals.daysSinceLastTouch ?? null
  const openLoops = signals.memoryOpenLoops ?? []
  const detected: string[] = []

  let state: GrowthConversationState = "first_touch"
  let confidenceScore = 50

  const isHot =
    signals.engagementTier === "hot" ||
    (replies > 0 && (meetings > 0 || (signals.calendarBookings ?? 0) > 0)) ||
    (signals.opportunityReadinessTier === "qualified" && replies > 0)

  if (isHot) {
    state = "hot"
    confidenceScore = 86
    detected.push("High-intent engagement pattern")
  } else if (
    input.buyingStage === "dormant" &&
    touchCount > 0 &&
    (replies > 0 || (signals.emailOpens ?? 0) > 0)
  ) {
    state = "reengagement"
    confidenceScore = 74
    detected.push("Returning after dormancy")
  } else if (
    daysSinceLastTouch != null &&
    daysSinceLastTouch >= 14 &&
    touchCount > 0 &&
    replies === 0
  ) {
    state = "stalled"
    confidenceScore = 70
    detected.push(`No response in ${daysSinceLastTouch} days`)
  } else if (
    input.buyingStage === "evaluating" ||
    input.buyingStage === "buying_committee" ||
    input.buyingStage === "proposal" ||
    meetings > 0
  ) {
    state = "evaluating"
    confidenceScore = 76
    detected.push("Active evaluation signals")
  } else if (replies > 0) {
    state = "replying"
    confidenceScore = 82
    detected.push("Prospect has replied")
  } else if (assetViews > 0 || signals.videoCompletion) {
    state = "researching"
    confidenceScore = 68
    detected.push("Asset or content engagement")
  } else if (
    touchCount > 0 &&
    ((signals.emailOpens ?? 0) > 0 || (signals.emailClicks ?? 0) > 0 || signals.engagementTier === "engaged")
  ) {
    state = "engaged"
    confidenceScore = 65
    detected.push("Opens/clicks without reply")
  } else if (touchCount === 0) {
    state = "first_touch"
    confidenceScore = 80
    detected.push("No prior touches")
  } else {
    state = "engaged"
    confidenceScore = 58
    detected.push("Prior outreach with limited engagement detail")
  }

  return {
    state,
    confidence: resolveConfidence(confidenceScore),
    confidenceScore,
    daysSinceLastTouch,
    touchCount,
    replies,
    meetings,
    assetViews,
    videoCompletion: Boolean(signals.videoCompletion),
    openLoops,
    signals: detected,
  }
}
