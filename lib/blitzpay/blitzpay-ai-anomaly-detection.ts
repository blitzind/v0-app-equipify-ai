/**
 * Deterministic anomaly heuristics for BlitzPay Phase 4A (bounded; integer metrics only).
 */

import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export const BLITZPAY_AI_ANOMALY_SCORE_CAP = 100

export type BlitzpayAiAnomalySignal = {
  code: string
  severity: "low" | "medium" | "high" | "critical"
  score0to100: number
  title: string
  summary: string
  metrics: Record<string, number | string | boolean>
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Bounded scan: derive anomaly cards from reporting snapshot fields only. */
export function detectBlitzpayFinancialAnomalies(reporting: BlitzpayOrgReportingSnapshot): BlitzpayAiAnomalySignal[] {
  const out: BlitzpayAiAnomalySignal[] = []

  const ar = Math.max(0, reporting.accountsReceivableCents)
  const overdueRatio =
    ar > 0 ? Math.floor((Math.max(0, reporting.estimatedRecoverableOverdueCents) * 100) / ar) : 0
  if (overdueRatio >= 35) {
    out.push({
      code: "ar_overdue_ratio",
      severity: overdueRatio >= 55 ? "critical" : overdueRatio >= 45 ? "high" : "medium",
      score0to100: clamp(overdueRatio, 0, BLITZPAY_AI_ANOMALY_SCORE_CAP),
      title: "Overdue receivables are elevated versus open AR",
      summary:
        "A larger share of open AR is past due than we typically expect for healthy collections. Review cadence, autopay coverage, and largest overdue balances.",
      metrics: {
        overdue_ratio_pct: overdueRatio,
        estimated_recoverable_overdue_cents: reporting.estimatedRecoverableOverdueCents,
        accounts_receivable_cents: ar,
      },
    })
  }

  if (!reporting.trialBalanceHealthy || reporting.unreconciledBatchCount > 0) {
    out.push({
      code: "gl_health",
      severity: reporting.unreconciledBatchCount > 5 ? "high" : "medium",
      score0to100: clamp(55 + reporting.unreconciledBatchCount * 5, 0, 100),
      title: "General ledger reconciliation needs attention",
      summary:
        "Trial balance or batch reconciliation signals show drift. Resolve unreconciled batches before period close.",
      metrics: {
        trial_balance_healthy: reporting.trialBalanceHealthy,
        unreconciled_batch_count: reporting.unreconciledBatchCount,
      },
    })
  }

  if (reporting.treasuryFailedPayoutCount30d >= 2) {
    out.push({
      code: "treasury_failed_payouts",
      severity: reporting.treasuryFailedPayoutCount30d >= 4 ? "high" : "medium",
      score0to100: clamp(reporting.treasuryFailedPayoutCount30d * 18, 0, 100),
      title: "Repeated payout failures on the connected account",
      summary:
        "Multiple payout failures appeared in the last 30 days. This is operational risk for contractor settlements — review Stripe payout settings and bank connectivity.",
      metrics: { treasury_failed_payout_count_30d: reporting.treasuryFailedPayoutCount30d },
    })
  }

  if (reporting.failedPaymentRate >= 12) {
    out.push({
      code: "failed_payment_rate",
      severity: reporting.failedPaymentRate >= 22 ? "high" : "medium",
      score0to100: clamp(Math.floor(reporting.failedPaymentRate * 3), 0, 100),
      title: "Failed payment rate is elevated",
      summary:
        "ACH/card failure rates are higher than a healthy baseline. Confirm saved-method coverage, retry policies, and customer outreach — no automatic retries are implied here.",
      metrics: {
        failed_payment_rate: reporting.failedPaymentRate,
        collection_success_rate: reporting.collectionSuccessRate,
      },
    })
  }

  if (reporting.cashRunwayStatus === "risk") {
    out.push({
      code: "cash_runway",
      severity: "critical",
      score0to100: 90,
      title: "Cash runway signal is in the risk band",
      summary:
        "Operating cash, reserves, and near-term inflows/outflows suggest elevated liquidity pressure. Treat as a planning review, not an automatic transfer instruction.",
      metrics: {
        cash_runway_status: reporting.cashRunwayStatus,
        cash_reserve_gap_cents: reporting.cashReserveGapCents,
        estimated_operating_cash_cents: reporting.estimatedOperatingCashCents,
      },
    })
  }

  if (reporting.vendorConcentrationRisk >= 70) {
    out.push({
      code: "vendor_concentration",
      severity: reporting.vendorConcentrationRisk >= 85 ? "high" : "medium",
      score0to100: clamp(reporting.vendorConcentrationRisk, 0, 100),
      title: "Vendor concentration is high",
      summary:
        "Payables are concentrated among a small set of vendors. Diversification and approval discipline reduce operational fragility.",
      metrics: { vendor_concentration_risk: reporting.vendorConcentrationRisk },
    })
  }

  return out.slice(0, 12)
}
