/** GE-AUTO-1F — Adaptive recommendation engine (client-safe, recommendations only). */

import type { GrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveAdaptiveRecommendation,
  type GrowthObjectiveSignalSnapshot,
} from "@/lib/growth/objectives/growth-objective-types"

function recommendationId(objectiveId: string, trigger: string): string {
  return `${objectiveId}:${trigger}:${GROWTH_OBJECTIVE_QA_MARKER}`
}

function buildRecommendation(input: {
  objective: GrowthObjective
  trigger: string
  signal: string
  recommendation: string
  suggestedCapability: GrowthAutonomyCapability | null
  priority: GrowthObjectiveAdaptiveRecommendation["priority"]
}): GrowthObjectiveAdaptiveRecommendation {
  return {
    id: recommendationId(input.objective.id, input.trigger),
    objectiveId: input.objective.id,
    trigger: input.trigger,
    signal: input.signal,
    recommendation: input.recommendation,
    suggestedCapability: input.suggestedCapability,
    priority: input.priority,
    requiresApproval: true,
    createdAt: new Date().toISOString(),
  }
}

export function generateGrowthObjectiveAdaptiveRecommendations(input: {
  objective: GrowthObjective
  signals: GrowthObjectiveSignalSnapshot
}): GrowthObjectiveAdaptiveRecommendation[] {
  const { objective, signals } = input
  const recommendations: GrowthObjectiveAdaptiveRecommendation[] = []

  if (signals.sequenceOpenRate > 0 && signals.sequenceOpenRate < 0.15) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "low_opens",
        signal: `Open rate ${Math.round(signals.sequenceOpenRate * 100)}%`,
        recommendation: "Low opens — increase SMS touchpoints and shorten subject lines.",
        suggestedCapability: "sms_execution",
        priority: "high",
      }),
    )
  }

  if (signals.replies === 0 && signals.clicks > 5) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "low_replies",
        signal: `${signals.clicks} clicks, 0 replies`,
        recommendation: "Low replies — regenerate messaging and add discovery questions.",
        suggestedCapability: "recommendations",
        priority: "high",
      }),
    )
  }

  if (signals.replies === 0 && signals.videoViews > 0) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "low_replies_video",
        signal: `${signals.videoViews} video views, 0 replies`,
        recommendation: "Low replies after video views — regenerate video and follow-up sequence.",
        suggestedCapability: "video_generation",
        priority: "high",
      }),
    )
  }

  if (signals.bookings === 0 && signals.opens > 30 && objective.currentValue === 0) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "no_bookings",
        signal: `${signals.opens} opens, 0 bookings`,
        recommendation: "No bookings — increase audience size, generate additional assets, and relaunch.",
        suggestedCapability: "audience_generation",
        priority: "critical",
      }),
    )
  }

  if (signals.videoCompletions > 0 && signals.videoViews > 0) {
    const completionRate = signals.videoCompletions / signals.videoViews
    if (completionRate >= 0.6) {
      recommendations.push(
        buildRecommendation({
          objective,
          trigger: "high_video_completion",
          signal: `${Math.round(completionRate * 100)}% video completion`,
          recommendation: "High video completion — increase pricing follow-ups for qualified leads.",
          suggestedCapability: "email_execution",
          priority: "medium",
        }),
      )
    }
  }

  if (signals.bookings > 0 && objective.currentValue > 0) {
    const bookingRate = signals.bookings / Math.max(objective.currentValue, 1)
    if (bookingRate >= 0.5) {
      recommendations.push(
        buildRecommendation({
          objective,
          trigger: "high_booking_conversion",
          signal: `${signals.bookings} bookings on ${objective.currentValue} outcomes`,
          recommendation: "High booking conversion — allocate more volume to top-performing audience.",
          suggestedCapability: "audience_generation",
          priority: "medium",
        }),
      )
    }
  }

  if (signals.intentScore >= 75 && signals.engagementScore >= 70) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "high_intent",
        signal: `Intent ${signals.intentScore}, engagement ${signals.engagementScore}`,
        recommendation: "High intent cluster detected — prioritize buying committee research.",
        suggestedCapability: "research",
        priority: "high",
      }),
    )
  }

  if (signals.sequenceReplyRate < 0.05 && signals.opens > 20) {
    recommendations.push(
      buildRecommendation({
        objective,
        trigger: "sequence_underperformance",
        signal: `Reply rate ${Math.round(signals.sequenceReplyRate * 100)}%`,
        recommendation: "Sequence underperforming — adapt strategy and refresh assets.",
        suggestedCapability: "strategy_adaptation",
        priority: "medium",
      }),
    )
  }

  return recommendations
}

export const GrowthObjectiveAdaptiveEngine = {
  generateGrowthObjectiveAdaptiveRecommendations,
} as const
