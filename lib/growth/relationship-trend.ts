import { daysSince } from "@/lib/growth/engagement-decay"
import type {
  GrowthRelationshipTier,
  GrowthRelationshipTrend,
} from "@/lib/growth/relationship-types"

const IMPROVING_DELTA = 8
const COOLING_DELTA = -8
const COOLING_SILENCE_DAYS = 45

export function computeRelationshipTrend(input: {
  previousScore: number | null
  currentScore: number
  previousTrend: GrowthRelationshipTrend | null
  tier: GrowthRelationshipTier
  lastMeaningfulTouchAt: string | null
  now: Date
}): GrowthRelationshipTrend {
  const delta =
    input.previousScore != null ? input.currentScore - input.previousScore : 0

  if (delta >= IMPROVING_DELTA) return "improving"

  const silenceDays = input.lastMeaningfulTouchAt
    ? daysSince(input.lastMeaningfulTouchAt, input.now)
    : Number.POSITIVE_INFINITY

  if (
    delta <= COOLING_DELTA ||
    (silenceDays > COOLING_SILENCE_DAYS &&
      (input.tier === "active" ||
        input.tier === "trusted" ||
        input.tier === "strategic"))
  ) {
    return "cooling"
  }

  if (input.previousTrend === "cooling" && delta > 0) {
    return "improving"
  }

  return "stable"
}
