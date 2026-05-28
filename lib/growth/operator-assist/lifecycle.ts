/** Unified lifecycle normalization for Growth guidance + Voice intelligence events. */

import type { GrowthLiveGuidanceEvent } from "@/lib/growth/live-guidance/live-guidance-types"
import type { VoiceIntelligenceEventPublicView, VoiceIntelligenceEventStatus } from "@/lib/voice/intelligence/types"
import type { UnifiedOperatorAssistLifecycleStatus } from "@/lib/growth/operator-assist/types"

const ASSIST_EVENT_TTL_MS = 15 * 60 * 1000

export function normalizeGrowthGuidanceLifecycle(
  event: Pick<GrowthLiveGuidanceEvent, "dismissedAt" | "acceptedAt" | "surfacedAt">,
  now = Date.now(),
): UnifiedOperatorAssistLifecycleStatus {
  if (event.dismissedAt) return "dismissed"
  if (event.acceptedAt) return "acknowledged"
  const surfacedAt = Date.parse(event.surfacedAt)
  if (Number.isFinite(surfacedAt) && now - surfacedAt > ASSIST_EVENT_TTL_MS) return "expired"
  return "active"
}

export function normalizeVoiceIntelligenceLifecycle(
  event: Pick<VoiceIntelligenceEventPublicView, "status" | "createdAt" | "eventType">,
  now = Date.now(),
): UnifiedOperatorAssistLifecycleStatus {
  if (event.status === "dismissed") return "dismissed"
  if (event.status === "operator_acknowledged") return "acknowledged"
  if (event.status === "resolved") return "resolved"
  if (event.status === "expired") return "expired"
  if (event.status === "escalated") return "escalated"
  const createdAt = Date.parse(event.createdAt)
  if (Number.isFinite(createdAt) && now - createdAt > ASSIST_EVENT_TTL_MS) return "expired"
  if (["angry_caller", "opt_out_intent", "compliance_sensitive_language"].includes(event.eventType)) {
    return "active"
  }
  return "active"
}

export function mapLifecyclePatchAction(
  action: "acknowledge" | "dismiss" | "resolve" | "escalate",
): VoiceIntelligenceEventStatus {
  if (action === "acknowledge") return "operator_acknowledged"
  if (action === "dismiss") return "dismissed"
  if (action === "resolve") return "resolved"
  return "escalated"
}

export function mapGrowthGuidancePatchAction(action: "acknowledge" | "dismiss"): "accept" | "dismiss" {
  return action === "acknowledge" ? "accept" : "dismiss"
}

export function isActiveAssistLifecycle(status: UnifiedOperatorAssistLifecycleStatus): boolean {
  return status === "active" || status === "escalated"
}
