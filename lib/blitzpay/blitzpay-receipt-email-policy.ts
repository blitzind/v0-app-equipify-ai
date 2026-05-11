/**
 * When `customers.invoice_delivery_preference` is not email-oriented, skip **automatic**
 * BlitzPay receipt email after webhook (staff-initiated resend may still send).
 */
export function blitzpayAutomaticCustomerReceiptBlockedByInvoicePreference(
  invoiceDeliveryPreference: string | null | undefined,
): boolean {
  const p = (invoiceDeliveryPreference ?? "").trim().toLowerCase()
  if (!p || p === "email") return false
  return p === "portal" || p === "mail" || p === "manual"
}
