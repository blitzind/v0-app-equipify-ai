import type { CombinedArApCashForecast } from "@/lib/blitzpay/blitzpay-command-center-math"

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

  return out
}
