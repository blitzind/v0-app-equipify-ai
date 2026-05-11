/**
 * BlitzPay Phase 2C — customer portal prepare-pay helpers (metadata + idempotency token shape).
 * Run: pnpm test:blitzpay-phase-2c-portal
 */
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import {
  BLITZPAY_METADATA_PAYMENT_SOURCE_KEY,
  blitzpayInvoicePaymentMetadata,
  parseBlitzpayInvoiceMetadata,
} from "../lib/blitzpay/stripe-metadata"
import { buildBlitzPayPaymentIntentIdempotencyKey } from "../lib/blitzpay/idempotency-keys"

const org = "11111111-1111-4111-8111-111111111111"
const inv = "22222222-2222-4222-8222-222222222222"
const portalUser = "33333333-3333-4333-8333-333333333333"

function portalStyleAttemptToken(): string {
  const nonce = randomUUID().replace(/-/g, "")
  const h = createHash("sha256")
    .update(`blitzpay_portal_prepare:${portalUser}:${nonce}`)
    .digest("hex")
    .slice(0, 24)
  return `pt_${h}_${nonce}`
}

function testPortalAttemptTokenForIdempotency() {
  const tok = portalStyleAttemptToken()
  const k = buildBlitzPayPaymentIntentIdempotencyKey({
    organizationId: org,
    orgInvoiceId: inv,
    attemptToken: tok,
  })
  assert.match(k, /^blitzpay:pi:v1:/)
  assert.ok(tok.startsWith("pt_"))
}

function testMetadataCustomerPortal() {
  const m = blitzpayInvoicePaymentMetadata({
    organizationId: org,
    orgInvoiceId: inv,
    feePolicyVersion: "blitzpay_fees_v1",
    paymentSource: "customer_portal",
  })
  assert.equal(m[BLITZPAY_METADATA_PAYMENT_SOURCE_KEY], "customer_portal")
  const p = parseBlitzpayInvoiceMetadata(m)
  assert.equal(p?.paymentSource, "customer_portal")
}

testPortalAttemptTokenForIdempotency()
testMetadataCustomerPortal()
console.log("blitzpay phase 2c portal tests passed")
