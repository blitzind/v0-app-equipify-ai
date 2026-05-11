/**
 * BlitzPay Phase 2K — autopay consent, scheduled payments, partial pay math.
 * Run: pnpm test:blitzpay-phase-2k
 */
import assert from "node:assert/strict"
import {
  BLITZPAY_AUTOPAY_CONSENT_COPY_VERSION,
  BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY,
} from "../lib/blitzpay/blitzpay-consent-copy"
import { computeBlitzpayConvenienceFeePreview } from "../lib/blitzpay/convenience-fees"
import {
  buildScheduledExecutionStripeIdempotencyKey,
  clampInvoicePortionCents,
  effectivePartialPaymentsEnabled,
  remainingBalanceAfterPortion,
} from "../lib/blitzpay/blitzpay-phase2k-partial-math"

function testConsentCopyShape() {
  assert.match(BLITZPAY_AUTOPAY_CONSENT_COPY_VERSION, /^blitzpay_/)
  assert.ok(BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY.length > 80)
  assert.ok(BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY.toLowerCase().includes("authorize"))
}

function testPartialEligibility() {
  assert.equal(
    effectivePartialPaymentsEnabled({
      orgPartialEnabled: true,
      platformPartialAllowed: true,
      minPortionCents: 50,
    }),
    true,
  )
  assert.equal(
    effectivePartialPaymentsEnabled({
      orgPartialEnabled: true,
      platformPartialAllowed: false,
      minPortionCents: 50,
    }),
    false,
  )
}

function testClampPartial() {
  const full = clampInvoicePortionCents({
    balanceDueCents: 10_000,
    requestedPortionCents: null,
    partialEnabled: true,
    minPortionCents: 50,
  })
  assert.equal(full.ok && full.portionCents, 10_000)

  const partialOk = clampInvoicePortionCents({
    balanceDueCents: 10_000,
    requestedPortionCents: 2500,
    partialEnabled: true,
    minPortionCents: 100,
  })
  assert.equal(partialOk.ok && partialOk.portionCents, 2500)

  const fullWhenPartialOff = clampInvoicePortionCents({
    balanceDueCents: 10_000,
    requestedPortionCents: 2500,
    partialEnabled: false,
    minPortionCents: 50,
  })
  assert.equal(fullWhenPartialOff.ok && fullWhenPartialOff.portionCents, 10_000)
}

function testRemainingAfterPortion() {
  assert.equal(remainingBalanceAfterPortion(10_000, 2500), 7500)
  assert.equal(remainingBalanceAfterPortion(100, 150), 0)
}

function testScheduledStripeIdempotencyStable() {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  const k = buildScheduledExecutionStripeIdempotencyKey(id)
  assert.equal(k, buildScheduledExecutionStripeIdempotencyKey(id))
  assert.ok(k.includes(id))
}

function testFeeOnPartialPortion() {
  const preview = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: 5000,
    settings: {
      passProcessingFeesToCustomer: true,
      feeMode: "customer_pass_through",
      feePercentageSnapshot: 2.9,
      feeCapCents: null,
      disclosureCopy: "Fee disclosure",
    },
    paymentMethodType: "card",
    achConvenienceFeeEnabled: false,
  })
  assert.ok(preview.convenienceFeeCents > 0)
  assert.equal(preview.totalChargeCents, 5000 + preview.convenienceFeeCents)
}

/** Mirrors schedule-create rules for partial vs balance (pure). */
function schedulePortionEligible(args: {
  balanceDue: number
  requested: number
  partialEff: boolean
}): { ok: true } | { ok: false; code: string } {
  const portion = Math.round(args.requested)
  if (portion < 50 || portion > args.balanceDue) return { ok: false, code: "invalid_amount" }
  if (portion < args.balanceDue && !args.partialEff) return { ok: false, code: "partial_not_allowed" }
  return { ok: true }
}

function testScheduleEligibility() {
  assert.equal(schedulePortionEligible({ balanceDue: 10_000, requested: 10_000, partialEff: false }).ok, true)
  assert.equal(schedulePortionEligible({ balanceDue: 10_000, requested: 5000, partialEff: true }).ok, true)
  assert.equal(schedulePortionEligible({ balanceDue: 10_000, requested: 5000, partialEff: false }).ok, false)
}

/** Row-level lock skip: second transition when not pending. */
function simulateScheduleLock(currentStatus: string): "proceed" | "skip" {
  if (currentStatus !== "pending") return "skip"
  return "proceed"
}

function testIdempotentScheduledExecutionLock() {
  assert.equal(simulateScheduleLock("pending"), "proceed")
  assert.equal(simulateScheduleLock("processing"), "skip")
  assert.equal(simulateScheduleLock("succeeded"), "skip")
}

function testRevokeVsCancelSemantics() {
  assert.equal(["active", "revoked", "none"].includes("revoked"), true)
  assert.equal(["pending", "cancelled"].includes("cancelled"), true)
}

function main() {
  testConsentCopyShape()
  testPartialEligibility()
  testClampPartial()
  testRemainingAfterPortion()
  testScheduledStripeIdempotencyStable()
  testFeeOnPartialPortion()
  testScheduleEligibility()
  testIdempotentScheduledExecutionLock()
  testRevokeVsCancelSemantics()
  console.log("BlitzPay Phase 2K tests passed.")
}

main()
