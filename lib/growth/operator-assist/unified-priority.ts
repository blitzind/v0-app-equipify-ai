/** Unified assist prioritization — extends live-guidance-priority tiers without a second engine. */

import {
  guidancePriorityLabel,
  guidancePriorityScore,
  type GrowthLiveGuidancePriorityLabel,
} from "@/lib/growth/live-guidance/live-guidance-priority"
import type { GrowthLiveGuidanceEvent, GrowthLiveGuidanceSeverity } from "@/lib/growth/live-guidance/live-guidance-types"
import type { UnifiedOperatorAssistEvent } from "@/lib/growth/operator-assist/types"
import { LIVE_COACHING_TOP_GUIDANCE_COUNT } from "@/lib/growth/live-guidance/live-guidance-priority"

const VOICE_EVENT_TYPE_TO_GROWTH_TYPE: Record<string, GrowthLiveGuidanceEvent["eventType"]> = {
  pricing_objection: "objection_guidance",
  competitor_mention: "competitor_response",
  timing_objection: "objection_guidance",
  ready_to_book: "buying_signal_detected",
  decision_maker_signal: "buying_signal_detected",
  urgency_signal: "urgency_detected",
  angry_caller: "executive_risk",
  cancellation_risk: "executive_risk",
  opt_out_intent: "executive_risk",
  compliance_sensitive_language: "executive_risk",
  operator_guidance: "objection_guidance",
  next_best_action: "close_attempt_recommended",
  conversational_interruption: "talking_too_much",
}

const PRIORITY_LABEL_RANK: Record<GrowthLiveGuidancePriorityLabel, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
}

export const UNIFIED_ASSIST_RECENCY_BOOST_MAX = 150
export const UNIFIED_ASSIST_STALE_DECAY_MAX = 120
export const UNIFIED_ASSIST_RECENCY_WINDOW_MS = 3 * 60 * 1000
export const UNIFIED_ASSIST_STALE_WINDOW_MS = 5 * 60 * 1000

function pseudoGuidanceEvent(input: {
  eventType: string
  severity: GrowthLiveGuidanceSeverity
  confidenceScore: number
  surfacedAt: string
}): GrowthLiveGuidanceEvent {
  const mappedType = VOICE_EVENT_TYPE_TO_GROWTH_TYPE[input.eventType] ?? "objection_guidance"
  return {
    id: "pseudo",
    organizationId: null,
    leadId: "",
    realtimeCallSessionId: "",
    dedupeKey: null,
    eventType: mappedType,
    severity: input.severity,
    title: "",
    operatorPrompt: "",
    recommendation: "",
    supportingReason: "",
    confidenceScore: input.confidenceScore,
    surfacedAt: input.surfacedAt,
    dismissedAt: null,
    acceptedAt: null,
    createdAt: input.surfacedAt,
  }
}

export function applyUnifiedAssistRecencyAdjustments(
  priorityScore: number,
  surfacedAt: string,
  now = Date.now(),
): number {
  const surfacedMs = Date.parse(surfacedAt)
  if (!Number.isFinite(surfacedMs)) return priorityScore

  const ageMs = Math.max(0, now - surfacedMs)
  let adjusted = priorityScore

  if (ageMs <= UNIFIED_ASSIST_RECENCY_WINDOW_MS) {
    adjusted += Math.round(UNIFIED_ASSIST_RECENCY_BOOST_MAX * (1 - ageMs / UNIFIED_ASSIST_RECENCY_WINDOW_MS))
  }

  if (ageMs >= UNIFIED_ASSIST_STALE_WINDOW_MS) {
    const staleMinutes = Math.floor((ageMs - UNIFIED_ASSIST_STALE_WINDOW_MS) / 60_000)
    adjusted -= Math.min(UNIFIED_ASSIST_STALE_DECAY_MAX, staleMinutes * 15)
  }

  return adjusted
}

export function scoreUnifiedAssistEvent(
  event: Pick<UnifiedOperatorAssistEvent, "eventType" | "severity" | "confidenceScore" | "surfacedAt" | "category">,
  now = Date.now(),
): { priorityScore: number; priorityLabel: GrowthLiveGuidancePriorityLabel } {
  const pseudo = pseudoGuidanceEvent(event)
  let priorityScore = guidancePriorityScore(pseudo)
  if (event.category === "interruption") priorityScore += 50
  if (event.category === "risk") priorityScore += 120
  priorityScore = applyUnifiedAssistRecencyAdjustments(priorityScore, event.surfacedAt, now)
  return {
    priorityScore,
    priorityLabel: guidancePriorityLabel(pseudo),
  }
}

export function rankUnifiedAssistEvents(
  events: UnifiedOperatorAssistEvent[],
  now = Date.now(),
): UnifiedOperatorAssistEvent[] {
  return [...events]
    .map((event) => {
      const scored = scoreUnifiedAssistEvent(event, now)
      return { ...event, priorityScore: scored.priorityScore, priorityLabel: scored.priorityLabel }
    })
    .sort((a, b) => {
      const scoreDiff = b.priorityScore - a.priorityScore
      if (scoreDiff !== 0) return scoreDiff
      return b.surfacedAt.localeCompare(a.surfacedAt)
    })
}

export function partitionUnifiedAssistFeed(
  events: UnifiedOperatorAssistEvent[],
  now = Date.now(),
): {
  topPriority: UnifiedOperatorAssistEvent[]
  additional: UnifiedOperatorAssistEvent[]
} {
  const ranked = rankUnifiedAssistEvents(events, now)
  return {
    topPriority: ranked.slice(0, LIVE_COACHING_TOP_GUIDANCE_COUNT),
    additional: ranked.slice(LIVE_COACHING_TOP_GUIDANCE_COUNT),
  }
}

export function passesMinimumPriorityFilter(
  event: UnifiedOperatorAssistEvent,
  minimumLabel: GrowthLiveGuidancePriorityLabel,
): boolean {
  return PRIORITY_LABEL_RANK[event.priorityLabel] >= PRIORITY_LABEL_RANK[minimumLabel]
}
