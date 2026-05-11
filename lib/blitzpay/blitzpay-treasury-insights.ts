/**
 * Read-only, deterministic “insights” for contractor treasury UX (no LLM).
 */

export type BlitzpayTreasuryInsight = {
  id: string
  severity: "info" | "warning"
  message: string
}

export type BlitzpayTreasuryInsightInput = {
  avgPayoutDelayDays: number | null
  avgPayoutDelayBaselineDays: number
  pendingAchSettlementCount: number
  pendingLedgerCents: number
  instantTransferEligible: boolean
  usedInstantPayoutRecently: boolean
  openDisputeCount: number
  openDisputeBaseline: number
  estimateUpcomingTransferCents: number
  upcomingTransferBaselineCents: number
  failedPayoutCount30d: number
}

export function buildBlitzpayTreasuryInsights(input: BlitzpayTreasuryInsightInput): BlitzpayTreasuryInsight[] {
  const out: BlitzpayTreasuryInsight[] = []
  const baseline = Math.max(0.5, input.avgPayoutDelayBaselineDays)
  if (input.avgPayoutDelayDays != null && input.avgPayoutDelayDays > baseline * 1.25) {
    out.push({
      id: "payout_delays_increasing",
      severity: "warning",
      message: "Payout delays look higher than usual versus recent paid transfers — confirm Stripe payout timing and bank holidays.",
    })
  }
  if (input.pendingAchSettlementCount >= 4) {
    out.push({
      id: "large_pending_ach",
      severity: "info",
      message: "Large pending ACH settlement volume — bank transfers can take several business days before they move to your Stripe balance.",
    })
  }
  if (input.instantTransferEligible && !input.usedInstantPayoutRecently) {
    out.push({
      id: "instant_payout_fit",
      severity: "info",
      message: "This workspace may benefit from instant or faster payouts when Stripe makes them available for the connected account.",
    })
  }
  if (input.openDisputeCount > input.openDisputeBaseline) {
    out.push({
      id: "dispute_exposure",
      severity: "warning",
      message: "Dispute exposure is elevated — review open disputes and expected balance holds in Stripe.",
    })
  }
  const transferBaselineCents = input.upcomingTransferBaselineCents
  if (transferBaselineCents > 0 && input.estimateUpcomingTransferCents > transferBaselineCents * 1.5) {
    out.push({
      id: "upcoming_payout_volume",
      severity: "info",
      message: "Upcoming payout-related movement looks unusually high versus the recent baseline — double-check scheduled activity.",
    })
  }
  if (input.failedPayoutCount30d > 0) {
    out.push({
      id: "payout_failures",
      severity: "warning",
      message: "Recent payout failures detected — review Stripe payout errors and bank connectivity for this workspace.",
    })
  }
  return out
}
