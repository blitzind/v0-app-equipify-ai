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

/** Deterministic membership-cycle invoice generation key (v1). */
export function blitzpayMembershipInvoiceGenerationKeyV1(input: {
  membershipId: string
  billingPeriodStart: string
  billingPeriodEnd: string
  generatedBy: "scheduler" | "manual" | "renewal"
}): string {
  assertUuid(input.membershipId, "membershipId")
  const a = String(input.billingPeriodStart).slice(0, 10)
  const b = String(input.billingPeriodEnd).slice(0, 10)
  const g = input.generatedBy
  return `blitzpay:membership_inv:v1:${input.membershipId}:${a}:${b}:${g}`
}

export function buildBlitzPayQuotePaymentIntentIdempotencyKey(input: {
  organizationId: string
  orgQuoteId: string
  attemptToken: string
}): string {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgQuoteId, "orgQuoteId")
  const token = input.attemptToken.trim()
  if (!ATTEMPT_TOKEN_RE.test(token)) {
    throw new Error("attemptToken must be 8–128 chars [a-zA-Z0-9:_-]")
  }
  return `blitzpay:pi_quote:v1:${input.organizationId}:${input.orgQuoteId}:${token}`
}

/** Stable key for revenue-share ledger rows (v1). */
export function blitzpayRevenueShareLedgerKeyV1(input: {
  organizationId: string
  ruleId: string
  sourceType: string
  sourceId: string
}): string {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.ruleId, "ruleId")
  assertUuid(input.sourceId, "sourceId")
  const st = String(input.sourceType || "unknown").replace(/:/g, "_")
  return `blitzpay:revshare:v1:${input.organizationId}:${input.ruleId}:${st}:${input.sourceId}`
}

/** Stable key for work-order commission accrual rows (matches DB unique org+invoice+technician). */
export function blitzpayWorkOrderCommissionAccrualKeyV1(input: {
  organizationId: string
  orgInvoiceId: string
  technicianUserId: string
}): string {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  assertUuid(input.technicianUserId, "technicianUserId")
  return `blitzpay:wo_comm:v1:${input.organizationId}:${input.orgInvoiceId}:${input.technicianUserId}`
}
