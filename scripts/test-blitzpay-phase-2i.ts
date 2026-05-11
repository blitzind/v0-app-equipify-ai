/**
 * BlitzPay Phase 2I — multi-method + ACH + stored profile foundations.
 * Run: pnpm test:blitzpay-phase-2i
 */
import assert from "node:assert/strict"
import { computeBlitzpayConvenienceFeePreview } from "../lib/blitzpay/convenience-fees"
import { evaluateBlitzpayAutopayEligibility } from "../lib/blitzpay/blitzpay-autopay-foundation"
import { isBlitzPayPhase2WebhookEventType } from "../lib/blitzpay/webhook-phase2-events"

function testAchCanApplyFeeWhenEnabled() {
  const p = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: 20000,
    settings: {
      passProcessingFeesToCustomer: true,
      feeMode: "customer_pass_through",
      feePercentageSnapshot: 1.5,
      feeCapCents: null,
      disclosureCopy: "ACH processing fee may apply.",
    },
    paymentMethodType: "us_bank_account",
    achConvenienceFeeEnabled: true,
  })
  assert.equal(p.convenienceFeeCents, 300)
  assert.equal(p.totalChargeCents, 20300)
}

function testAutopayEligibilityFoundation() {
  const eligible = evaluateBlitzpayAutopayEligibility({
    invoiceBalanceCents: 5000,
    hasStoredProfile: true,
    hasDefaultPaymentMethod: true,
    offSessionAuthorized: true,
    defaultPaymentMethodType: "card",
  })
  assert.equal(eligible.eligible, true)

  const noAuth = evaluateBlitzpayAutopayEligibility({
    invoiceBalanceCents: 5000,
    hasStoredProfile: true,
    hasDefaultPaymentMethod: true,
    offSessionAuthorized: false,
    defaultPaymentMethodType: "card",
  })
  assert.equal(noAuth.eligible, false)
  assert.equal(noAuth.reason, "off_session_not_authorized")
}

function testWebhookRoutingStillIncludesPayoutAndRefundDispute() {
  assert.equal(isBlitzPayPhase2WebhookEventType("payout.paid"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("charge.refunded"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("payment_intent.succeeded"), true)
}

testAchCanApplyFeeWhenEnabled()
testAutopayEligibilityFoundation()
testWebhookRoutingStillIncludesPayoutAndRefundDispute()
console.log("blitzpay phase 2i tests passed")
