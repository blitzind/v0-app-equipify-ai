/** GS-SENDR-3C — Deterministic follow-up recommendations (client-safe, no AI). */

import type { GrowthSendrIntentSignals } from "@/lib/growth/sendr/growth-sendr-intent-scoring"
import { generateSendrRecommendations } from "@/lib/growth/sendr/growth-sendr-recommendation-service"

export function generateSendrActivityFollowUpRecommendations(input: {
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  signals: GrowthSendrIntentSignals
  lastActivityAt: string | null
}): string[] {
  const recommendations: string[] = []

  if (input.signals.pageViews > 0 && input.signals.ctaClicks === 0) {
    recommendations.push("Viewed personalized video page but no CTA click — review page offer and CTA placement.")
  }

  if (input.signals.videoCompletes > 0) {
    recommendations.push("Completed video — strong engagement signal; consider a direct call.")
  }

  if (input.signals.bookingStarts > 0 && input.signals.bookingCompletes === 0) {
    recommendations.push("Started booking but abandoned — send a manual booking reminder.")
  }

  if (input.signals.pageViews >= 2 || input.signals.repeatSessions > 0) {
    recommendations.push("Multiple page views — prospect is revisiting; prioritize follow-up.")
  }

  if (input.intentLevel === "high" || input.intentScore >= 67) {
    recommendations.push("High intent score — review timeline and decide next outreach step.")
  }

  const fromRules = generateSendrRecommendations({
    intentScore: input.intentScore,
    intentLevel: input.intentLevel,
    signals: input.signals,
    lastSendrActivityAt: input.lastActivityAt,
  }).map((r) => r.reason)

  return [...new Set([...recommendations, ...fromRules])].slice(0, 5)
}
