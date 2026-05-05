import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isTrialActive } from "@/lib/billing/subscriptions"

/**
 * Effective product tier for limits and UI during an active trial: Scale.
 * New onboarding stores `plan_id` = scale while trialing; `intended_plan_id` holds the
 * paid tier for checkout. Legacy rows may keep a lower `plan_id` during trial — this
 * still maps to Scale access until the trial ends.
 */
export function getEffectivePlanId(
  planId: string,
  subscription: OrganizationSubscription | null,
): PlanId {
  if (subscription?.status === "trialing" && isTrialActive(subscription)) {
    return "scale"
  }
  return normalizePlanIdForRead(planId)
}
