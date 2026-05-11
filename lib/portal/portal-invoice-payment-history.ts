/**
 * Customer-portal-safe payment history rows (no Stripe IDs, no internal UUIDs in payloads).
 */

export type PortalInvoicePaymentHistoryItem = {
  /** ISO date (calendar day) payment was applied */
  paidOn: string
  amountCents: number
  /** Human-readable method / source */
  methodLabel: string
  /** Customer-safe reference line (never raw Stripe PaymentIntent ids) */
  referenceDisplay: string | null
  /** High-level status for the customer */
  statusLabel: string
}

const BLITZPAY_PI_REF_PREFIX = "blitzpay_pi:"

function paymentMethodLabel(method: string, reference: string): string {
  const m = method.trim().toLowerCase()
  const ref = reference.trim()
  if (ref.startsWith(BLITZPAY_PI_REF_PREFIX)) {
    return m === "card" ? "Card (online — BlitzPay)" : "Online payment (BlitzPay)"
  }
  switch (m) {
    case "cash":
      return "Cash"
    case "check":
      return "Check"
    case "ach":
      return "ACH"
    case "wire":
      return "Wire transfer"
    case "card":
      return "Card"
    case "other":
      return "Other"
    default:
      return method.trim() || "Payment"
  }
}

function referenceDisplayForPortal(reference: string | null | undefined): string | null {
  const r = (reference ?? "").trim()
  if (!r) return null
  if (r.startsWith(BLITZPAY_PI_REF_PREFIX)) {
    return "Electronic confirmation on file"
  }
  return r.length > 120 ? `${r.slice(0, 117)}…` : r
}

export function mapOrgInvoicePaymentRowToPortalHistory(row: {
  paid_on: string
  amount_cents: number | string
  payment_method: string
  reference?: string | null
}): PortalInvoicePaymentHistoryItem {
  const refRaw = (row.reference ?? "").trim()
  const amountCents = Math.round(Number(row.amount_cents))
  return {
    paidOn: String(row.paid_on).slice(0, 10),
    amountCents: Number.isFinite(amountCents) ? amountCents : 0,
    methodLabel: paymentMethodLabel(row.payment_method, refRaw),
    referenceDisplay: referenceDisplayForPortal(row.reference),
    statusLabel: "Received",
  }
}
