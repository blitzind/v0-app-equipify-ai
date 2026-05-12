import type { CombinedArApCashForecast } from "@/lib/blitzpay/blitzpay-command-center-math"
import type { BlitzpayCashRunwayStatus } from "@/lib/blitzpay/blitzpay-cash-accounts"

export type FinancialCommandCenterRecommendation = {
  id: string
  severity: "info" | "warning"
  message: string
}

export type FinancialCommandCenterRecommendationInput = {
  combined: CombinedArApCashForecast
  overdueInvoiceCount: number
  overdueCollectibleCents: number
  apDue7OpenCents: number
  apDue30OpenCents: number
  expectedInflow30Cents: number
  reserveTargetCents: number
  heldReserveCents: number
  openDisputesAmountCents: number
  failedPayoutCount30d: number
  financingReadyQuotesCount: number
  estimateOpenQuotesWithTotalCount: number
  workOrderCollectPaymentLinksWindowCount: number
  pendingApprovalPayableCount: number
  /** Phase 2Z — optional internal cash planning (deterministic copy). */
  cashRunwayStatus?: BlitzpayCashRunwayStatus
  cashReserveGapCents?: number
  estimatedOperatingCashCents?: number
  payrollLiabilityCents?: number
  expectedInflows30Cents?: number
  expectedOutflows30Cents?: number
  recurringPlannedInflow30dCents?: number
  /** Phase 3A — optional GL control totals from reporting snapshot. */
  trialBalanceHealthy?: boolean
  unreconciledBatchCount?: number
  pendingRevenueRecognitionCount?: number
}

export function buildFinancialCommandCenterRecommendations(
  input: FinancialCommandCenterRecommendationInput,
): FinancialCommandCenterRecommendation[] {
  const out: FinancialCommandCenterRecommendation[] = []

  if (input.pendingApprovalPayableCount > 0 && input.overdueInvoiceCount > 0) {
    out.push({
      id: "collect_before_ap",
      severity: "warning",
      message: "Collect overdue invoices before approving large vendor payouts — cash timing risk.",
    })
  }

  if (input.apDue30OpenCents > input.expectedInflow30Cents && input.expectedInflow30Cents > 0) {
    out.push({
      id: "ap_exceeds_collections_forecast",
      severity: "warning",
      message: "Upcoming vendor obligations may exceed expected collections in the next 30 days.",
    })
  }

  if (input.overdueInvoiceCount > 0 && input.apDue7OpenCents > 0) {
    out.push({
      id: "reminders_before_ap",
      severity: "info",
      message: "Run reminders on overdue invoices before near-term AP due dates to protect liquidity.",
    })
  }

  const reserveGap = Math.max(0, input.reserveTargetCents - input.heldReserveCents)
  if (reserveGap > 0 && (input.openDisputesAmountCents > 5_000_00 || input.failedPayoutCount30d > 0)) {
    out.push({
      id: "raise_reserve",
      severity: "info",
      message: "Consider raising the reserve target based on payout and dispute exposure.",
    })
  }

  if (input.financingReadyQuotesCount >= 2 && input.estimateOpenQuotesWithTotalCount > 0) {
    out.push({
      id: "financing_large_quotes",
      severity: "info",
      message: "Offer financing on large open quotes to improve close rate and upfront cash options.",
    })
  }

  if (input.workOrderCollectPaymentLinksWindowCount === 0 && input.estimateOpenQuotesWithTotalCount > 3) {
    out.push({
      id: "wo_payment_links",
      severity: "info",
      message: "Use work-order payment links on active jobs to accelerate collections from the field.",
    })
  }

  if (input.combined.netCashPosition7Cents < 0) {
    out.push({
      id: "tight_runway_7d",
      severity: "warning",
      message: "Seven-day net cash forecast is negative after payables and payout pressure — triage AR and AP timing.",
    })
  }

  const runway = input.cashRunwayStatus
  const gap = input.cashReserveGapCents ?? 0
  const op = input.estimatedOperatingCashCents ?? 0
  const payrollLiab = input.payrollLiabilityCents ?? 0
  if (runway === "risk" && gap > 0) {
    out.push({
      id: "cash_runway_risk",
      severity: "warning",
      message: "Cash runway looks stressed — review reserve target and upcoming obligations before large payouts.",
    })
  }
  if (runway === "watch") {
    out.push({
      id: "cash_runway_watch",
      severity: "info",
      message: "Cash runway is in a watch band — confirm expected incoming payments against vendor and payroll timing.",
    })
  }
  if (payrollLiab > 0 && op > 0 && payrollLiab > op * 0.4) {
    out.push({
      id: "payroll_reserve_low",
      severity: "info",
      message: "Payroll reserve is below recommended target relative to available operating cash.",
    })
  }
  const inf30 = input.expectedInflows30Cents ?? input.recurringPlannedInflow30dCents ?? 0
  const out30 = input.expectedOutflows30Cents ?? 0
  if (inf30 > 0 && out30 > 0 && inf30 >= out30) {
    out.push({
      id: "collections_cover_ap",
      severity: "info",
      message: "Expected collections cover upcoming AP obligations in the next 30 days.",
    })
  }
  if (input.pendingApprovalPayableCount > 0 && gap > 50_000) {
    out.push({
      id: "hold_before_vendor_payouts",
      severity: "warning",
      message: "Hold additional cash before approving vendor payouts — reserve gap is elevated.",
    })
  }
  if ((input.recurringPlannedInflow30dCents ?? 0) > payrollLiab && (input.recurringPlannedInflow30dCents ?? 0) > 0) {
    out.push({
      id: "membership_renewal_confidence",
      severity: "info",
      message: "Upcoming membership renewals improve cash-flow confidence.",
    })
  }

  if (input.trialBalanceHealthy === false) {
    out.push({
      id: "gl_trial_balance_review",
      severity: "warning",
      message: "Internal books trial balance does not tie — review posted journals before period close.",
    })
  }
  const drafts = input.unreconciledBatchCount ?? 0
  if (drafts > 0) {
    out.push({
      id: "gl_draft_batches",
      severity: "info",
      message: `You have ${Math.min(99_999, drafts)} draft journal batch(es) — post or archive before relying on books.`,
    })
  }
  const pendingRev = input.pendingRevenueRecognitionCount ?? 0
  if (pendingRev > 0) {
    out.push({
      id: "gl_revenue_recognition_due",
      severity: "info",
      message: `${Math.min(99_999, pendingRev)} deferred revenue schedule(s) are due for recognition — run the staff revenue recognition job when ready.`,
    })
  }

  return out
}
