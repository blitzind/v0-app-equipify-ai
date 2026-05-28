/** Map unified assist events to Growth guidance cards for UI reuse (client-safe). */

import type { GrowthLiveGuidanceEvent, GrowthLiveGuidanceEventType } from "@/lib/growth/live-guidance/live-guidance-types"
import type { UnifiedOperatorAssistEvent } from "@/lib/growth/operator-assist/types"

const UNIFIED_TO_GROWTH_EVENT_TYPE: Record<string, GrowthLiveGuidanceEventType> = {
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
  conversational_interruption: "talking_too_much",
  operator_guidance: "objection_guidance",
  next_best_action: "close_attempt_recommended",
}

function normalizeConfidenceScore(score: number): number {
  if (score <= 1) return Math.round(score * 100)
  return Math.round(score)
}

export function unifiedAssistEventToGuidanceEvent(event: UnifiedOperatorAssistEvent): GrowthLiveGuidanceEvent {
  const growthEventId = event.growthGuidanceEventId ?? event.id.replace(/^(growth|voice|interruption):/, "")
  return {
    id: event.id,
    organizationId: null,
    leadId: event.coachingLeadId ?? "",
    realtimeCallSessionId: event.realtimeSessionId ?? "",
    eventType: UNIFIED_TO_GROWTH_EVENT_TYPE[event.eventType] ?? "objection_guidance",
    severity: event.severity,
    title: event.title,
    operatorPrompt: event.operatorPrompt,
    recommendation: event.recommendation,
    supportingReason: event.evidenceText,
    confidenceScore: normalizeConfidenceScore(event.confidenceScore),
    surfacedAt: event.surfacedAt,
    dismissedAt: event.lifecycleStatus === "dismissed" ? event.surfacedAt : null,
    acceptedAt: event.lifecycleStatus === "acknowledged" ? event.surfacedAt : null,
    createdAt: event.surfacedAt,
  }
}

export function parseUnifiedAssistEventId(prefixedId: string): {
  source: "growth" | "voice" | "interruption"
  rawId: string
} {
  if (prefixedId.startsWith("growth:")) {
    return { source: "growth", rawId: prefixedId.slice("growth:".length) }
  }
  if (prefixedId.startsWith("voice:")) {
    return { source: "voice", rawId: prefixedId.slice("voice:".length) }
  }
  return { source: "interruption", rawId: prefixedId.slice("interruption:".length) }
}
