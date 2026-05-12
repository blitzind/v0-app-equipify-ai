import { canAccessApiFeatures } from "@/lib/billing/feature-access"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getApiCallLimitDisplay } from "@/lib/billing/entitlements"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { isTrialActive } from "@/lib/billing/subscriptions"
import type { PlanId } from "@/lib/plans"

/**
 * Commercial tier band for Settings → API / Developers messaging.
 * Uses the same effective-plan rules as billing (trial maps to Scale entitlements).
 */
export type DeveloperAccessBand = "solo_core" | "growth" | "scale"

export function resolveDeveloperAccessBand(
  storedPlanId: string | null | undefined,
  subscription: OrganizationSubscription | null,
): DeveloperAccessBand {
  const id = getEffectivePlanId(normalizePlanIdForRead(storedPlanId ?? "solo"), subscription)
  if (id === "solo" || id === "core") return "solo_core"
  if (id === "growth") return "growth"
  return "scale"
}

/** True when `api_access` is on the effective plan (Scale, or active trial per entitlements). */
export function isDeveloperAccessEntitled(
  storedPlanId: string | null | undefined,
  subscription: OrganizationSubscription | null,
): boolean {
  return canAccessApiFeatures(storedPlanId ?? "solo", subscription)
}

/** First commercial tier that includes `api_access` in `lib/billing/entitlements.ts` (upgrade CTA). */
export const DEVELOPER_API_MIN_PLAN: PlanId = "scale"
export function plannedMonthlyApiRequestCap(
  storedPlanId: string | null | undefined,
  subscription: OrganizationSubscription | null,
): number | null {
  const trial = subscription ? isTrialActive(subscription) : false
  return getApiCallLimitDisplay(storedPlanId ?? "solo", trial)
}
