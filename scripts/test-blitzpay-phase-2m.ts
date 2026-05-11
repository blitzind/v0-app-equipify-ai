/**
 * BlitzPay Phase 2M — estimates, deposits, financing foundations.
 * Run: pnpm test:blitzpay-phase-2m
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  computeBlitzpayQuoteDepositTargetCents,
  quoteRemainingAfterDepositCents,
} from "../lib/blitzpay/blitzpay-estimate-deposit-math"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testDepositMathFixed() {
  const r = computeBlitzpayQuoteDepositTargetCents({
    quoteAmountCents: 10_000,
    mode: "fixed",
    fixedCents: 2500,
    percentageBps: null,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.targetPayCents, 2500)
}

function testDepositMathPercentage() {
  const r = computeBlitzpayQuoteDepositTargetCents({
    quoteAmountCents: 10_000,
    mode: "percentage",
    fixedCents: null,
    percentageBps: 2500,
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.targetPayCents, 2500)
}

function testRemainingAfterDeposit() {
  assert.equal(quoteRemainingAfterDepositCents(10_000, 2500), 7500)
  assert.equal(quoteRemainingAfterDepositCents(10_000, 10_000), 0)
}

function testApplyReferenceIdempotentShape() {
  const src = read("lib/blitzpay/blitzpay-quote-deposit-apply.ts")
  assert.match(src, /blitzpay_quote_deposit_apply:/)
  assert.match(src, /blitzpayQuoteDepositApplyReference/)
  assert.match(src, /\.eq\("reference", ref\)/)
}

function testPortalPayResolvesQuoteBranch() {
  const src = read("app/portal/pay/[token]/route.ts")
  assert.match(src, /resolved\.kind/)
  assert.match(src, /portal\/quotes/)
}

function testPaymentLinkXorMigration() {
  const sql = read("supabase/migrations/20260920120000_blitzpay_phase_2m_estimates_deposits.sql")
  assert.match(sql, /org_quote_id/)
  assert.match(sql, /org_invoice_id is not null and org_quote_id is null/)
}

function testCollectionsQuoteLinkCreator() {
  const src = read("lib/blitzpay/blitzpay-collections.ts")
  assert.match(src, /createBlitzpayQuotePaymentLink/)
  assert.match(src, /kind: "quote"/)
}

testDepositMathFixed()
testDepositMathPercentage()
testRemainingAfterDeposit()
testApplyReferenceIdempotentShape()
testPortalPayResolvesQuoteBranch()
testPaymentLinkXorMigration()
testCollectionsQuoteLinkCreator()

console.log("blitzpay phase 2m tests passed")
