import assert from "node:assert/strict"
import { computeBlitzpayConvenienceFeePreview } from "../lib/blitzpay/convenience-fees"

function testOffMerchantAbsorbs() {
  const p = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: 10000,
    settings: {
      passProcessingFeesToCustomer: false,
      feeMode: "merchant_absorbs",
      feePercentageSnapshot: 2.9,
      feeCapCents: null,
      disclosureCopy: "A processing fee is applied for online card payments.",
    },
  })
  assert.equal(p.convenienceFeeCents, 0)
  assert.equal(p.totalChargeCents, 10000)
}

function testOnPassThrough() {
  const p = computeBlitzpayConvenienceFeePreview({
    invoiceBalanceCents: 10000,
    settings: {
      passProcessingFeesToCustomer: true,
      feeMode: "customer_pass_through",
      feePercentageSnapshot: 3,
      feeCapCents: null,
      disclosureCopy: "A processing fee is applied for online card payments.",
    },
  })
  assert.equal(p.convenienceFeeCents, 300)
  assert.equal(p.totalChargeCents, 10300)
}

function testCapAndDeterminism() {
  const args = {
    invoiceBalanceCents: 10000,
    settings: {
      passProcessingFeesToCustomer: true,
      feeMode: "customer_pass_through" as const,
      feePercentageSnapshot: 10,
      feeCapCents: 250,
      disclosureCopy: "A processing fee is applied for online card payments.",
    },
  }
  const a = computeBlitzpayConvenienceFeePreview(args)
  const b = computeBlitzpayConvenienceFeePreview(args)
  assert.equal(a.convenienceFeeCents, 250)
  assert.equal(b.convenienceFeeCents, 250)
  assert.equal(a.totalChargeCents, b.totalChargeCents)
}

testOffMerchantAbsorbs()
testOnPassThrough()
testCapAndDeterminism()
console.log("blitzpay phase 2g tests passed")
