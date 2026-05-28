/** Buying stage resolver — deterministic from relationship memory signals. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceBuyingStage } from "@/lib/voice/revenue-intelligence/types"

const STAGE_RANK: Record<VoiceBuyingStage, number> = {
  unknown: 0,
  discovery: 1,
  evaluation: 2,
  negotiation: 3,
  commitment: 4,
  stalled: 2,
  at_risk: 1,
}

export function resolveBuyingStage(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
}): VoiceBuyingStage {
  const { memoryEvents, objectionCount, buyingSignalCount, escalationCount, relationshipStatus } = input

  const hasBooking = memoryEvents.some((event) => event.memoryType === "booking_interest")
  const hasDecisionMaker = memoryEvents.some((event) => event.memoryType === "decision_maker")
  const hasBudgetConcern = memoryEvents.some((event) => event.memoryType === "budget_concern")
  const hasCompetitor = memoryEvents.some((event) => event.memoryType === "competitor_mention")
  const hasCancellation = memoryEvents.some((event) => event.memoryType === "cancellation_risk")
  const hasUrgency = memoryEvents.some((event) => event.memoryType === "urgency_signal")

  if (relationshipStatus === "dormant" || relationshipStatus === "at_risk" || hasCancellation) {
    return escalationCount > 0 || hasCancellation ? "at_risk" : "stalled"
  }

  if (hasBooking && (hasDecisionMaker || buyingSignalCount >= 2)) return "commitment"
  if (hasBooking || (hasUrgency && hasDecisionMaker)) return "negotiation"
  if (hasDecisionMaker || buyingSignalCount >= 1) return "evaluation"
  if (objectionCount >= 2 || (hasBudgetConcern && hasCompetitor)) return "stalled"
  if (memoryEvents.length > 0 || objectionCount > 0) return "discovery"
  return "unknown"
}

export function compareBuyingStages(fromStage: VoiceBuyingStage, toStage: VoiceBuyingStage): number {
  return STAGE_RANK[toStage] - STAGE_RANK[fromStage]
}

export function inferStageMovement(
  previousStage: VoiceBuyingStage,
  currentStage: VoiceBuyingStage,
  evidenceText: string,
): {
  direction: "progression" | "regression" | "stable" | "unknown"
  fromStage: VoiceBuyingStage
  toStage: VoiceBuyingStage
  evidenceText: string
} | null {
  if (previousStage === "unknown" && currentStage === "unknown") return null
  const delta = compareBuyingStages(previousStage, currentStage)
  if (delta === 0) {
    return {
      direction: "stable",
      fromStage: previousStage,
      toStage: currentStage,
      evidenceText,
    }
  }
  return {
    direction: delta > 0 ? "progression" : "regression",
    fromStage: previousStage,
    toStage: currentStage,
    evidenceText,
  }
}
