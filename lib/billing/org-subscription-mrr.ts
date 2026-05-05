import "server-only"

import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { resolveListMrrCents } from "@/lib/billing/discount-pricing"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"
import { resolvePlanAndBillingCycleFromStripePriceId } from "@/lib/billing/stripe-price-map"

type SubLike = {
  plan_id: string | null | undefined
  billing_cycle: string | null | undefined
  stripe_subscription_id?: string | null
  stripe_price_id?: string | null
}

/**
 * Plan + cycle used for **MRR list pricing**. When a Stripe subscription is linked and
 * `stripe_price_id` maps via env/catalog, those values drive MRR so totals match Stripe’s line item.
 * Otherwise falls back to DB `plan_id` / `billing_cycle` (e.g. trial without Stripe sub, or manual admin row).
 */
export function effectivePlanAndBillingCycleForStripeMrr(sub: SubLike): {
  planId: string
  billingCycle: "monthly" | "annual"
} {
  const stripeSub = normalizeStripeIdColumn(sub.stripe_subscription_id ?? null)
  const priceId = normalizeStripeIdColumn(sub.stripe_price_id ?? null)
  if (stripeSub && priceId) {
    const mapped = resolvePlanAndBillingCycleFromStripePriceId(priceId)
    if (mapped.planId && mapped.billingCycle) {
      return { planId: mapped.planId, billingCycle: mapped.billingCycle }
    }
  }
  const cycle =
    sub.billing_cycle === "annual" || sub.billing_cycle === "monthly" ? sub.billing_cycle : "monthly"
  return { planId: normalizePlanIdForRead(String(sub.plan_id ?? "solo")), billingCycle: cycle }
}

/** Catalog list MRR (pre-discount) in cents for reporting / admin. */
export function listMrrBaseCentsForSubscriptionRow(sub: SubLike): number {
  const { planId, billingCycle } = effectivePlanAndBillingCycleForStripeMrr(sub)
  return resolveListMrrCents(planId, billingCycle)
}
