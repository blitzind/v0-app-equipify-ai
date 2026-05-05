/**
 * Discount on a single numeric price (same units as `price` and `discountValue` for fixed).
 * For subscription MRR in cents + DB fields, prefer `applyDiscountToMrrCents` in `discount-pricing.ts`
 * (fixed = cents off, expiry-aware).
 */

export function applyDiscount(
  price: number,
  discountType: string | null | undefined,
  discountValue: number | null | undefined,
): number {
  if (discountType == null || discountValue == null) return price
  const t = String(discountType).trim().toLowerCase()
  if (!t || t === "none") return price

  if (t === "percent") {
    const pct = Number(discountValue)
    if (!Number.isFinite(pct)) return price
    return price * (1 - pct / 100)
  }

  if (t === "fixed") {
    const off = Number(discountValue)
    if (!Number.isFinite(off)) return price
    return Math.max(0, price - off)
  }

  return price
}
