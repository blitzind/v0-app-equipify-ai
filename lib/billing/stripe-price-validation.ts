import "server-only"

import type { PlanId } from "@/lib/plans"
import { PLANS } from "@/lib/plans"

/** Repo placeholders in lib/plans.ts — not valid Stripe Dashboard price IDs. */
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
        "Stripe Price ID looks like a placeholder (e.g. price_solo_monthly). Replace lib/plans.ts entries with real Price IDs from the Stripe Dashboard.",
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
  const plan = PLANS.find((p) => p.id === planId)!
  return billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId
}
