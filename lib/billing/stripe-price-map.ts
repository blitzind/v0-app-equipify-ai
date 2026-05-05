import "server-only"

import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

/**
 * Optional env overrides for Stripe Price IDs (per-deploy staging/live catalogs).
 * When unset, callers use `PLANS[].stripeMonthlyPriceId` / `stripeAnnualPriceId`, sourced from
 * `PLAN_PRICE_IDS` in `lib/plans.ts`.
 */
const ENV_KEYS: Record<PlanId, { monthly: string; annual: string }> = {
  solo: { monthly: "STRIPE_PRICE_SOLO_MONTHLY", annual: "STRIPE_PRICE_SOLO_ANNUAL" },
  core: { monthly: "STRIPE_PRICE_CORE_MONTHLY", annual: "STRIPE_PRICE_CORE_ANNUAL" },
  growth: { monthly: "STRIPE_PRICE_GROWTH_MONTHLY", annual: "STRIPE_PRICE_GROWTH_ANNUAL" },
  scale: { monthly: "STRIPE_PRICE_SCALE_MONTHLY", annual: "STRIPE_PRICE_SCALE_ANNUAL" },
}

/** Resolved Price ID for Embedded Checkout / API (env wins, then catalog placeholder). */
export function stripePriceIdForPlan(planId: PlanId, billingCycle: "monthly" | "annual"): string {
  const keys = ENV_KEYS[planId]
  const key = billingCycle === "annual" ? keys.annual : keys.monthly
  const raw = typeof process.env[key] === "string" ? process.env[key]!.trim() : ""
  if (raw) return raw
  const plan = PLANS.find((p) => p.id === planId)!
  return billingCycle === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId
}

/**
 * Infer Equipify plan + billing cycle from a Stripe Price ID by matching env-configured
 * or catalog IDs. Returns nulls when the price is unknown (webhook should rely on metadata).
 */
export function resolvePlanAndBillingCycleFromStripePriceId(
  priceId: string | null | undefined,
): { planId: PlanId | null; billingCycle: "monthly" | "annual" | null } {
  const norm = normalizeStripeIdColumn(priceId)
  if (!norm) return { planId: null, billingCycle: null }

  for (const pid of PLAN_IDS) {
    for (const cycle of ["monthly", "annual"] as const) {
      const candidate = normalizeStripeIdColumn(stripePriceIdForPlan(pid, cycle))
      if (candidate && candidate === norm) {
        return { planId: pid, billingCycle: cycle }
      }
    }
  }

  return { planId: null, billingCycle: null }
}
