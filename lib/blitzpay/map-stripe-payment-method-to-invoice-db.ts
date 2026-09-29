import type Stripe from "stripe"
import type { InvoicePaymentMethodDb } from "@/lib/billing/invoice-payment-allocation"

export function stripePaymentMethodTypeFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
  if (typeof pi.payment_method === "object" && pi.payment_method) {
    return (pi.payment_method as Stripe.PaymentMethod).type ?? null
  }
  if (Array.isArray(pi.payment_method_types) && pi.payment_method_types.length === 1) {
    return pi.payment_method_types[0] ?? null
  }
  return null
}

/** Map Stripe PaymentMethod type to org_invoice_payments.payment_method. */
export function mapStripePaymentMethodTypeToInvoiceDb(
  stripeType: string | null | undefined,
): InvoicePaymentMethodDb {
  const t = String(stripeType ?? "").toLowerCase()
  if (t === "us_bank_account") return "ach"
  if (t === "card") return "card"
  return "other"
}

export function invoicePaymentMethodFromPaymentIntent(pi: Stripe.PaymentIntent): InvoicePaymentMethodDb {
  return mapStripePaymentMethodTypeToInvoiceDb(stripePaymentMethodTypeFromPaymentIntent(pi))
}
