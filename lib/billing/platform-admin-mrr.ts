import "server-only"

import { monthlyListPriceUsd } from "@/lib/billing/pricing"
import { applyDiscountToMrrCents } from "@/lib/billing/discount-pricing"

type SubLike = {
  plan_id: string | null | undefined
  billing_cycle: string | null | undefined
  status: string | null | undefined
  discount_type: string | null | undefined
  discount_value: number | string | null | undefined
  discount_expires_at: string | null | undefined
}

/**
 * MRR for platform admin: list price from `pricing.ts` + internal discounts (cents, expiry-aware).
 * Platform total counts only non-archived orgs with subscription status `active` or `trialing`.
 */
export function computePlatformAdminMrr(sub: SubLike | null, orgArchived: boolean): {
  baseCents: number
  finalCents: number
  hasActiveDiscount: boolean
  mrrBaseCents: number | null
  countsTowardPlatformTotal: boolean
  showMrrInTable: boolean
} {
  if (orgArchived || !sub) {
    return {
      baseCents: 0,
      finalCents: 0,
      hasActiveDiscount: false,
      mrrBaseCents: null,
      countsTowardPlatformTotal: false,
      showMrrInTable: false,
    }
  }

  const cycle =
    sub.billing_cycle === "annual" || sub.billing_cycle === "monthly" ? sub.billing_cycle : "monthly"

  const baseUsd = monthlyListPriceUsd(sub.plan_id, cycle)
  const baseCents = Math.round(baseUsd * 100)

  const parsed = applyDiscountToMrrCents(
    baseCents,
    sub.discount_type,
    sub.discount_value,
    sub.discount_expires_at,
  )

  const dt = sub.discount_type?.trim().toLowerCase()
  const typedDisc = dt === "percent" || dt === "fixed"
  const hasActiveDiscount = Boolean(parsed.active && typedDisc)
  const mrrBaseCents =
    hasActiveDiscount && baseCents > parsed.finalCents ? baseCents : null

  const st = String(sub.status ?? "")
    .trim()
    .toLowerCase()

  const excludedFromTable = new Set(["canceled", "unpaid", "incomplete_expired"])
  const showMrrInTable = !excludedFromTable.has(st)

  const countsTowardPlatformTotal = st === "active" || st === "trialing"

  return {
    baseCents,
    finalCents: parsed.finalCents,
    hasActiveDiscount,
    mrrBaseCents,
    countsTowardPlatformTotal,
    showMrrInTable,
  }
}
