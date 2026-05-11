/**
 * Receipt-shaped summary for invoice payments (Phase 2D foundation).
 * Intended for future email/PDF receipts — no sending from this module.
 */

export type InvoicePaymentReceiptShape = {
  organizationName: string
  customerName: string
  invoiceNumber: string
  amountPaidCents: number
  /** ISO date (YYYY-MM-DD) */
  paymentDate: string
  /** Customer-safe reference line */
  paymentReferenceDisplay: string | null
}

export function buildInvoicePaymentReceiptShape(input: {
  organizationName: string
  customerName: string
  invoiceNumber: string
  amountPaidCents: number
  paidOnYyyyMmDd: string
  /** Raw DB reference; BlitzPay processor refs are masked for customer-facing receipts */
  referenceRaw: string | null | undefined
}): InvoicePaymentReceiptShape {
  const ref = (input.referenceRaw ?? "").trim()
  const masked =
    ref.startsWith("blitzpay_pi:") ? "Electronic confirmation on file" : ref.length > 0 ? ref : null
  return {
    organizationName: input.organizationName.trim() || "Organization",
    customerName: input.customerName.trim() || "Customer",
    invoiceNumber: input.invoiceNumber.trim(),
    amountPaidCents: Math.max(0, Math.round(input.amountPaidCents)),
    paymentDate: input.paidOnYyyyMmDd.slice(0, 10),
    paymentReferenceDisplay: masked,
  }
}
