/**
 * Read-only, human-readable revenue acceleration hints (Phase 2O).
 * Not sent to external financing APIs; not autonomous underwriting.
 */

export type RevenueAccelerationInsight = {
  code: string
  title: string
  detail: string
  tone: "info" | "warning" | "success"
}

export function buildQuoteRevenueAccelerationInsights(input: {
  quoteAmountCents: number
  depositCollectedCents: number
  depositTargetCents: number | null
  financingReady: boolean
  orgFinancingEnabled: boolean
  orgInstallmentPlansEnabled: boolean
}): RevenueAccelerationInsight[] {
  const out: RevenueAccelerationInsight[] = []
  const amt = Math.max(0, input.quoteAmountCents)
  const dep = Math.max(0, input.depositCollectedCents)
  const target = input.depositTargetCents == null ? null : Math.max(0, input.depositTargetCents)

  if (input.orgFinancingEnabled && input.financingReady && amt >= 5000) {
    out.push({
      code: "financing_ready",
      title: "Financing-ready opportunity",
      detail:
        "This estimate is flagged as financing-ready. Many customers prefer a monthly payment option for larger work — consider offering financing when your provider integration is live.",
      tone: "info",
    })
  }

  if (input.orgInstallmentPlansEnabled && amt >= 5000) {
    out.push({
      code: "staged_payments",
      title: "Consider staged payments",
      detail:
        "Breaking large jobs into clear milestones (for example 25% / 50% / 25%) can improve cash flow and set expectations before work starts.",
      tone: "info",
    })
  }

  if (target != null && target > 0 && dep < target) {
    out.push({
      code: "deposit_gap",
      title: "Deposit below target",
      detail: "Collected deposit is still below the configured target for this estimate.",
      tone: "warning",
    })
  }

  if (amt >= 2_500_000 && dep < Math.round(amt * 0.1)) {
    out.push({
      code: "large_ticket_low_deposit",
      title: "Large-ticket estimate with a low deposit",
      detail:
        "For high-value estimates, a higher upfront deposit or a staged schedule can reduce collection risk before mobilizing labor.",
      tone: "warning",
    })
  }

  if (amt >= 1_000_000 && !input.financingReady && input.orgFinancingEnabled) {
    out.push({
      code: "mark_financing_ready",
      title: "Monthly payments may improve close likelihood",
      detail:
        "When appropriate for your customer, marking this estimate as financing-ready signals that payment options can be discussed — without committing to a lender.",
      tone: "success",
    })
  }

  return out
}

export function buildInvoiceRevenueAccelerationInsights(input: {
  balanceDueCents: number
  totalPaidCents: number
  orgFinancingEnabled: boolean
  orgInstallmentPlansEnabled: boolean
  hasActivePaymentPlan: boolean
}): RevenueAccelerationInsight[] {
  const out: RevenueAccelerationInsight[] = []
  const due = Math.max(0, input.balanceDueCents)

  if (input.orgInstallmentPlansEnabled && due >= 5000 && !input.hasActivePaymentPlan) {
    out.push({
      code: "invoice_installment_fit",
      title: "Installment plan candidate",
      detail:
        "A staged schedule on the invoice can align customer payments with job milestones while keeping payouts on your existing BlitzPay rails.",
      tone: "info",
    })
  }

  if (input.orgFinancingEnabled && due >= 5000) {
    out.push({
      code: "invoice_financing_messaging",
      title: "Financing messaging",
      detail:
        "For open balances, financing copy can be shown to customers where enabled — always subject to your compliance review.",
      tone: "info",
    })
  }

  return out
}
