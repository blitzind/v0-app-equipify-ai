/**
 * BlitzPay Phase 2O — financing, installments, revenue acceleration foundations.
 * Run: pnpm test:blitzpay-phase-2o
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildEqualInstallmentPlan,
  buildTwentyFiveFiftyTwentyFivePlan,
  installmentTargetsMatchTotal,
  sumInstallmentTargetsCents,
} from "../lib/blitzpay/blitzpay-payment-plan-math"
import { isQuoteFinancingSurfaceEligible } from "../lib/blitzpay/blitzpay-financing-eligibility"
import { financingStatusCustomerLabel } from "../lib/blitzpay/blitzpay-financing-status"
import { buildQuoteRevenueAccelerationInsights } from "../lib/blitzpay/blitzpay-revenue-acceleration-insights"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testTwentyFiveFiftyTwentyFive() {
  const rows = buildTwentyFiveFiftyTwentyFivePlan(10_000)
  assert.equal(rows.length, 3)
  assert.ok(installmentTargetsMatchTotal(rows, 10_000))
}

function testEqualThree() {
  const rows = buildEqualInstallmentPlan(100, 3)
  assert.equal(rows.length, 3)
  assert.equal(sumInstallmentTargetsCents(rows), 100)
}

function testEligibility() {
  assert.equal(
    isQuoteFinancingSurfaceEligible({
      orgFinancingEnabled: true,
      orgInstallmentPlansEnabled: true,
      quoteFinancingReadyFlag: true,
      quoteAmountCents: 6000,
      quoteArchived: false,
      quoteConvertedInvoiceId: null,
    }),
    true,
  )
  assert.equal(
    isQuoteFinancingSurfaceEligible({
      orgFinancingEnabled: false,
      orgInstallmentPlansEnabled: true,
      quoteFinancingReadyFlag: true,
      quoteAmountCents: 6000,
      quoteArchived: false,
      quoteConvertedInvoiceId: null,
    }),
    false,
  )
}

function testCustomerStatusLabels() {
  assert.match(financingStatusCustomerLabel("approved"), /Approved/)
  assert.match(financingStatusCustomerLabel("unknown"), /review/i)
}

function testInsightsNonEmptyForLargeQuote() {
  const ins = buildQuoteRevenueAccelerationInsights({
    quoteAmountCents: 2_000_000,
    depositCollectedCents: 0,
    depositTargetCents: 500_000,
    financingReady: true,
    orgFinancingEnabled: true,
    orgInstallmentPlansEnabled: true,
  })
  assert.ok(ins.some((i) => i.code === "financing_ready"))
}

function testMigrationMarkers() {
  const sql = read("supabase/migrations/20260922120000_blitzpay_phase_2o_financing_installments.sql")
  assert.match(sql, /blitzpay_payment_plans/)
  assert.match(sql, /blitzpay_financing_sessions/)
  assert.match(sql, /idx_blitzpay_payment_plans_idem/)
}

function testPaymentPlanServiceIdempotency() {
  const src = read("lib/blitzpay/blitzpay-payment-plan-service.ts")
  assert.match(src, /idempotency_key/)
  assert.match(src, /isUniqueViolation/)
  assert.match(src, /in\("status", \["active", "draft"\]\)/)
}

function testFinancingSummaryRoute() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/financing/summary/route.ts")
  assert.match(src, /blitzpay_financing_providers/)
}

function testPortalFinancingPayload() {
  const src = read("app/api/portal/quotes/[quoteId]/route.ts")
  assert.match(src, /portalFinancing/)
  assert.match(src, /buildPortalQuoteFinancingPayload/)
}

testTwentyFiveFiftyTwentyFive()
testEqualThree()
testEligibility()
testCustomerStatusLabels()
testInsightsNonEmptyForLargeQuote()
testMigrationMarkers()
testPaymentPlanServiceIdempotency()
testFinancingSummaryRoute()
testPortalFinancingPayload()

console.log("blitzpay phase 2o tests passed")
