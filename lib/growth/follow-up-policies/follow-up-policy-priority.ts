/** Phase GS-5C — Deterministic follow-up policy prioritization (client-safe). */

import type {
  SmartFollowUpFilter,
  SmartFollowUpPolicy,
  SmartFollowUpPolicyPriority,
  SmartFollowUpPolicyType,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"

const PRIORITY_RANK: Record<SmartFollowUpPolicyPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const TYPE_BOOST: Record<SmartFollowUpPolicyType, number> = {
  high_intent_follow_up: 26,
  reply_follow_up: 24,
  meeting_follow_up: 22,
  proposal_follow_up: 20,
  opportunity_follow_up: 18,
  reengagement_follow_up: 14,
  nurture_follow_up: 10,
  manual_review: 8,
}

const REVIEW_PENALTY: Record<SmartFollowUpPolicy["review_status"], number> = {
  pending: 0,
  reviewed: -25,
  dismissed: -100,
}

export function scoreSmartFollowUpPolicy(policy: SmartFollowUpPolicy): number {
  const priorityScore = PRIORITY_RANK[policy.priority] * 25
  const typeBoost = TYPE_BOOST[policy.policy_type] ?? 0
  const reviewPenalty = REVIEW_PENALTY[policy.review_status] ?? 0
  const channelBoost = Math.min(12, policy.recommended_channels.length * 3)
  const recencyMs = Date.now() - Date.parse(policy.trigger.occurred_at)
  const recencyBoost =
    Number.isFinite(recencyMs) && recencyMs <= 72 * 60 * 60 * 1000
      ? Math.round(10 * (1 - recencyMs / (72 * 60 * 60 * 1000)))
      : 0
  const followUpBoost = policy.follow_up_recommended ? 8 : -15

  return priorityScore + typeBoost + reviewPenalty + channelBoost + recencyBoost + followUpBoost
}

export function rankSmartFollowUpPolicies(policies: SmartFollowUpPolicy[]): SmartFollowUpPolicy[] {
  return [...policies].sort((left, right) => {
    const scoreDiff = scoreSmartFollowUpPolicy(right) - scoreSmartFollowUpPolicy(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.generated_at.localeCompare(left.generated_at)
  })
}

export function filterSmartFollowUpPolicies(
  policies: SmartFollowUpPolicy[],
  filter: SmartFollowUpFilter,
): SmartFollowUpPolicy[] {
  switch (filter) {
    case "urgent":
      return policies.filter((p) => p.priority === "urgent" || p.priority === "high")
    case "replies":
      return policies.filter((p) => p.policy_type === "reply_follow_up")
    case "meetings":
      return policies.filter((p) => p.policy_type === "meeting_follow_up")
    case "opportunities":
      return policies.filter(
        (p) =>
          p.policy_type === "opportunity_follow_up" || p.policy_type === "proposal_follow_up",
      )
    case "high_intent":
      return policies.filter((p) => p.policy_type === "high_intent_follow_up")
    default:
      return policies.filter((p) => p.review_status !== "dismissed")
  }
}
