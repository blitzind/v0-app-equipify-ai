/**
 * Pure helpers for summarizing synced Stripe balance transactions (tests + reporting).
 */

export type BlitzpayBalanceTransactionSummaryRow = {
  balance_type: string
  gross_cents: number
  fee_cents: number
  net_cents: number
}

const PAYOUT_LIKE_TYPES = new Set(["payout", "payout_failure", "payout_cancel"])

/** Activity types that move the connected-account balance excluding bank payouts. */
export function isBlitzpayConnectedAccountActivityType(balanceType: string): boolean {
  return !PAYOUT_LIKE_TYPES.has(balanceType)
}

export type BlitzpayReconciliationTotals = {
  /** Rows counted (activity only). */
  activityRowCount: number
  /** Sum of gross_cents for activity rows. */
  sumGrossCents: number
  /** Sum of Stripe fee components (fee_cents). */
  sumStripeFeesCents: number
  /** Sum of net_cents for activity rows. */
  sumNetCents: number
  /** Net from payment-like rows (customer funds). */
  paymentLikeNetCents: number
  /** Net from refund / reversal types. */
  refundLikeNetCents: number
  /** Net from dispute types. */
  disputeLikeNetCents: number
}

const PAYMENT_LIKE = new Set(["charge", "payment"])
const REFUND_LIKE = new Set(["refund", "payment_refund", "payment_failure_refund", "refund_failure"])
const DISPUTE_LIKE = new Set(["dispute", "issuing_dispute"])

export function summarizeBlitzpayBalanceTransactions(rows: BlitzpayBalanceTransactionSummaryRow[]): BlitzpayReconciliationTotals {
  let activityRowCount = 0
  let sumGrossCents = 0
  let sumStripeFeesCents = 0
  let sumNetCents = 0
  let paymentLikeNetCents = 0
  let refundLikeNetCents = 0
  let disputeLikeNetCents = 0

  for (const r of rows) {
    const t = String(r.balance_type || "")
    if (!isBlitzpayConnectedAccountActivityType(t)) continue
    activityRowCount += 1
    sumGrossCents += Math.round(Number(r.gross_cents))
    sumStripeFeesCents += Math.round(Number(r.fee_cents))
    const net = Math.round(Number(r.net_cents))
    sumNetCents += net
    if (PAYMENT_LIKE.has(t)) paymentLikeNetCents += net
    else if (REFUND_LIKE.has(t)) refundLikeNetCents += net
    else if (DISPUTE_LIKE.has(t)) disputeLikeNetCents += net
  }

  return {
    activityRowCount,
    sumGrossCents,
    sumStripeFeesCents,
    sumNetCents,
    paymentLikeNetCents,
    refundLikeNetCents,
    disputeLikeNetCents,
  }
}
