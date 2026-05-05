import type { PlanId } from "@/lib/plans"

const VALID = new Set<string>(["solo", "core", "growth", "scale"])

/**
 * Map DB or client plan strings to a valid {@link PlanId} for display and `getPlan`.
 * Legacy `starter` → `solo` (default trial / pre-Stripe tier).
 */
export function normalizePlanIdForRead(raw: string): PlanId {
  const t = raw.trim().toLowerCase()
  if (VALID.has(t)) return t as PlanId
  if (t === "starter") return "solo"
  return "solo"
}

/**
 * Map Stripe metadata / subscription `plan_id` to a value safe to store on `organization_subscriptions`.
 * Never returns `enterprise`. Unknown legacy values map to `core` if a Stripe subscription exists, else `solo`.
 */
export function normalizePlanIdForPersistence(
  raw: string | null | undefined,
  hasStripeSubscription: boolean,
): PlanId | null {
  if (raw == null) return null
  const t = raw.trim().toLowerCase()
  if (t === "") return null
  if (VALID.has(t)) return t as PlanId
  if (t === "starter") return hasStripeSubscription ? "core" : "solo"
  if (t === "enterprise") return null
  return hasStripeSubscription ? "core" : "solo"
}
