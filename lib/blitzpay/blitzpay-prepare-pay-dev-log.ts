import "server-only"

/** Structured dev logging for BlitzPay prepare-pay (mobile + web checkout). */
export function logBlitzpayPreparePayDev(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development" && process.env.BLITZPAY_ENABLE_DEBUG?.trim() !== "true") {
    return
  }

  console.log(
    JSON.stringify({
      source: "blitzpay-prepare-pay",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

function sanitizeStripeDetail(detail: string): string | null {
  const trimmed = detail.trim()
  if (!trimmed) {
    return null
  }
  if (/sk_|pk_|whsec_|rk_/.test(trimmed)) {
    return null
  }
  return trimmed.slice(0, 240)
}

/** User-safe Stripe checkout failure copy — never exposes secrets. */
export function formatStripeCheckoutFailureMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const stripeLike = error as {
      type?: string
      code?: string
      message?: string
      raw?: { message?: string }
    }
    const detail =
      sanitizeStripeDetail(stripeLike.message ?? "") ??
      sanitizeStripeDetail(stripeLike.raw?.message ?? "")

    if (detail) {
      return `Checkout session creation failed: ${detail}`
    }

    if (stripeLike.type === "StripeInvalidRequestError") {
      return "Checkout session creation failed. Stripe rejected the payment request."
    }
  }

  if (error instanceof Error) {
    const detail = sanitizeStripeDetail(error.message)
    if (detail) {
      return `Checkout session creation failed: ${detail}`
    }
  }

  return "Checkout session creation failed."
}
