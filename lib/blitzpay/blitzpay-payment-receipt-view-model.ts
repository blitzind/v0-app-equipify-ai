/**
 * Customer-safe receipt view model (Phase 2F) — email, print, download, portal card.
 * Built only from {@link InvoicePaymentReceiptShape}; never embeds raw Stripe ids or fee metadata.
 */

import type { InvoicePaymentReceiptShape } from "@/lib/blitzpay/invoice-payment-receipt"

export type BlitzPayPaymentReceiptViewModel = InvoicePaymentReceiptShape & {
  /** ISO 4217 lowercase (display hint; amounts are still integer cents USD in Phase 2F paths). */
  currencyCode: string
  /** Absolute HTTPS URL to the portal invoice page, or null when not included. */
  portalInvoiceAbsoluteUrl: string | null
}

export function buildBlitzPayPaymentReceiptViewModel(
  shape: InvoicePaymentReceiptShape,
  options?: { currencyCode?: string | null; portalInvoiceAbsoluteUrl?: string | null },
): BlitzPayPaymentReceiptViewModel {
  const cur = (options?.currencyCode ?? "usd").trim().toLowerCase() || "usd"
  const portal = (options?.portalInvoiceAbsoluteUrl ?? "").trim()
  return {
    ...shape,
    currencyCode: cur,
    portalInvoiceAbsoluteUrl: portal.length > 0 ? portal : null,
  }
}

/** Serialize for PDF/API responses — excludes any non-customer fields by construction. */
export function blitzPayPaymentReceiptViewModelToCustomerJson(vm: BlitzPayPaymentReceiptViewModel): Record<string, unknown> {
  return {
    organizationName: vm.organizationName,
    customerName: vm.customerName,
    invoiceNumber: vm.invoiceNumber,
    amountPaidCents: vm.amountPaidCents,
    paymentDate: vm.paymentDate,
    paymentReferenceDisplay: vm.paymentReferenceDisplay,
    currencyCode: vm.currencyCode,
    portalInvoiceUrl: vm.portalInvoiceAbsoluteUrl,
  }
}
