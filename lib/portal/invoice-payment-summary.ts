import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
  paymentAllocationUiLabel,
  type InvoicePaymentAllocationState,
} from "@/lib/billing/invoice-payment-allocation"

export type PortalInvoicePaymentSummary = {
  totalDueCents: number
  totalPaidCents: number
  /** Non-negative amount still owed; overpayments zero this for customer-facing copy. */
  balanceDueCents: number
  allocationState: InvoicePaymentAllocationState
  paymentStatusLabel: string
}

export function buildPortalInvoicePaymentSummary(
  inv: { amount_cents: number; tax_amount_cents?: number | null; status: string },
  paymentsTotalCents: number,
): PortalInvoicePaymentSummary {
  const totalDue = invoiceGrandTotalCents({
    amount_cents: inv.amount_cents,
    tax_amount_cents: inv.tax_amount_cents,
  })
  const alloc = computeInvoicePaymentAllocation({
    invoiceTotalCents: totalDue,
    paymentsTotalCents,
    dbInvoiceStatus: String(inv.status || ""),
  })
  return {
    totalDueCents: totalDue,
    totalPaidCents: alloc.totalPaidCents,
    balanceDueCents: Math.max(0, alloc.balanceDueCents),
    allocationState: alloc.allocationState,
    paymentStatusLabel: paymentAllocationUiLabel(alloc.allocationState),
  }
}
