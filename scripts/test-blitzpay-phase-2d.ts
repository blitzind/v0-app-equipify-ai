/**
 * BlitzPay Phase 2D — portal-safe payment history + receipt shape helpers.
 * Run: pnpm test:blitzpay-phase-2d
 */
import assert from "node:assert/strict"
import { buildInvoicePaymentReceiptShape } from "../lib/blitzpay/invoice-payment-receipt"
import { mapOrgInvoicePaymentRowToPortalHistory } from "../lib/portal/portal-invoice-payment-history"

function testPortalHistoryMasksBlitzpayRef() {
  const row = mapOrgInvoicePaymentRowToPortalHistory({
    paid_on: "2026-05-10",
    amount_cents: 5000,
    payment_method: "card",
    reference: "blitzpay_pi:pi_abc123",
  })
  assert.equal(row.methodLabel.includes("BlitzPay"), true)
  assert.equal(row.referenceDisplay, "Electronic confirmation on file")
  assert.equal(row.statusLabel, "Received")
}

function testPortalHistoryShowsCheckRef() {
  const row = mapOrgInvoicePaymentRowToPortalHistory({
    paid_on: "2026-05-01",
    amount_cents: 1200,
    payment_method: "check",
    reference: "CHK 4412",
  })
  assert.equal(row.referenceDisplay, "CHK 4412")
}

function testReceiptShape() {
  const r = buildInvoicePaymentReceiptShape({
    organizationName: "Acme Labs",
    customerName: "BioCo",
    invoiceNumber: "INV-1001",
    amountPaidCents: 2500,
    paidOnYyyyMmDd: "2026-05-10",
    referenceRaw: "blitzpay_pi:pi_xyz",
  })
  assert.equal(r.organizationName, "Acme Labs")
  assert.equal(r.paymentReferenceDisplay, "Electronic confirmation on file")
}

testPortalHistoryMasksBlitzpayRef()
testPortalHistoryShowsCheckRef()
testReceiptShape()
console.log("blitzpay phase 2d tests passed")
