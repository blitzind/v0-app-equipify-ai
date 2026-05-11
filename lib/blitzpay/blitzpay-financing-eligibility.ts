/**
 * Financing / installment eligibility helpers (Phase 2O) — rules only, no credit decisions.
 */

export type QuoteFinancingEligibilityInput = {
  orgFinancingEnabled: boolean
  orgInstallmentPlansEnabled: boolean
  quoteFinancingReadyFlag: boolean
  quoteAmountCents: number
  quoteArchived: boolean
  quoteConvertedInvoiceId: string | null
}

export function isQuoteFinancingSurfaceEligible(input: QuoteFinancingEligibilityInput): boolean {
  if (!input.orgFinancingEnabled) return false
  if (input.quoteArchived) return false
  if (input.quoteConvertedInvoiceId) return false
  if (input.quoteAmountCents < 5000) return false
  return input.quoteFinancingReadyFlag
}

export function isQuoteInstallmentPlanningEligible(input: QuoteFinancingEligibilityInput): boolean {
  if (!input.orgInstallmentPlansEnabled) return false
  if (input.quoteArchived) return false
  if (input.quoteConvertedInvoiceId) return false
  return input.quoteAmountCents >= 1
}

export type InvoiceFinancingEligibilityInput = {
  orgFinancingEnabled: boolean
  invoiceBalanceDueCents: number
  invoiceVoidOrDraft: boolean
}

export function isInvoiceFinancingMessagingEligible(input: InvoiceFinancingEligibilityInput): boolean {
  if (!input.orgFinancingEnabled) return false
  if (input.invoiceVoidOrDraft) return false
  return input.invoiceBalanceDueCents >= 5000
}
