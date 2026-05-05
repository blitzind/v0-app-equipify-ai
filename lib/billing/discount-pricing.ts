import { getPlan } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

/** List MRR in cents from canonical plan catalog (`lib/plans.ts`). */
export function resolveListMrrCents(
  planId: string | null | undefined,
  billingCycle: "monthly" | "annual",
): number {
  const plan = getPlan(normalizePlanIdForRead(planId ?? ""))
  return billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly
}

export type ParsedDiscount = {
  finalCents: number
  /** True when a non-expired percent/fixed discount is applied. */
  active: boolean
}

/**
 * Pure price reduction (amounts in **cents** for fixed discounts).
 * `discountValue` for `fixed` is cents off; for `percent` it is 1–100.
 */
export function applyDiscount(
  price: number,
  discountType: string | null | undefined,
  discountValue: number | null | undefined,
): number {
  if (discountType == null || discountValue == null) return price
  const t = String(discountType).trim().toLowerCase()
  if (!t || t === "none") return price
  const raw = typeof discountValue === "number" ? discountValue : parseFloat(String(discountValue))
  if (!Number.isFinite(raw)) return price
  if (t === "percent") {
    const pct = Math.min(100, Math.max(0, raw))
    return Math.max(0, Math.round(price * (1 - pct / 100)))
  }
  if (t === "fixed") {
    return Math.max(0, Math.round(price - raw))
  }
  return price
}

/**
 * Applies internal discount fields to list MRR (cents).
 * `discount_value` for `fixed` is **cents** off; for `percent` it is 1–100.
 */
export function applyDiscountToMrrCents(
  baseCents: number,
  discountType: string | null | undefined,
  discountValue: number | string | null | undefined,
  discountExpiresAt: string | null | undefined,
): ParsedDiscount {
  if (discountExpiresAt) {
    const expMs = new Date(discountExpiresAt).getTime()
    if (!Number.isNaN(expMs) && expMs < Date.now()) {
      return { finalCents: baseCents, active: false }
    }
  }

  const t = discountType?.trim().toLowerCase()
  if (!t || t === "none") {
    return { finalCents: baseCents, active: false }
  }

  const raw =
    typeof discountValue === "string" ? parseFloat(discountValue) : Number(discountValue)
  if (!Number.isFinite(raw)) {
    return { finalCents: baseCents, active: false }
  }

  if (t === "percent" || t === "fixed") {
    const finalCents = applyDiscount(baseCents, t, raw)
    return { finalCents, active: true }
  }

  return { finalCents: baseCents, active: false }
}
