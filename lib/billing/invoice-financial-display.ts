import type { AdminInvoice } from "@/lib/mock-data"
import { invoiceGrandTotalCents } from "@/lib/billing/invoice-payment-allocation"

/** Subtotal stored on the invoice row (pre-tax), dollars. */
export function invoiceStoredSubtotalDollars(inv: Pick<AdminInvoice, "amount">): number {
  return Number(inv.amount) || 0
}

export function invoiceTaxDollars(inv: Pick<AdminInvoice, "taxAmount">): number {
  const t = inv.taxAmount
  return t == null ? 0 : Number(t) || 0
}

/**
 * Grand total (subtotal + tax) in dollars — prefers hydrated `invoiceTotalCents`
 * when present (matches org row + payments allocation).
 */
export function invoiceGrandTotalDollarsDisplay(inv: AdminInvoice): number {
  if (inv.invoiceTotalCents != null) return inv.invoiceTotalCents / 100
  return invoiceStoredSubtotalDollars(inv) + invoiceTaxDollars(inv)
}

export function shouldShowInvoiceTaxRows(inv: Pick<AdminInvoice, "taxAmount">): boolean {
  return invoiceTaxDollars(inv) > 0
}

export function invoiceTaxRowLabel(inv: Pick<AdminInvoice, "taxRatePercent">): string {
  const p = inv.taxRatePercent
  if (p != null && Number.isFinite(p) && p > 0) return `Tax (${Number(p)}%)`
  return "Tax"
}

export function formatUsd(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(dollars)
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function grandTotalCentsFromInvoiceRow(row: {
  amount_cents: number
  tax_amount_cents?: number | null
}): number {
  return invoiceGrandTotalCents({
    amount_cents: row.amount_cents,
    tax_amount_cents: row.tax_amount_cents,
  })
}

export type BillingAddressParts = {
  billing_address_line1?: string | null
  billing_address_line2?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_postal_code?: string | null
  billing_country?: string | null
}

export function formatInvoiceBillingAddressLines(parts: BillingAddressParts): string {
  return [
    parts.billing_address_line1,
    parts.billing_address_line2,
    [parts.billing_city, parts.billing_state, parts.billing_postal_code].filter(Boolean).join(" "),
    parts.billing_country,
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(", ")
}
