/** Follow-up health analysis — passive, evidence-backed. */

import type { VoiceRevenueIntelligenceFollowUpHealth } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"

export function analyzeFollowUpHealth(input: {
  lastInteractionAt: string | null
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
}): VoiceRevenueIntelligenceFollowUpHealth {
  const { lastInteractionAt, memoryEvents } = input

  const hasFollowUpRequest = memoryEvents.some((event) =>
    ["follow_up_request", "callback_preference", "scheduling_preference"].includes(event.memoryType),
  )

  if (!lastInteractionAt) {
    return {
      status: hasFollowUpRequest ? "due_soon" : "unknown",
      summary: hasFollowUpRequest
        ? "Follow-up requested — no recent interaction timestamp on file."
        : "No recent interaction recorded.",
      daysSinceLastInteraction: null,
    }
  }

  const lastMs = new Date(lastInteractionAt).getTime()
  const daysSinceLastInteraction = Number.isNaN(lastMs)
    ? null
    : Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000))

  if (daysSinceLastInteraction == null) {
    return {
      status: "unknown",
      summary: "Follow-up health unavailable.",
      daysSinceLastInteraction: null,
    }
  }

  if (daysSinceLastInteraction >= 21 && hasFollowUpRequest) {
    return {
      status: "overdue",
      summary: `Follow-up overdue — ${daysSinceLastInteraction} days since last interaction with an open follow-up preference.`,
      daysSinceLastInteraction,
    }
  }

  if (daysSinceLastInteraction >= 14) {
    return {
      status: "due_soon",
      summary: `${daysSinceLastInteraction} days since last interaction — follow-up window tightening.`,
      daysSinceLastInteraction,
    }
  }

  return {
    status: "healthy",
    summary: `Recent interaction ${daysSinceLastInteraction} day${daysSinceLastInteraction === 1 ? "" : "s"} ago.`,
    daysSinceLastInteraction,
  }
}

export function countFollowUpRiskEvents(followUpHealth: VoiceRevenueIntelligenceFollowUpHealth): number {
  return followUpHealth.status === "overdue" ? 1 : followUpHealth.status === "due_soon" ? 1 : 0
}
