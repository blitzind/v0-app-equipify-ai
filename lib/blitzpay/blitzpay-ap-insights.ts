import type { ApObligationBuckets } from "@/lib/blitzpay/blitzpay-ap-math"
import { projectedOutgoingCashCents, reserveStressRatio } from "@/lib/blitzpay/blitzpay-ap-math"

export type BlitzpayApInsight = { severity: "warning" | "info"; code: string; message: string }

export type BlitzpayApInsightContext = {
  buckets: ApObligationBuckets
  /** Operating balance from treasury (Stripe-derived). */
  operatingBalanceCents: number
  reserveTargetCents: number
  stripeEstimateUpcomingTransferCents: number
  /** Sum of invoice-style collections in window vs material AP trend — optional heuristic. */
  collectionsWindowCents?: number
  materialExpenseWindowCents?: number
  /** Vendor labels with overdue open rows (deduped). */
  overdueVendorLabels?: string[]
  overdueOpenCountByVendor?: Record<string, number>
}

export function buildBlitzpayApInsights(ctx: BlitzpayApInsightContext): BlitzpayApInsight[] {
  const out: BlitzpayApInsight[] = []
  const proj = projectedOutgoingCashCents({
    apOpenDueWithin7DaysCents: ctx.buckets.dueWithin7DaysOpenCents,
    stripeEstimateUpcomingTransferCents: ctx.stripeEstimateUpcomingTransferCents,
  })
  if (proj > 0 && ctx.operatingBalanceCents < proj) {
    out.push({
      severity: "warning",
      code: "ap_exceeds_operating_runway",
      message: "Upcoming vendor obligations (7d) plus scheduled transfers exceed current operating balance.",
    })
  }

  const vendors = ctx.overdueVendorLabels ?? []
  if (vendors.length >= 2) {
    out.push({
      severity: "info",
      code: "multiple_vendors_overdue",
      message: "Several vendors currently have overdue open payables — review scheduling and approvals.",
    })
  } else if (vendors.length === 1) {
    out.push({
      severity: "info",
      code: "vendor_frequently_overdue",
      message: `Vendor “${vendors[0]}” has overdue open payables — consider tightening terms or scheduling.`,
    })
  }

  const coll = ctx.collectionsWindowCents
  const mat = ctx.materialExpenseWindowCents
  if (coll != null && mat != null && coll > 0 && mat > coll * 1.15) {
    out.push({
      severity: "info",
      code: "material_vs_collections",
      message: "Material expenses are rising faster than collections in the reporting window.",
    })
  }

  if (ctx.buckets.pendingReimbursementOpenCents > 0 && ctx.buckets.pendingReimbursementOpenCents > ctx.operatingBalanceCents * 0.25) {
    out.push({
      severity: "warning",
      code: "reimbursement_pressure",
      message: "Pending reimbursements may materially impact available operating balance.",
    })
  }

  const stress = reserveStressRatio({
    reserveTargetCents: ctx.reserveTargetCents,
    apOpenDueWithin30DaysCents: ctx.buckets.dueWithin30DaysOpenCents,
  })
  if (stress != null && stress > 1.25 && ctx.reserveTargetCents > 0) {
    out.push({
      severity: "warning",
      code: "reserve_low_for_ap",
      message: "Reserve target may be too low relative to payables due in the next 30 days.",
    })
  }

  return out
}
