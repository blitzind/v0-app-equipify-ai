import assert from "node:assert/strict"
import {
  buildBlitzPayPaymentIntentIdempotencyKey,
  assertUuid,
} from "../lib/blitzpay/idempotency-keys"
import { computeBlitzpayApplicationFeeBreakdown, feeFromBpsRounded } from "../lib/blitzpay/fees"
import {
  blitzpayInvoicePaymentMetadata,
  parseBlitzpayInvoiceMetadata,
  BLITZPAY_METADATA_PURPOSE_INVOICE,
} from "../lib/blitzpay/stripe-metadata"
import {
  blitzpayWebhookPayloadSha256,
  isBlitzPayPhase2WebhookEventType,
} from "../lib/blitzpay/webhook-phase2-events"

const org = "11111111-1111-4111-8111-111111111111"
const inv = "22222222-2222-4222-8222-222222222222"

function testIdempotencyKey() {
  const k = buildBlitzPayPaymentIntentIdempotencyKey({
    organizationId: org,
    orgInvoiceId: inv,
    attemptToken: "attempt_01",
  })
  assert.equal(k, `blitzpay:pi:v1:${org}:${inv}:attempt_01`)
  assert.throws(() =>
    buildBlitzPayPaymentIntentIdempotencyKey({
      organizationId: "bad",
      orgInvoiceId: inv,
      attemptToken: "attempt_01",
    }),
  )
}

function testFees() {
  assert.equal(feeFromBpsRounded(10000n, 250), 250n)
  const b = computeBlitzpayApplicationFeeBreakdown({
    amountCents: 10_000n,
    platformFeeBps: 100,
    platformFeeFixedCents: 50,
    convenienceFeeBps: 0,
    convenienceFeeFixedCents: 0,
  })
  assert.equal(b.computedTotalApplicationFeeCents, 150n)
  assert.throws(() =>
    computeBlitzpayApplicationFeeBreakdown({
      amountCents: 100n,
      platformFeeBps: 10_000,
      platformFeeFixedCents: 1,
    }),
  )
}

function testMetadata() {
  const m = blitzpayInvoicePaymentMetadata({
    organizationId: org,
    orgInvoiceId: inv,
    feePolicyVersion: "blitzpay_fees_v1",
  })
  assert.equal(m.purpose, BLITZPAY_METADATA_PURPOSE_INVOICE)
  assert.equal(parseBlitzpayInvoiceMetadata(m)?.organizationId, org)
  assert.equal(parseBlitzpayInvoiceMetadata({ purpose: "other" }), null)
}

function testWebhookHelpers() {
  assert.equal(isBlitzPayPhase2WebhookEventType("payment_intent.succeeded"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("account.updated"), false)
  const h = blitzpayWebhookPayloadSha256('{"x":1}')
  assert.equal(h.length, 64)
}

function testAssertUuid() {
  assertUuid(org, "x")
  assert.throws(() => assertUuid("nope", "x"))
}

testIdempotencyKey()
testFees()
testMetadata()
testWebhookHelpers()
testAssertUuid()
console.log("blitzpay phase 2a foundation tests passed")
