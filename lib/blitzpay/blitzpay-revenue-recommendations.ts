/**
 * Read-only, heuristic “AI-style” revenue recommendations (Phase 2Q). No model calls.
 */

export type BlitzpayRevenueRecommendation = {
  id: string
  title: string
  detail: string
  severity: "info" | "warning"
}

export type BlitzpayRecommendationInput = {
  overdueCollectibleCents: number
  overdueInvoiceCount: number
  achPendingCount: number
  achSettledRatio: number
  /** 0–1 share of recent volume that was estimate deposits (ledger-tagged). */
  estimateDepositShareApprox: number
  walletLiabilityCents: number
  walletCreditInflowWindowCents: number
  activeInstallmentPlansCount: number
  largeOpenInvoiceBalanceCents: number
  reminderEffectivenessRatePct: number
}

export function buildBlitzpayRevenueRecommendations(input: BlitzpayRecommendationInput): BlitzpayRevenueRecommendation[] {
  const out: BlitzpayRevenueRecommendation[] = []

  if (input.overdueInvoiceCount > 0 && input.overdueCollectibleCents > 0) {
    out.push({
      id: "prioritize_overdue",
      title: "Follow up on overdue invoices first",
      detail: `About ${input.overdueInvoiceCount} invoice(s) are past due with roughly ${(input.overdueCollectibleCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })} still collectible. Start with the largest balances and resend hosted pay links.`,
      severity: "warning",
    })
  }

  if (input.achPendingCount >= 3 && input.achSettledRatio < 0.4) {
    out.push({
      id: "ach_slow",
      title: "ACH payments are taking longer to settle",
      detail:
        "Several bank transfers are still pending settlement. Cash timing will lag card payments—plan working capital accordingly and set customer expectations using your ACH timeline copy.",
      severity: "info",
    })
  }

  if (input.estimateDepositShareApprox >= 0.15) {
    out.push({
      id: "deposits_help_cash",
      title: "Estimate deposits are improving upfront cash flow",
      detail:
        "A meaningful share of recent BlitzPay volume looks like estimate deposits. That pattern usually improves cash before work is completed—keep deposit targets aligned with job risk.",
      severity: "info",
    })
  }

  if (input.walletLiabilityCents > 250_00 && input.walletCreditInflowWindowCents > input.walletLiabilityCents * 0.15) {
    out.push({
      id: "wallet_review",
      title: "Customer credits are growing and should be reviewed",
      detail:
        "Wallet spendable + refundable balances are elevated and credits have been flowing in recently. Review large customer wallets and apply credits to open invoices where appropriate.",
      severity: "warning",
    })
  }

  if (input.activeInstallmentPlansCount === 0 && input.largeOpenInvoiceBalanceCents >= 10_000_00) {
    out.push({
      id: "installment_fit",
      title: "Large open balances may be a good fit for installment plans",
      detail:
        "You have sizable open invoice totals without active installment plans. Where customers need payment flexibility, consider staged plans on approved work.",
      severity: "info",
    })
  }

  if (input.reminderEffectivenessRatePct < 40 && input.overdueInvoiceCount >= 2) {
    out.push({
      id: "reminder_tune",
      title: "Reminder delivery looks low versus overdue volume",
      detail:
        "Many reminders are skipped or not sent relative to overdue invoices. Confirm outbound email, customer comms preferences, and reminder toggles so automated follow-ups can run.",
      severity: "warning",
    })
  }

  return out
}
