/**
 * Platform admin list pricing (USD / month). Single source for MRR reporting.
 * `PLAN_PRICES` matches annual per-month equivalents ($55 Solo tier = catalog annual slice).
 */

export const PLAN_PRICES = {
  starter: 55,
  core: 158,
  growth: 318,
  scale: 638,
  enterprise: 899,
} as const

/** USD/month when billed monthly (aligned with product catalog list prices). */
export const PLAN_PRICES_MONTHLY_USD = {
  starter: 69,
  core: 197,
  growth: 397,
  scale: 797,
  enterprise: 899,
} as const

export type PlanPriceTier = keyof typeof PLAN_PRICES

export function normalizePlanPriceKey(planId: string | null | undefined): PlanPriceTier | null {
  if (planId == null || String(planId).trim() === "") return null
  const p = String(planId).trim().toLowerCase()
  if (p === "solo" || p === "starter") return "starter"
  if (p === "core") return "core"
  if (p === "growth") return "growth"
  if (p === "scale") return "scale"
  if (p === "enterprise") return "enterprise"
  return null
}

/**
 * Monthly list rate in USD for MRR (depends on billing cycle).
 * Annual uses `PLAN_PRICES` (per-month equivalent); monthly uses `PLAN_PRICES_MONTHLY_USD`.
 */
export function monthlyListPriceUsd(
  planId: string | null | undefined,
  billingCycle: "monthly" | "annual" | null | undefined,
): number {
  const key = normalizePlanPriceKey(planId)
  if (!key) return 0
  const cycle = billingCycle === "annual" || billingCycle === "monthly" ? billingCycle : "monthly"
  if (cycle === "annual") return PLAN_PRICES[key]
  return PLAN_PRICES_MONTHLY_USD[key] ?? PLAN_PRICES[key]
}
