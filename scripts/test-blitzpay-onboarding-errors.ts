/**
 * Smoke tests for BlitzPay Connect onboarding error normalization.
 * Run: pnpm test:blitzpay-onboarding-errors
 */
import assert from "node:assert/strict"
import Stripe from "stripe"
import { BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES } from "../lib/blitzpay/connect-onboarding-client-messages"
import {
  buildBlitzPayConnectOnboardingFailureLog,
  normalizeConnectOnboardingStripeError,
} from "../lib/blitzpay/stripe-connect-onboarding-errors"

const rawBase = { type: "invalid_request_error" as const, statusCode: 400 }

const restricted = new Stripe.errors.StripeInvalidRequestError({
  ...rawBase,
  message:
    "We've temporarily restricted your ability to create this type of connected account due to suspicious activity.",
})

const r1 = normalizeConnectOnboardingStripeError(restricted, "accounts_create")
assert.equal(r1.code, "connect_temporarily_restricted")
assert.equal(r1.httpStatus, 503)
assert.ok(r1.userMessage.includes("temporarily unavailable"))

const rate = new Stripe.errors.StripeRateLimitError({
  ...rawBase,
  message: "Too many requests",
  statusCode: 429,
})
const r2 = normalizeConnectOnboardingStripeError(rate, "accounts_create")
assert.equal(r2.code, "connect_rate_limited")
assert.equal(r2.httpStatus, 429)

const perm = new Stripe.errors.StripePermissionError({
  ...rawBase,
  message: "Forbidden",
  statusCode: 403,
})
const r3 = normalizeConnectOnboardingStripeError(perm, "account_link_create")
assert.equal(r3.code, "connect_verification_required")
assert.equal(r3.httpStatus, 403)

const cfg = normalizeConnectOnboardingStripeError(new Error("STRIPE_SECRET_KEY is not set"), "stripe_client_init")
assert.equal(cfg.code, "connect_configuration_error")

const unknown = normalizeConnectOnboardingStripeError(new Error("boom"), "accounts_create")
assert.equal(unknown.code, "connect_unknown_error")

const log = buildBlitzPayConnectOnboardingFailureLog({
  stage: "accounts_create",
  organizationId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  normalizedCode: r1.code,
  err: restricted,
})
assert.equal(log.category, "connect_temporarily_restricted")
assert.ok(log.stripeMessage && log.stripeMessage.length > 0)
assert.equal(typeof log.ts, "string")

for (const k of Object.keys(BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES)) {
  assert.ok(
    BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES[k as keyof typeof BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES]
      .length > 10,
    `message for ${k}`,
  )
}

console.log("blitzpay onboarding error tests: ok")
