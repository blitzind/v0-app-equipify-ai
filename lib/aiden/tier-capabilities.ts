import type { PlanId } from "@/lib/plans"
import { planRank } from "@/lib/ai/plan-ai-config"

/** Tracked + gated AIden surfaces (Phase 3 foundation + Phase 4 productivity usage keys). */
export const AIDEN_TRACKED_FEATURES = [
  "support_chat",
  "feature_request",
  "customer_summary",
  "work_order_summary",
  "draft_generation",
  "operational_recommendations",
] as const
export type AidenTrackedFeatureKey = (typeof AIDEN_TRACKED_FEATURES)[number]

/** Future-only keys (partially wired — see `canUseAidenCapability`). */
export type AidenFutureCapabilityKey = "productivity_ai" | "operational_copilot" | "summaries_drafting"

export type AidenPageGuidanceLevel = "limited" | "rich"

/**
 * Core+ gets richer contextual guidance in prompts; Solo stays concise.
 */
export function getAidenPageGuidanceLevel(planId: PlanId): AidenPageGuidanceLevel {
  return planRank(planId) >= planRank("core") ? "rich" : "limited"
}

/**
 * Whether an org on `planId` may use an AIden feature today.
 * Future-only keys return false until those phases ship.
 */
export function canUseAidenCapability(
  planId: PlanId,
  feature: AidenTrackedFeatureKey | AidenFutureCapabilityKey | "page_guidance",
): boolean {
  switch (feature) {
    case "support_chat":
    case "feature_request":
    case "page_guidance":
      return true
    case "productivity_ai":
    case "summaries_drafting":
      return planRank(planId) >= planRank("growth")
    case "operational_copilot":
      return planRank(planId) >= planRank("scale")
    default:
      return false
  }
}
