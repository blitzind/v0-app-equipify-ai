/** GS-AI-PLAYBOOK-4B — Observation prioritization engine (client-safe). */

import type { GrowthBuyingStage } from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type {
  GrowthReasoningChannel,
  GrowthReasoningObservation,
  GrowthReasoningObservationCategory,
  GrowthReasoningPriorityResult,
} from "@/lib/growth/reasoning/growth-reasoning-types"
import { GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS } from "@/lib/growth/reasoning/growth-reasoning-types"

const CATEGORY_STAGE_BOOST: Partial<Record<GrowthReasoningObservationCategory, Partial<Record<GrowthBuyingStage, number>>>> = {
  verified_company: { unaware: 8, problem_aware: 10, solution_aware: 8 },
  industry: { problem_aware: 10, solution_aware: 8 },
  persona: { problem_aware: 8, evaluating: 10, buying_committee: 10 },
  buyer_journey: { problem_aware: 12, evaluating: 14, dormant: 12 },
  engagement: { solution_aware: 12, evaluating: 10 },
  outcome_guidance: { evaluating: 8, proposal: 10 },
  memory: { evaluating: 10, proposal: 8 },
  account: { problem_aware: 8, evaluating: 10 },
  sequence: { problem_aware: 6, evaluating: 10, dormant: 8 },
}

const CHANNEL_CATEGORY_BOOST: Partial<Record<GrowthReasoningChannel, Partial<Record<GrowthReasoningObservationCategory, number>>>> = {
  SMS: { verified_company: 8, buyer_journey: 10, engagement: 6, sequence: 10 },
  VOICE: { persona: 8, buyer_journey: 8, verified_company: 6, sequence: 8 },
  VIDEO: { account: 8, industry: 8, outcome_guidance: 6, sequence: 6 },
  SHARE_PAGE: { verified_company: 10, account: 10, industry: 8, sequence: 8 },
  COPILOT: { buyer_journey: 8, memory: 8, outcome_guidance: 6, sequence: 8 },
}

function scoreObservation(input: {
  observation: GrowthReasoningObservation
  channel: GrowthReasoningChannel
  buyingStage?: GrowthBuyingStage | null
}): number {
  const { observation, channel, buyingStage } = input
  let score =
    observation.confidence * 0.28 +
    observation.importance * 0.28 +
    observation.freshness * 0.14

  if (buyingStage) {
    score += CATEGORY_STAGE_BOOST[observation.category]?.[buyingStage] ?? 0
  }
  score += CHANNEL_CATEGORY_BOOST[channel]?.[observation.category] ?? 0

  if (observation.category === "verified_company") score += 6
  if (observation.category === "buyer_journey") score += 4
  if (observation.category === "sequence") score += 5

  return Math.round(score)
}

export function prioritizeGrowthReasoningObservations(input: {
  observations: GrowthReasoningObservation[]
  channel: GrowthReasoningChannel
  buyingStage?: GrowthBuyingStage | null
}): GrowthReasoningPriorityResult {
  const primaryLimit = GROWTH_REASONING_PRIMARY_INSIGHT_LIMITS[input.channel]
  const scored = input.observations
    .map((observation) => ({
      observation,
      score: scoreObservation({
        observation,
        channel: input.channel,
        buyingStage: input.buyingStage,
      }),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.observation.importance - a.observation.importance ||
        a.observation.statement.localeCompare(b.observation.statement),
    )

  const topInsights = scored.slice(0, primaryLimit).map((entry) => entry.observation)
  const secondaryInsights = scored.slice(primaryLimit, primaryLimit + 4).map((entry) => entry.observation)
  const ignoredInsights = scored.slice(primaryLimit + 4).map((entry) => entry.observation)

  return { topInsights, secondaryInsights, ignoredInsights }
}
