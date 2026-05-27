import type { GrowthSenderReputationTier } from "@/lib/growth/compliance/compliance-types"

export const SENDER_REPUTATION_BASE_SCORE = 100 as const

export const SENDER_REPUTATION_PENALTIES = {
  hard_bounce: 15,
  complaint: 25,
  spam_event: 35,
  soft_bounce: 5,
} as const

export const SENDER_REPUTATION_RECOVERY_PER_CLEAN_DAY = 2 as const

export type SenderReputationInput = {
  hardBounces: number
  softBounces: number
  complaints: number
  spamEvents: number
  cleanDays: number
}

export function clampReputationScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)))
}

export function computeSenderReputationScore(input: SenderReputationInput): number {
  let score = SENDER_REPUTATION_BASE_SCORE
  score -= input.hardBounces * SENDER_REPUTATION_PENALTIES.hard_bounce
  score -= input.complaints * SENDER_REPUTATION_PENALTIES.complaint
  score -= input.spamEvents * SENDER_REPUTATION_PENALTIES.spam_event
  score -= input.softBounces * SENDER_REPUTATION_PENALTIES.soft_bounce
  score += input.cleanDays * SENDER_REPUTATION_RECOVERY_PER_CLEAN_DAY
  return clampReputationScore(score)
}

export function tierFromSenderReputationScore(score: number): GrowthSenderReputationTier {
  if (score >= 80) return "healthy"
  if (score >= 60) return "monitor"
  if (score >= 40) return "warning"
  return "critical"
}

export function senderReputationTierLabel(tier: GrowthSenderReputationTier): string {
  switch (tier) {
    case "healthy":
      return "Healthy"
    case "monitor":
      return "Monitor"
    case "warning":
      return "Warning"
    case "critical":
      return "Critical"
    default:
      return tier
  }
}

export function buildSenderReputationSnapshot(input: SenderReputationInput) {
  const score = computeSenderReputationScore(input)
  return {
    score,
    tier: tierFromSenderReputationScore(score),
    hardBounces: input.hardBounces,
    softBounces: input.softBounces,
    complaints: input.complaints,
    spamEvents: input.spamEvents,
    cleanDays: input.cleanDays,
  }
}
