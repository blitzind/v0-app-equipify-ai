/**
 * BlitzPay Phase 2H — payout reconciliation math + webhook routing.
 * Run: pnpm test:blitzpay-phase-2h
 */
import assert from "node:assert/strict"
import {
  isBlitzpayConnectedAccountActivityType,
  summarizeBlitzpayBalanceTransactions,
} from "../lib/blitzpay/blitzpay-reconciliation-math"
import { isBlitzPayPhase2WebhookEventType } from "../lib/blitzpay/webhook-phase2-events"

function testPayoutWebhookTypesRouted() {
  assert.equal(isBlitzPayPhase2WebhookEventType("payout.paid"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("payout.updated"), true)
  assert.equal(isBlitzPayPhase2WebhookEventType("payout.created"), true)
}

function testActivityTypeFilter() {
  assert.equal(isBlitzpayConnectedAccountActivityType("payment"), true)
  assert.equal(isBlitzpayConnectedAccountActivityType("payout"), false)
  assert.equal(isBlitzpayConnectedAccountActivityType("payout_failure"), false)
}

function testSummarizeRefundAndPayment() {
  const t = summarizeBlitzpayBalanceTransactions([
    { balance_type: "payment", gross_cents: 1000, fee_cents: 50, net_cents: 950 },
    { balance_type: "refund", gross_cents: -200, fee_cents: 0, net_cents: -200 },
    { balance_type: "payout", gross_cents: -750, fee_cents: 0, net_cents: -750 },
  ])
  assert.equal(t.activityRowCount, 2)
  assert.equal(t.sumGrossCents, 800)
  assert.equal(t.sumStripeFeesCents, 50)
  assert.equal(t.sumNetCents, 750)
  assert.equal(t.paymentLikeNetCents, 950)
  assert.equal(t.refundLikeNetCents, -200)
}

testPayoutWebhookTypesRouted()
testActivityTypeFilter()
testSummarizeRefundAndPayment()
console.log("blitzpay phase 2h tests passed")
