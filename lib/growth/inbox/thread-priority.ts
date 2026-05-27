/** Deterministic thread priority scoring. Client-safe. */

import type { GrowthInboxClassification, GrowthInboxPriorityTier } from "@/lib/growth/inbox/inbox-types"
import type { ReplySignalFlags } from "@/lib/growth/inbox/reply-signals"

export type ThreadPriorityInput = {
  classification: GrowthInboxClassification
  signals?: ReplySignalFlags
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeThreadPriorityScore(input: ThreadPriorityInput): number {
  let score = 50

  switch (input.classification) {
    case "positive_interest":
      score += 30
      break
    case "meeting_intent":
      score += 40
      break
    case "budget":
      score += 10
      break
    case "timeline":
      score += 10
      break
    case "competitor":
      score += 20
      break
    case "unsubscribe":
    case "not_interested":
      score -= 50
      break
    default:
      break
  }

  if (input.signals?.contains_meeting_language) score += 5
  if (input.signals?.contains_positive_signal) score += 5

  return clampScore(score)
}

export function priorityScoreToTier(score: number): GrowthInboxPriorityTier {
  if (score >= 90) return "critical"
  if (score >= 70) return "high"
  if (score >= 40) return "normal"
  return "low"
}

export function priorityTierLabel(tier: GrowthInboxPriorityTier): string {
  switch (tier) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
  }
}
