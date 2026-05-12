import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"

/** Shown when Billing Portal cannot be opened (never includes Stripe internals). */
export const STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE =
  "We couldn't open billing management right now. Please try again or contact support." as const

/** Shown when payment method / invoice snapshot cannot be loaded. */
export const STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE =
  "We couldn't load saved payment details right now. Please try again or contact support." as const

/** Generic checkout / setup failure. */
export const STRIPE_SAAS_BILLING_ACTION_UNAVAILABLE =
  "We couldn't complete this billing action right now. Please try again or contact support." as const

function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return err instanceof Stripe.errors.StripeError
}

/** True if raw text looks like a Stripe technical leak (never show to users). */
export function stripeSaaSBillingMessageLooksSensitive(raw: string): boolean {
  const s = raw.toLowerCase()
  return (
    /\bcus_[a-z0-9]+\b/i.test(raw) ||
    /\bsub_[a-z0-9]+\b/i.test(raw) ||
    /\bprice_[a-z0-9]+\b/i.test(raw) ||
    /\bsk_(live|test)_[a-z0-9]+\b/i.test(raw) ||
    /\bpk_(live|test)_[a-z0-9]+\b/i.test(raw) ||
    /\brk_(live|test)_[a-z0-9]+\b/i.test(raw) ||
    /\bwhsec_[a-z0-9]+\b/i.test(raw) ||
    s.includes("livemode") ||
    s.includes("test mode") ||
    s.includes("live mode") ||
    s.includes("no such customer") ||
    s.includes("similar object exists in")
  )
}

/** User-facing copy for billing API routes when env / Stripe assertions throw (never leak keys or mode hints). */
export const BILLING_ENDPOINT_GENERIC_MISCONFIG =
  "Billing is not available right now. Please try again later or contact support." as const

export function sanitizeBillingEndpointUserMessage(raw: string): string {
  const t = raw.trim()
  if (!t) return BILLING_ENDPOINT_GENERIC_MISCONFIG
  if (stripeSaaSBillingMessageLooksSensitive(t)) return BILLING_ENDPOINT_GENERIC_MISCONFIG
  if (t.length > 240) return BILLING_ENDPOINT_GENERIC_MISCONFIG
  return t
}

/**
 * Stripe said the stored customer id is not usable in this API environment (wrong mode, deleted, etc.).
 * Safe to clear the FK-style pointer so checkout/setup can mint a fresh customer.
 */
export function stripeSaaSCustomerRecordLikelyInvalid(err: unknown): boolean {
  if (isStripeError(err)) {
    const m = err.message.toLowerCase()
    if (m.includes("no such customer")) return true
    if (m.includes("similar object exists in test mode") || m.includes("similar object exists in live mode")) {
      return true
    }
    if (m.includes("test mode key") && m.includes("live")) return true
    if (m.includes("live mode key") && m.includes("test")) return true
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      const p = String(err.param ?? "").toLowerCase()
      if (p === "customer" || m.includes("customer")) return true
    }
    return false
  }
  const raw = err instanceof Error ? err.message : String(err)
  return stripeSaaSBillingMessageLooksSensitive(raw)
}

export function logStripeSaaSBillingFailure(context: string, organizationId: string | null, err: unknown): void {
  if (isStripeError(err)) {
    console.error(`[stripe saas billing] ${context}`, {
      organizationId,
      stripeType: err.type,
      stripeCode: err.code,
      statusCode: err.statusCode,
      requestId: err.requestId ?? null,
      message: err.message,
    })
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[stripe saas billing] ${context}`, { organizationId, message })
}

export type StripeSaaSBillingUserErrorKind = "portal" | "payment_details" | "checkout" | "setup" | "generic"

export function userFacingStripeSaaSBillingError(err: unknown, kind: StripeSaaSBillingUserErrorKind): string {
  if (isStripeError(err)) {
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return STRIPE_SAAS_BILLING_ACTION_UNAVAILABLE
    }
    if (err instanceof Stripe.errors.StripeConnectionError) {
      return kind === "portal" ? STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE : STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
    }
    if (err instanceof Stripe.errors.StripeRateLimitError || err.statusCode === 429) {
      return STRIPE_SAAS_BILLING_ACTION_UNAVAILABLE
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      const m = err.message.toLowerCase()
      if (m.includes("billing portal") && (m.includes("configuration") || m.includes("no default configuration"))) {
        return STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE
      }
      if (kind === "portal") return STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE
      if (kind === "payment_details") return STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
      if (kind === "checkout") {
        return "We couldn't start checkout right now. Please try again or contact support."
      }
      if (kind === "setup") {
        return "We couldn't prepare card setup right now. Please try again or contact support."
      }
      return STRIPE_SAAS_BILLING_ACTION_UNAVAILABLE
    }
    if (err.statusCode != null && err.statusCode >= 500) {
      return kind === "portal" ? STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE : STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
    }
    return kind === "portal" ? STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE : STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
  }

  const raw = err instanceof Error ? err.message : String(err)
  if (stripeSaaSBillingMessageLooksSensitive(raw)) {
    return kind === "portal" ? STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE : STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
  }

  if (raw.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "Billing server is not configured (missing SUPABASE_SERVICE_ROLE_KEY)."
  }
  if (raw.includes("STRIPE_SECRET_KEY")) {
    return "Stripe is not configured."
  }

  return kind === "portal"
    ? STRIPE_SAAS_BILLING_PORTAL_UNAVAILABLE
    : kind === "payment_details"
      ? STRIPE_SAAS_BILLING_DETAILS_UNAVAILABLE
      : kind === "checkout"
        ? "We couldn't start checkout right now. Please try again or contact support."
        : kind === "setup"
          ? "We couldn't prepare card setup right now. Please try again or contact support."
          : STRIPE_SAAS_BILLING_ACTION_UNAVAILABLE
}

/**
 * Clears `stripe_customer_id` when Stripe indicates the id is invalid for the current secret key.
 * Scoped to the same org + id to avoid racing another writer.
 */
export async function tryClearStaleStripeCustomerId(
  admin: SupabaseClient,
  organizationId: string,
  persistedCustomerId: string,
  err: unknown,
): Promise<boolean> {
  if (!stripeSaaSCustomerRecordLikelyInvalid(err)) return false

  const { error } = await admin
    .from("organization_subscriptions")
    .update({
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("stripe_customer_id", persistedCustomerId)

  if (error) {
    console.error("[stripe saas billing] could not clear stale stripe_customer_id", {
      organizationId,
      code: error.code,
      message: error.message,
    })
    return false
  }

  console.warn("[stripe saas billing] cleared stale stripe_customer_id (Stripe rejected customer for this environment)", {
    organizationId,
  })
  return true
}
