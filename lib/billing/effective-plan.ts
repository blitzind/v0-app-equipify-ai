import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isTrialActive } from "@/lib/billing/subscriptions"

/**
 * Plan shown in product UI and limits during an active trial: Scale tier experience.
 * Stored `organization_subscriptions.plan_id` remains the billing plan (e.g. solo).
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
