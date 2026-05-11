import "server-only"

/** Global kill switch for invoice pay APIs (Phase 2+). Default off. */
export function isBlitzPayInvoicePayEnabledEnv(): boolean {
  return process.env.BLITZPAY_INVOICE_PAY_ENABLED?.trim() === "true"
}
