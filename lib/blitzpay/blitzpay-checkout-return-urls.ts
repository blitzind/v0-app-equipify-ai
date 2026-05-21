import "server-only"

/** Hosted Checkout return URLs for staff-dashboard invoice pay (public /payment-return shim). */
export function buildBlitzpayStaffInvoiceCheckoutReturnUrls(origin: string, invoiceId: string): {
  successUrl: string
  cancelUrl: string
} {
  const base = origin.replace(/\/+$/, "")
  const id = encodeURIComponent(invoiceId)
  return {
    successUrl: `${base}/payment-return?status=success&invoiceId=${id}`,
    cancelUrl: `${base}/payment-return?status=cancel&invoiceId=${id}`,
  }
}

export function isValidBlitzpayCheckoutReturnUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    return parsed.hostname.length > 0
  } catch {
    return false
  }
}

export function blitzpayCheckoutReturnUrlDevFlags(successUrl: string, cancelUrl: string): {
  success_url_exists: boolean
  cancel_url_exists: boolean
} {
  return {
    success_url_exists: isValidBlitzpayCheckoutReturnUrl(successUrl),
    cancel_url_exists: isValidBlitzpayCheckoutReturnUrl(cancelUrl),
  }
}
