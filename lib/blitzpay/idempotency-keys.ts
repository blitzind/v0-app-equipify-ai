const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ATTEMPT_TOKEN_RE = /^[a-zA-Z0-9:_-]{8,128}$/

export function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value.trim())) {
    throw new Error(`${label} must be a UUID`)
  }
}

/**
 * Stripe Idempotency-Key for PaymentIntent create (new logical attempt => new attemptToken).
 * Format aligned with docs/BLITZPAY_PHASE_2_ARCHITECTURE.md §3.2.
 */
export function buildBlitzPayPaymentIntentIdempotencyKey(input: {
  organizationId: string
  orgInvoiceId: string
  attemptToken: string
}): string {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  const token = input.attemptToken.trim()
  if (!ATTEMPT_TOKEN_RE.test(token)) {
    throw new Error("attemptToken must be 8–128 chars [a-zA-Z0-9:_-]")
  }
  return `blitzpay:pi:v1:${input.organizationId}:${input.orgInvoiceId}:${token}`
}
