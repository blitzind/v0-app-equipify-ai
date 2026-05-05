import "server-only"

import { monthlyListPriceUsd } from "@/lib/billing/pricing"
import { applyDiscountToMrrCents } from "@/lib/billing/discount-pricing"

type SubLike = {
  plan_id: string | null | undefined
  billing_cycle: string | null | undefined
  status: string | null | undefined
  trial_ends_at?: string | null
  discount_type: string | null | undefined
  discount_value: number | string | null | undefined
  discount_expires_at: string | null | undefined
}

function trialStillActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt || String(trialEndsAt).trim() === "") return false
  const t = new Date(trialEndsAt).getTime()
  return Number.isFinite(t) && t > Date.now()
}

/**
 * MRR for platform admin: list price from `pricing.ts` + internal discounts (cents, expiry-aware).
 * Annual plans use monthly-equivalent rates from `monthlyListPriceUsd`.
 *
 * - **Paid MRR total** — only Stripe-equivalent `active` subscriptions (excludes trialing, past_due, paused, canceled, archived orgs).
 * - **Trial pipeline** — `trialing` with a future `trial_ends_at` (estimated value if those workspaces converted).
 */
export function computePlatformAdminMrr(sub: SubLike | null, orgArchived: boolean): {
  baseCents: number
  finalCents: number
  hasActiveDiscount: boolean
  mrrBaseCents: number | null
  /** Included in platform “Paid MRR” aggregate */
  paidMrrCents: number
  /** Not paid; shown as trial pipeline */
  trialPipelineMrrCents: number
  showMrrInTable: boolean
} {
  if (orgArchived || !sub) {
    return {
      baseCents: 0,
      finalCents: 0,
      hasActiveDiscount: false,
      mrrBaseCents: null,
      paidMrrCents: 0,
      trialPipelineMrrCents: 0,
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

  const finalCents = parsed.finalCents

  const paidMrrCents = st === "active" ? finalCents : 0

  const trialPipelineMrrCents =
    st === "trialing" && trialStillActive(sub.trial_ends_at) ? finalCents : 0

  return {
    baseCents,
    finalCents,
    hasActiveDiscount,
    mrrBaseCents,
    paidMrrCents,
    trialPipelineMrrCents,
    showMrrInTable,
  }
}
