/** GS-AI-PLAYBOOK-4C — Sequence state detection (client-safe). */

import type {
  GrowthSequenceMetrics,
  GrowthSequenceSignalInput,
  GrowthSequenceStateKey,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildGrowthSequenceEngagementProgression } from "@/lib/growth/sequence-intelligence/growth-engagement-progression"

export function buildGrowthSequenceMetrics(input: GrowthSequenceSignalInput): GrowthSequenceMetrics {
  const engagement = buildGrowthSequenceEngagementProgression(input)
  return {
    touchCount: input.priorTouchCount ?? 0,
    daysInSequence: input.daysInSequence ?? null,
    lastTouchDays: input.daysSinceLastTouch ?? null,
    opens: input.emailOpens ?? 0,
    clicks: input.emailClicks ?? 0,
    replies: input.priorReplySummaries?.length ?? 0,
    meetings: input.meetings ?? 0,
    assetViews: (input.assetViews ?? 0) + (input.videoViews ?? 0) + (input.sharePageViews ?? 0),
    responseTrend: engagement.engagementTrend,
  }
}

export function detectGrowthSequenceState(input: GrowthSequenceSignalInput): GrowthSequenceStateKey {
  const touchCount = input.priorTouchCount ?? 0
  const replies = input.priorReplySummaries?.length ?? 0
  const opens = input.emailOpens ?? 0
  const clicks = input.emailClicks ?? 0
  const meetings = input.meetings ?? 0
  const daysSinceLastTouch = input.daysSinceLastTouch
  const buyingStage = input.buyingStage ?? ""
  const conversationState = input.conversationState ?? ""

  if (touchCount === 0) return "first_touch"

  if (
    touchCount >= 6 &&
    replies === 0 &&
    (daysSinceLastTouch == null || daysSinceLastTouch > 14)
  ) {
    return "exhausted_sequence"
  }

  if (daysSinceLastTouch != null && daysSinceLastTouch > 30 && touchCount >= 2) {
    return touchCount >= 4 ? "exhausted_sequence" : "reengagement_sequence"
  }

  if (daysSinceLastTouch != null && daysSinceLastTouch > 21 && replies === 0) {
    return "stalled_sequence"
  }

  if (replies > 0 || conversationState === "replying" || conversationState === "hot") {
    return meetings > 0 || buyingStage === "evaluating" || buyingStage === "proposal"
      ? "evaluation_sequence"
      : "active_conversation"
  }

  if (
    buyingStage === "evaluating" ||
    buyingStage === "buying_committee" ||
    buyingStage === "proposal" ||
    meetings > 0
  ) {
    return "evaluation_sequence"
  }

  if ((opens > 0 || clicks > 0) && touchCount >= 1) {
    return "engaged_sequence"
  }

  if (touchCount >= 4) return "late_sequence"
  if (touchCount >= 1 && touchCount <= 2) return "early_sequence"

  return "early_sequence"
}

export function sequenceStateLabel(state: GrowthSequenceStateKey): string {
  return state.replace(/_/g, " ")
}
