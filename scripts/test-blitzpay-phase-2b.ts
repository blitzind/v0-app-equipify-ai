import assert from "node:assert/strict"
import {
  assertInvoicePayableForBlitzpay,
  balanceDueCentsForBlitzpay,
  type InvoicePayEligibilityRow,
} from "../lib/blitzpay/invoice-pay-eligibility"
import { blitzpayInvoicePaymentMetadata, parseBlitzpayInvoiceMetadata } from "../lib/blitzpay/stripe-metadata"
import { buildBlitzPayPaymentIntentIdempotencyKey } from "../lib/blitzpay/idempotency-keys"
import { computeBlitzpayApplicationFeeBreakdown } from "../lib/blitzpay/fees"

const org = "11111111-1111-4111-8111-111111111111"
const inv = "22222222-2222-4222-8222-222222222222"

function baseInvoice(over: Partial<InvoicePayEligibilityRow> = {}): InvoicePayEligibilityRow {
  return {
    id: inv,
    organization_id: org,
    customer_id: "33333333-3333-4333-8333-333333333333",
    amount_cents: 10_000,
    tax_amount_cents: 0,
    status: "sent",
    invoice_number: "INV-1",
    title: "Test",
    archived_at: null,
    ...over,
  }
}

function testEligibility() {
  const invRow = baseInvoice()
  assert.equal(balanceDueCentsForBlitzpay(invRow, 0), 10_000)
  assert.throws(() => assertInvoicePayableForBlitzpay(invRow, 10_000), /invoice_no_balance_due/)
  assert.throws(() => assertInvoicePayableForBlitzpay(baseInvoice({ archived_at: "2020-01-01" }), 0), /invoice_archived/)
  assert.throws(() => assertInvoicePayableForBlitzpay(baseInvoice({ status: "void" }), 0), /invoice_not_payable_status/)
  assertInvoicePayableForBlitzpay(invRow, 2500)
  assert.equal(balanceDueCentsForBlitzpay(invRow, 2500), 7500)
}

function testMetadata() {
  const m = blitzpayInvoicePaymentMetadata({
    organizationId: org,
    orgInvoiceId: inv,
    feePolicyVersion: "blitzpay_fees_v1",
  })
  const parsed = parseBlitzpayInvoiceMetadata(m)
  assert.equal(parsed?.organizationId, org)
  assert.equal(parsed?.orgInvoiceId, inv)
  assert.equal(parsed?.paymentSource, null)

  const mPortal = blitzpayInvoicePaymentMetadata({
    organizationId: org,
    orgInvoiceId: inv,
    feePolicyVersion: "blitzpay_fees_v1",
    paymentSource: "customer_portal",
  })
  assert.equal(parseBlitzpayInvoiceMetadata(mPortal)?.paymentSource, "customer_portal")
}

function testIdempotency() {
  const k = buildBlitzPayPaymentIntentIdempotencyKey({
    organizationId: org,
    orgInvoiceId: inv,
    attemptToken: "tok_one_x",
  })
  assert.match(k, /^blitzpay:pi:v1:/)
}

function testFeeForPay() {
  const b = computeBlitzpayApplicationFeeBreakdown({
    amountCents: 5000n,
    platformFeeBps: 200,
    platformFeeFixedCents: 25,
  })
  assert.equal(b.computedTotalApplicationFeeCents, 125n)
}

testEligibility()
testMetadata()
testIdempotency()
testFeeForPay()
console.log("blitzpay phase 2b tests passed")
