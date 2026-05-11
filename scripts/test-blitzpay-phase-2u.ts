/**
 * BlitzPay Phase 2U — executive business health (deterministic), platform rollup, API gates, portal isolation.
 * Run: pnpm test:blitzpay-phase-2u
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import { fileURLToPath } from "node:url"

import { buildExecutiveRecommendations } from "../lib/blitzpay/blitzpay-executive-recommendations"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testExecutiveRecommendationsDeterministic() {
  const a = buildExecutiveRecommendations({
    reportingWindowDays: 30,
    overdueCollectibleCents: 50_000_00,
    overdueInvoiceCount: 12,
    overdueInvoiceCountPriorWindowApprox: 10,
    netCashPosition30Cents: -5_000_00,
    grossCollectedWindowCents: 80_000_00,
    openDisputesCount: 1,
    openDisputesAmountCents: 2_000_00,
    refundedVolumeWindowCents: 500_00,
    reminderEffectivenessRatePct: 45,
    recoveredRevenueCents: 12_000_00,
    treasuryAveragePayoutDelayDays: 4.2,
    treasuryAveragePayoutDelayDaysPriorApprox: 2.0,
    financingSessionsCreatedWindowCount: 2,
    financingSessionsFundedOrReleasedCount: 1,
    estimateOpenQuotesWithTotalCount: 4,
    quotesWithBlitzpayDepositCollected: 2,
    technicianTopTwoSharePct: 62,
    completedJobsTopTwoSharePct: null,
    overdueConcentrationTopSharePct: 42,
    completedWoWithoutInvoiceSampleCount: 8,
    completedWoScanned: 20,
    fieldInvoiceLaterWindowCount: 2,
  })
  const b = buildExecutiveRecommendations({
    reportingWindowDays: 30,
    overdueCollectibleCents: 50_000_00,
    overdueInvoiceCount: 12,
    overdueInvoiceCountPriorWindowApprox: 10,
    netCashPosition30Cents: -5_000_00,
    grossCollectedWindowCents: 80_000_00,
    openDisputesCount: 1,
    openDisputesAmountCents: 2_000_00,
    refundedVolumeWindowCents: 500_00,
    reminderEffectivenessRatePct: 45,
    recoveredRevenueCents: 12_000_00,
    treasuryAveragePayoutDelayDays: 4.2,
    treasuryAveragePayoutDelayDaysPriorApprox: 2.0,
    financingSessionsCreatedWindowCount: 2,
    financingSessionsFundedOrReleasedCount: 1,
    estimateOpenQuotesWithTotalCount: 4,
    quotesWithBlitzpayDepositCollected: 2,
    technicianTopTwoSharePct: 62,
    completedJobsTopTwoSharePct: null,
    overdueConcentrationTopSharePct: 42,
    completedWoWithoutInvoiceSampleCount: 8,
    completedWoScanned: 20,
    fieldInvoiceLaterWindowCount: 2,
  })
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id))
  assert.ok(a.some((x) => x.id === "net_cash_30_negative"))
}

function testOrgBusinessHealthApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/business-health/route.ts")
  assert.match(src, /canViewFinancialReports/)
  assert.match(src, /canViewFinancials/)
  assert.match(src, /fetchBlitzpayBusinessHealth/)
}

function testPlatformBusinessHealthApiGate() {
  const src = read("app/api/platform/blitzpay/business-health-rollup/route.ts")
  assert.match(src, /isPlatformAdminEmail/)
  assert.match(src, /fetchBlitzpayPlatformBusinessHealthRollup/)
}

function testBoundedConstants() {
  const pipe = read("lib/blitzpay/blitzpay-workflow-cash-pipeline.ts")
  assert.match(pipe, /WO_SCAN_LIMIT/)
  const cust = read("lib/blitzpay/blitzpay-customer-payment-behavior.ts")
  assert.match(cust, /INVOICE_SCAN_LIMIT/)
  const plat = read("lib/blitzpay/blitzpay-platform-business-health.ts")
  assert.match(plat, /MAX_ORGS/)
}

function testNoStripeIdsInExecutiveLibs() {
  for (const rel of [
    "lib/blitzpay/blitzpay-business-health.ts",
    "lib/blitzpay/blitzpay-executive-recommendations.ts",
    "lib/blitzpay/blitzpay-customer-payment-behavior.ts",
    "lib/blitzpay/blitzpay-workflow-cash-pipeline.ts",
    "lib/blitzpay/blitzpay-platform-business-health.ts",
    "components/blitzpay/blitzpay-executive-dashboard.tsx",
  ]) {
    const s = read(rel)
    assert.doesNotMatch(s, /\bpi_[a-zA-Z0-9]+\b/, rel)
    assert.doesNotMatch(s, /\bpo_[a-zA-Z0-9]+\b/, rel)
  }
}

function testPortalIsolation() {
  const portalRoot = path.join(ROOT, "app/portal")
  const files: string[] = []
  function walk(d: string) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) files.push(p)
    }
  }
  walk(portalRoot)
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8")
    assert.doesNotMatch(s, /business-health/, `${f} must not reference business-health`)
    assert.doesNotMatch(s, /business-health-rollup/, `${f} must not reference business-health-rollup`)
  }
}

function testHealthScoreRanges() {
  const scores = read("lib/blitzpay/blitzpay-business-health.ts")
  assert.match(scores, /clampScore/)
  assert.match(scores, /Math\.min\(100/)
}

testExecutiveRecommendationsDeterministic()
testOrgBusinessHealthApiGate()
testPlatformBusinessHealthApiGate()
testBoundedConstants()
testNoStripeIdsInExecutiveLibs()
testPortalIsolation()
testHealthScoreRanges()
console.log("blitzpay phase 2u tests: OK")
