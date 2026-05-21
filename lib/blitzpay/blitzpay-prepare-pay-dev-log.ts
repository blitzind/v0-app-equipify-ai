import "server-only"

import Stripe from "stripe"

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

export type StripeCheckoutErrorDiagnostics = {
  "error.type": string | null
  "error.code": string | null
  "error.param": string | null
  "error.message": string | null
  "error.raw.message": string | null
  "error.raw.code": string | null
  "error.raw.param": string | null
  "error.decline_code": string | null
  "error.payment_intent": string | null
  "error.requestId": string | null
}

function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return err instanceof Stripe.errors.StripeError
}

function asStripeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    const id = String((value as { id: string }).id).trim()
    return id.length > 0 ? id : null
  }
  return null
}

function truncateLogField(value: string | null, max = 500): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/sk_|pk_|whsec_|rk_/.test(trimmed)) {
    return "[redacted:secret]"
  }
  return trimmed.slice(0, max)
}

/** Server-side Stripe error fields for checkout failure diagnostics (never send to clients). */
export function extractStripeCheckoutErrorDiagnostics(error: unknown): StripeCheckoutErrorDiagnostics {
  if (isStripeError(error)) {
    const raw = error.raw as
      | {
          message?: string
          code?: string
          param?: string
          decline_code?: string
          payment_intent?: unknown
        }
      | undefined
    return {
      "error.type": truncateLogField(error.type ?? null),
      "error.code": truncateLogField(error.code ?? null),
      "error.param": truncateLogField(error.param ?? null),
      "error.message": truncateLogField(error.message ?? null),
      "error.raw.message": truncateLogField(raw?.message ?? null),
      "error.raw.code": truncateLogField(raw?.code ?? null),
      "error.raw.param": truncateLogField(raw?.param ?? null),
      "error.decline_code": truncateLogField(
        (error as Stripe.errors.StripeCardError).decline_code ?? raw?.decline_code ?? null,
      ),
      "error.payment_intent": asStripeId(error.payment_intent ?? raw?.payment_intent),
      "error.requestId": truncateLogField(error.requestId ?? null),
    }
  }

  const duck = error as {
    type?: string
    code?: string
    param?: string
    message?: string
    decline_code?: string
    payment_intent?: unknown
    requestId?: string
    raw?: {
      message?: string
      code?: string
      param?: string
      decline_code?: string
      payment_intent?: unknown
    }
  }

  return {
    "error.type": truncateLogField(duck.type ?? null),
    "error.code": truncateLogField(duck.code ?? null),
    "error.param": truncateLogField(duck.param ?? null),
    "error.message": truncateLogField(duck.message ?? (error instanceof Error ? error.message : null)),
    "error.raw.message": truncateLogField(duck.raw?.message ?? null),
    "error.raw.code": truncateLogField(duck.raw?.code ?? null),
    "error.raw.param": truncateLogField(duck.raw?.param ?? null),
    "error.decline_code": truncateLogField(duck.decline_code ?? duck.raw?.decline_code ?? null),
    "error.payment_intent": asStripeId(duck.payment_intent ?? duck.raw?.payment_intent),
    "error.requestId": truncateLogField(duck.requestId ?? null),
  }
}

function sanitizeStripeUserMessage(detail: string): string | null {
  let trimmed = detail.trim()
  if (!trimmed) {
    return null
  }
  if (/sk_|pk_|whsec_|rk_/.test(trimmed)) {
    return null
  }
  trimmed = trimmed.replace(/\b\S+@\S+\.\S+\b/g, "[email]")
  trimmed = trimmed.replace(/\b(acct|cus)_[A-Za-z0-9]+\b/g, "[account]")
  if (/\n\s+at\s/.test(trimmed) || trimmed.includes(".ts:")) {
    return null
  }
  return trimmed.slice(0, 240)
}

function userMessageFromStripeError(error: unknown): string | null {
  const diagnostics = extractStripeCheckoutErrorDiagnostics(error)
  const candidates = [diagnostics["error.raw.message"], diagnostics["error.message"]]
  for (const candidate of candidates) {
    if (!candidate || candidate === "[redacted:secret]") continue
    const safe = sanitizeStripeUserMessage(candidate)
    if (safe) return safe
  }
  if (error instanceof Error) {
    const safe = sanitizeStripeUserMessage(error.message)
    if (safe) return safe
  }
  return null
}

/** User-safe Stripe checkout failure copy — never exposes secrets, account IDs, or PII. */
export function formatStripeCheckoutFailureMessage(error: unknown): string {
  const detail = userMessageFromStripeError(error)
  if (detail) {
    return `Checkout session creation failed: ${detail}`
  }
  return "Checkout session creation failed. Please contact support."
}

export type StripeCheckoutPayloadDevLog = {
  payment_method_types: string[]
  mode: string
  success_url: string
  cancel_url: string
  success_url_exists: boolean
  cancel_url_exists: boolean
  customer: string | null
  customer_email: string | null
  customer_creation: string | null
  payment_intent_data: {
    application_fee_amount?: number
    setup_future_usage?: string
    metadata_keys: string[]
  }
  transfer_data: null
  invoiceId: string
  organizationId: string
  stripeAccount: string
  application_fee_amount: number
  initiatedBy: string
}

/** Log checkout payload immediately before Stripe session create (server logs). */
export function logBlitzpayStripeCheckoutPayload(payload: StripeCheckoutPayloadDevLog): void {
  console.error(
    JSON.stringify({
      source: "blitzpay-prepare-pay",
      event: "stripe_checkout_payload",
      ts: new Date().toISOString(),
      ...payload,
    }),
  )
  logBlitzpayPreparePayDev("stripe_checkout_payload", payload as unknown as Record<string, unknown>)
}

/** Structured server log for checkout failures — always written, never sent to clients. */
export function logBlitzpayStripeCheckoutFailed(
  details: Record<string, unknown> & { error: unknown },
): void {
  const { error, ...rest } = details
  const stripeDiagnostics = extractStripeCheckoutErrorDiagnostics(error)
  console.error(
    JSON.stringify({
      source: "blitzpay-prepare-pay",
      event: "stripe_checkout_failed",
      ts: new Date().toISOString(),
      ...stripeDiagnostics,
      ...rest,
    }),
  )
  logBlitzpayPreparePayDev("stripe_checkout_failed", {
    ...stripeDiagnostics,
    ...rest,
  })
}
