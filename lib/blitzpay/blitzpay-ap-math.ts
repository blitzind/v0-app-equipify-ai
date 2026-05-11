import { isOpenVendorPayableStatus } from "@/lib/blitzpay/blitzpay-payable-lifecycle"

export type PayableDueRow = {
  amount_cents: number
  due_date: string
  status: string
}

export type ApObligationBuckets = {
  outstandingOpenCents: number
  overdueOpenCents: number
  dueWithin7DaysOpenCents: number
  dueWithin30DaysOpenCents: number
  dueWithin60DaysOpenCents: number
  pendingReimbursementOpenCents: number
  materialOpenCents: number
  workOrderLinkedOpenCents: number
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((x) => Number(x))
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

function addDaysYmd(ymd: string, days: number): string {
  const ms = ymdToUtcMs(ymd) + days * 86400_000
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const da = String(dt.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

/**
 * Aggregates open (non-paid/failed) payables by due windows. `todayYmd` is UTC calendar date YYYY-MM-DD.
 */
export function aggregateApObligationBuckets(
  rows: Array<
    PayableDueRow & {
      reimbursement_flag?: boolean
      material_cost_flag?: boolean
      work_order_id?: string | null
    }
  >,
  todayYmd: string,
): ApObligationBuckets {
  const d7 = addDaysYmd(todayYmd, 7)
  const d30 = addDaysYmd(todayYmd, 30)
  const d60 = addDaysYmd(todayYmd, 60)
  const todayMs = ymdToUtcMs(todayYmd)

  let outstandingOpenCents = 0
  let overdueOpenCents = 0
  let dueWithin7DaysOpenCents = 0
  let dueWithin30DaysOpenCents = 0
  let dueWithin60DaysOpenCents = 0
  let pendingReimbursementOpenCents = 0
  let materialOpenCents = 0
  let workOrderLinkedOpenCents = 0

  for (const r of rows) {
    if (!isOpenVendorPayableStatus(r.status)) continue
    const cents = Math.max(0, Math.round(Number(r.amount_cents)))
    outstandingOpenCents += cents
    const due = String(r.due_date || "").slice(0, 10)
    const dueMs = ymdToUtcMs(due)
    if (dueMs < todayMs) overdueOpenCents += cents
    if (due <= d7) dueWithin7DaysOpenCents += cents
    if (due <= d30) dueWithin30DaysOpenCents += cents
    if (due <= d60) dueWithin60DaysOpenCents += cents
    if (r.reimbursement_flag) pendingReimbursementOpenCents += cents
    if (r.material_cost_flag) materialOpenCents += cents
    if (r.work_order_id) workOrderLinkedOpenCents += cents
  }

  return {
    outstandingOpenCents,
    overdueOpenCents,
    dueWithin7DaysOpenCents,
    dueWithin30DaysOpenCents,
    dueWithin60DaysOpenCents,
    pendingReimbursementOpenCents,
    materialOpenCents,
    workOrderLinkedOpenCents,
  }
}

export type VendorPayoutVelocityInput = { amount_cents: number; recorded_at: string }

export function vendorPayoutVelocityPaidCents(rows: VendorPayoutVelocityInput[], sinceIso: string): number {
  const since = Date.parse(sinceIso)
  if (!Number.isFinite(since)) return 0
  let sum = 0
  for (const r of rows) {
    const t = Date.parse(r.recorded_at)
    if (!Number.isFinite(t) || t < since) continue
    sum += Math.max(0, Math.round(Number(r.amount_cents)))
  }
  return sum
}

/**
 * Conservative projected outgoing cash: internal AP due soon + Stripe-side upcoming transfer estimate.
 */
export function projectedOutgoingCashCents(input: {
  apOpenDueWithin7DaysCents: number
  stripeEstimateUpcomingTransferCents: number
}): number {
  return (
    Math.max(0, Math.round(input.apOpenDueWithin7DaysCents)) +
    Math.max(0, Math.round(input.stripeEstimateUpcomingTransferCents))
  )
}

export function reserveStressRatio(input: {
  reserveTargetCents: number
  apOpenDueWithin30DaysCents: number
}): number | null {
  const target = Math.max(0, Math.round(input.reserveTargetCents))
  if (target <= 0) return null
  return Math.max(0, Math.round(input.apOpenDueWithin30DaysCents)) / target
}
