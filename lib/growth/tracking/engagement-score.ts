import type { GrowthAttributionEngagementTier } from "@/lib/growth/tracking/tracking-types"

export const GROWTH_ATTRIBUTION_SCORE_POINTS = {
  open: 5,
  click: 15,
  reply: 40,
  meeting: 50,
} as const

export const GROWTH_ATTRIBUTION_INACTIVITY_DECAY = [
  { days: 90, penalty: 50 },
  { days: 60, penalty: 25 },
  { days: 30, penalty: 10 },
] as const

export type GrowthAttributionScoreInput = {
  opens: number
  clicks: number
  replies: number
  meetings: number
  lastActivityAt: string | null
  now?: Date
}

export type GrowthAttributionScoreResult = {
  score: number
  tier: GrowthAttributionEngagementTier
  baseScore: number
  decayPenalty: number
  idleDays: number
}

function daysSince(iso: string, now: Date): number {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
}

export function computeInactivityDecayPenalty(idleDays: number): number {
  for (const step of GROWTH_ATTRIBUTION_INACTIVITY_DECAY) {
    if (idleDays >= step.days) return step.penalty
  }
  return 0
}

export function tierFromAttributionScore(score: number): GrowthAttributionEngagementTier {
  if (score > 100) return "hot"
  if (score >= 51) return "engaged"
  if (score >= 21) return "warm"
  return "cold"
}

export function computeAttributionEngagementScore(input: GrowthAttributionScoreInput): GrowthAttributionScoreResult {
  const now = input.now ?? new Date()
  const baseScore =
    input.opens * GROWTH_ATTRIBUTION_SCORE_POINTS.open +
    input.clicks * GROWTH_ATTRIBUTION_SCORE_POINTS.click +
    input.replies * GROWTH_ATTRIBUTION_SCORE_POINTS.reply +
    input.meetings * GROWTH_ATTRIBUTION_SCORE_POINTS.meeting

  const idleDays = input.lastActivityAt ? daysSince(input.lastActivityAt, now) : Number.POSITIVE_INFINITY
  const decayPenalty = Number.isFinite(idleDays) ? computeInactivityDecayPenalty(idleDays) : 0
  const score = Math.max(0, baseScore - decayPenalty)
  const tier = tierFromAttributionScore(score)

  return {
    score,
    tier,
    baseScore,
    decayPenalty,
    idleDays: Number.isFinite(idleDays) ? idleDays : 0,
  }
}

export function isHighEngagementTier(tier: GrowthAttributionEngagementTier): boolean {
  return tier === "hot" || tier === "engaged"
}
