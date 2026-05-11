export type OwnerScorecardStatus = "healthy" | "watch" | "needs_attention"

export type OwnerScorecard = {
  id: string
  title: string
  status: OwnerScorecardStatus
  detail: string
}

export type OwnerScorecardInputs = {
  overdueInvoiceCount: number
  overdueCollectibleCents: number
  netCashPosition30Cents: number
  netCashPosition7Cents: number
  abandonedCheckoutInvoices: number
  stripePayoutsEnabled: boolean
  failedPayoutCount30d: number
  apDue30OpenCents: number
  operatingBalanceCents: number
  walletLiabilityCents: number
  openDisputesCount: number
  openDisputesAmountCents: number
  reminderEffectivenessRatePct: number
}

function overdueStatus(count: number, cents: number): OwnerScorecardStatus {
  if (count === 0 && cents < 5_000_00) return "healthy"
  if (count <= 3 && cents < 25_000_00) return "watch"
  return "needs_attention"
}

function cashFlowStatus(net7: number, net30: number): OwnerScorecardStatus {
  if (net30 >= 0 && net7 >= -5_000_00) return "healthy"
  if (net30 >= -15_000_00) return "watch"
  return "needs_attention"
}

function paymentOpsStatus(abandoned: number): OwnerScorecardStatus {
  if (abandoned === 0) return "healthy"
  if (abandoned <= 2) return "watch"
  return "needs_attention"
}

function payoutReadinessStatus(enabled: boolean, failed30: number): OwnerScorecardStatus {
  if (!enabled) return "needs_attention"
  if (failed30 === 0) return "healthy"
  if (failed30 <= 1) return "watch"
  return "needs_attention"
}

function apPressureStatus(ap30: number, operating: number): OwnerScorecardStatus {
  if (ap30 <= 0) return "healthy"
  if (operating <= 0) return ap30 > 0 ? "needs_attention" : "watch"
  const ratio = ap30 / Math.max(1, operating)
  if (ratio < 0.35) return "healthy"
  if (ratio < 0.75) return "watch"
  return "needs_attention"
}

function walletLiabilityStatus(liability: number): OwnerScorecardStatus {
  if (liability < 2_000_00) return "healthy"
  if (liability < 15_000_00) return "watch"
  return "needs_attention"
}

function disputeRiskStatus(count: number, amount: number): OwnerScorecardStatus {
  if (count === 0) return "healthy"
  if (count <= 1 && amount < 10_000_00) return "watch"
  return "needs_attention"
}

function collectionHealthFromReminders(reminderPct: number, overdueCount: number): OwnerScorecardStatus | null {
  if (overdueCount === 0) return null
  if (reminderPct >= 25) return "watch"
  return "needs_attention"
}

/**
 * Plain-language owner scorecards (deterministic thresholds).
 */
export function buildOwnerScorecards(input: OwnerScorecardInputs): OwnerScorecard[] {
  const collection = overdueStatus(input.overdueInvoiceCount, input.overdueCollectibleCents)
  const reminderLift = collectionHealthFromReminders(input.reminderEffectivenessRatePct, input.overdueInvoiceCount)
  const collectionFinal =
    reminderLift === "needs_attention" ? "needs_attention"
    : reminderLift === "watch" && collection === "healthy" ? "watch"
    : collection

  return [
    {
      id: "collection_health",
      title: "Collection health",
      status: collectionFinal,
      detail:
        collectionFinal === "healthy" ? "Overdue invoices are low relative to thresholds."
        : collectionFinal === "watch" ? "Some overdue balance — keep reminders and follow-ups active."
        : "Overdue AR is elevated — prioritize collections before expanding spend.",
    },
    {
      id: "cash_flow_health",
      title: "Cash-flow health",
      status: cashFlowStatus(input.netCashPosition7Cents, input.netCashPosition30Cents),
      detail:
        cashFlowStatus(input.netCashPosition7Cents, input.netCashPosition30Cents) === "healthy" ?
          "Forecast net position after payables and payout pressure looks manageable."
        : "Forecast net cash after AP and payouts needs review.",
    },
    {
      id: "payment_operations_health",
      title: "Payment operations health",
      status: paymentOpsStatus(input.abandonedCheckoutInvoices),
      detail:
        paymentOpsStatus(input.abandonedCheckoutInvoices) === "healthy" ?
          "Few abandoned checkouts detected in the window."
        : "Hosted checkout starts without completions — review invoice pay UX.",
    },
    {
      id: "payout_readiness",
      title: "Payout readiness",
      status: payoutReadinessStatus(input.stripePayoutsEnabled, input.failedPayoutCount30d),
      detail:
        payoutReadinessStatus(input.stripePayoutsEnabled, input.failedPayoutCount30d) === "healthy" ?
          "Payouts are enabled with low recent failure volume."
        : "Confirm Connect payout status and investigate recent failures.",
    },
    {
      id: "ap_pressure",
      title: "AP pressure",
      status: apPressureStatus(input.apDue30OpenCents, input.operatingBalanceCents),
      detail:
        apPressureStatus(input.apDue30OpenCents, input.operatingBalanceCents) === "healthy" ?
          "30-day vendor obligations are modest versus operating balance."
        : "Open vendor payables are meaningful versus operating cash — sequence approvals carefully.",
    },
    {
      id: "customer_credit_liability",
      title: "Customer credit liability",
      status: walletLiabilityStatus(input.walletLiabilityCents),
      detail:
        walletLiabilityStatus(input.walletLiabilityCents) === "healthy" ?
          "Wallet / hosted-credit exposure is contained."
        : "Customer wallet balances are material — monitor redemption timing.",
    },
    {
      id: "dispute_refund_risk",
      title: "Dispute / refund risk",
      status: disputeRiskStatus(input.openDisputesCount, input.openDisputesAmountCents),
      detail:
        disputeRiskStatus(input.openDisputesCount, input.openDisputesAmountCents) === "healthy" ?
          "No material open disputes flagged."
        : "Open disputes or refund exposure needs finance review.",
    },
  ]
}

export function scorecardStatusLabel(status: OwnerScorecardStatus): string {
  if (status === "healthy") return "Healthy"
  if (status === "watch") return "Watch"
  return "Needs attention"
}
