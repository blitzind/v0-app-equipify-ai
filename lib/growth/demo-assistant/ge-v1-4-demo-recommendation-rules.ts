/** GE-v1-4 — Deterministic demo assistant recommendations (reuses SENDR recommendation shape). */

import type { GeV14DemoAssistantEventType } from "@/lib/growth/demo-assistant/ge-v1-4-types"
import type { GrowthSendrRecommendation } from "@/lib/growth/sendr/growth-sendr-types"

export function generateGeV14DemoAssistantRecommendations(
  events: Array<{
    eventType: GeV14DemoAssistantEventType
    eventValue?: Record<string, unknown>
  }>,
): GrowthSendrRecommendation[] {
  const recommendations: GrowthSendrRecommendation[] = []

  const hasBookingOffer = events.some((e) => e.eventType === "booking_offered")
  const completed = events.some((e) => e.eventType === "conversation_completed")
  const highIntentIntents = events
    .filter((e) => e.eventType === "response_generated")
    .map((e) => String(e.eventValue?.intent ?? ""))

  if (highIntentIntents.includes("demo") || highIntentIntents.includes("pricing")) {
    recommendations.push({
      id: "demo_assistant_suggest_demo",
      priority: 1,
      title: "Suggest demo",
      reason: "Prospect asked pricing or demo questions on the personalized page assistant.",
      actionKind: "meeting",
    })
  }

  if (highIntentIntents.includes("integration")) {
    recommendations.push({
      id: "demo_assistant_quickbooks_demo",
      priority: 2,
      title: "Suggest QuickBooks integration demo",
      reason: "Prospect asked integration questions — confirm scope on a live walkthrough.",
      actionKind: "meeting",
    })
  }

  if (highIntentIntents.includes("implementation")) {
    recommendations.push({
      id: "demo_assistant_implementation_walkthrough",
      priority: 3,
      title: "Suggest implementation walkthrough",
      reason: "Prospect asked about rollout and onboarding.",
      actionKind: "meeting",
    })
  }

  if (hasBookingOffer && completed) {
    recommendations.push({
      id: "demo_assistant_immediate_follow_up",
      priority: 1,
      title: "Immediate follow-up",
      reason: "High buying intent detected in demo assistant conversation.",
      actionKind: "call",
    })
  }

  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 3)
}
