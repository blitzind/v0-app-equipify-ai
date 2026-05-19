import type { InvoicePaymentAllocationState } from "@/lib/billing/invoice-payment-allocation"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"

export type InvoiceBulkArchiveEligibilityInput = {
  isArchived?: boolean
  archivedAt?: string | null
  status: InvoiceStatus | string
  paymentAllocationState?: InvoicePaymentAllocationState | null
  totalPaidCents?: number | null
  balanceDueCents?: number | null
  sentAt?: string | null
  paidDate?: string | null
  /** Server-side: invoice has been exported to accounting (e.g. QuickBooks). */
  accountingExported?: boolean
}

const SAFE_STATUSES = new Set<InvoiceStatus>(["Draft", "Void"])

export function invoiceBulkArchiveBlockMessage(
  input: InvoiceBulkArchiveEligibilityInput,
): string | null {
  if (input.isArchived || input.archivedAt) {
    return "This invoice is already archived."
  }

  const status = String(input.status ?? "").trim()

  if (status === "Paid") {
    return "Paid invoices cannot be bulk archived."
  }

  if (input.paymentAllocationState === "partial") {
    return "Partially paid invoices cannot be bulk archived."
  }

  if (input.paymentAllocationState === "paid" || input.paymentAllocationState === "overpaid") {
    return "Invoices with payments cannot be bulk archived."
  }

  if (typeof input.totalPaidCents === "number" && input.totalPaidCents > 0) {
    return "Invoices with payments cannot be bulk archived."
  }

  if (typeof input.balanceDueCents === "number" && input.balanceDueCents > 0) {
    return "Invoices with an open balance cannot be bulk archived."
  }

  if (input.paidDate?.trim()) {
    return "Paid invoices cannot be bulk archived."
  }

  if (input.sentAt?.trim()) {
    return "Sent invoices cannot be bulk archived."
  }

  if (status === "Sent" || status === "Unpaid" || status === "Overdue") {
    return "Outstanding invoices cannot be bulk archived."
  }

  if (input.accountingExported) {
    return "Invoices exported to accounting cannot be bulk archived."
  }

  if (!SAFE_STATUSES.has(status as InvoiceStatus)) {
    return "This invoice cannot be bulk archived."
  }

  return null
}

export function isInvoiceBulkArchiveEligible(input: InvoiceBulkArchiveEligibilityInput): boolean {
  return invoiceBulkArchiveBlockMessage(input) === null
}

export function invoiceBulkArchiveEligibilityFromAdmin(inv: AdminInvoice): InvoiceBulkArchiveEligibilityInput {
  return {
    isArchived: inv.isArchived,
    status: inv.status,
    paymentAllocationState: inv.paymentAllocationState,
    totalPaidCents: inv.totalPaidCents,
    balanceDueCents: inv.balanceDueCents,
    sentAt: inv.sentAt,
    paidDate: inv.paidDate,
  }
}
