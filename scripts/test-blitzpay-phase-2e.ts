/**
 * BlitzPay Phase 2E — refunds, disputes, webhook replay helpers, portal refund lines.
 * Run: pnpm test:blitzpay-phase-2e
 */
import assert from "node:assert/strict"
import { mapBlitzpayRefundToPortalHistory } from "../lib/portal/portal-invoice-payment-history"
import { isBlitzPayPhase2WebhookEventType } from "../lib/blitzpay/webhook-phase2-events"

function testDisputeEventTypesRouted() {
  assert.equal(isBlitzPayPhase2WebhookEventType("charge.dispute.updated"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("charge.dispute.closed"), true)
}

function testPortalRefundLineHasNoStripeIds() {
  const row = mapBlitzpayRefundToPortalHistory({
    amount_cents: 2500,
    applied_on: "2026-05-11",
  })
  assert.equal(row.amountCents, -2500)
  assert.equal(row.methodLabel.includes("BlitzPay"), true)
  assert.equal(row.referenceDisplay, null)
  assert.equal(row.statusLabel, "Refunded")
}

testDisputeEventTypesRouted()
testPortalRefundLineHasNoStripeIds()
console.log("blitzpay phase 2e tests passed")
