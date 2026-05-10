export type InvoicePaymentAllocationState = "unpaid" | "partial" | "paid" | "overpaid"

export type InvoicePaymentMethodDb = "cash" | "check" | "ach" | "wire" | "card" | "other"

export function invoiceGrandTotalCents(row: {
  amount_cents: number
  tax_amount_cents?: number | null
}): number {
  const sub = Math.round(Number(row.amount_cents) || 0)
  const tax = row.tax_amount_cents == null ? 0 : Math.round(Number(row.tax_amount_cents))
  return sub + tax
}

export function computeInvoicePaymentAllocation(args: {
  invoiceTotalCents: number
  paymentsTotalCents: number
  /** Lowercase org_invoices.status */
  dbInvoiceStatus: string
}): {
  totalPaidCents: number
  balanceDueCents: number
  allocationState: InvoicePaymentAllocationState
} {
  const { invoiceTotalCents, paymentsTotalCents, dbInvoiceStatus } = args
  const legacyFullPaid = dbInvoiceStatus === "paid" && paymentsTotalCents === 0
  const totalPaidCents = legacyFullPaid ? invoiceTotalCents : paymentsTotalCents
  const balanceDueCents = invoiceTotalCents - totalPaidCents

  let allocationState: InvoicePaymentAllocationState
  if (totalPaidCents <= 0) allocationState = "unpaid"
  else if (balanceDueCents > 0) allocationState = "partial"
  else if (balanceDueCents === 0) allocationState = "paid"
  else allocationState = "overpaid"

  return { totalPaidCents, balanceDueCents, allocationState }
}

export function paymentAllocationUiLabel(state: InvoicePaymentAllocationState): string {
  switch (state) {
    case "unpaid":
      return "Unpaid"
    case "partial":
      return "Partially paid"
    case "paid":
      return "Paid in full"
    case "overpaid":
      return "Overpaid"
  }
}

export function mapUiPaymentMethodToDb(label: string): InvoicePaymentMethodDb {
  const m: Record<string, InvoicePaymentMethodDb> = {
    Check: "check",
    "ACH / Bank Transfer": "ach",
    "Credit Card": "card",
    Cash: "cash",
    "Wire transfer": "wire",
    Zelle: "other",
    Other: "other",
  }
  return m[label] ?? "other"
}

export function formatPaymentMethodDb(method: string): string {
  switch (method) {
    case "cash":
      return "Cash"
    case "check":
      return "Check"
    case "ach":
      return "ACH / Bank transfer"
    case "wire":
      return "Wire transfer"
    case "card":
      return "Card"
    case "other":
      return "Other"
    default:
      return method
  }
}
