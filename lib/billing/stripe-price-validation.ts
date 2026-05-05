import "server-only"

import type { PlanId } from "@/lib/plans"
import { PLANS } from "@/lib/plans"
import { stripePriceIdForPlan } from "@/lib/billing/stripe-price-map"

/** Legacy dev-only fake IDs — reject so checkout cannot run with accidental placeholders. */
const PLACEHOLDER_PRICE_PATTERN =
  /^price_(solo|core|growth|scale)_(monthly|annual)$/i

export function validateCheckoutPlanAndCycle(
  planId: string,
  billingCycle: string,
): { ok: true; plan: (typeof PLANS)[number] } | { ok: false; error: string } {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) {
    return { ok: false, error: "Invalid plan." }
  }
  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return { ok: false, error: "Billing cycle must be monthly or annual." }
  }
  return { ok: true, plan }
}

export function validateStripePriceId(priceId: string): { ok: true } | { ok: false; error: string } {
  const id = priceId.trim()
  if (!id.startsWith("price_")) {
    return { ok: false, error: "Stripe Price ID must start with price_." }
  }
  if (PLACEHOLDER_PRICE_PATTERN.test(id)) {
    return {
      ok: false,
      error:
        "Stripe Price ID looks like a legacy placeholder (e.g. price_solo_monthly). Use a Price ID from Stripe Dashboard → Products.",
    }
  }
  if (id.length < 24) {
    return {
      ok: false,
      error:
        "Stripe Price ID looks invalid (too short). Use the Price ID copied from Stripe Dashboard → Products.",
    }
  }
  return { ok: true }
}

export function priceIdForPlan(planId: PlanId, billingCycle: "monthly" | "annual"): string {
  return stripePriceIdForPlan(planId, billingCycle)
}
