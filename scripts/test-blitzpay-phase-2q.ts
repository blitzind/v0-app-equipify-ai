/**
 * BlitzPay Phase 2Q — revenue intelligence, forecasting, collections metrics.
 * Run: pnpm test:blitzpay-phase-2q
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  blitzpayOverdueRecoveryMultiplier,
  blitzpayWalletLiabilityCents,
  buildBlitzpayForecastHorizonsCents,
} from "../lib/blitzpay/blitzpay-revenue-forecast-math"
import { buildBlitzpayRevenueRecommendations } from "../lib/blitzpay/blitzpay-revenue-recommendations"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testWalletLiabilityMath() {
  assert.equal(blitzpayWalletLiabilityCents(100, 50), 150)
  assert.equal(blitzpayWalletLiabilityCents(-10, 20), 20)
}

function testForecastMath() {
  const f = buildBlitzpayForecastHorizonsCents({
    scheduledPendingDueWithin7Cents: 1000,
    scheduledPendingDueWithin30Cents: 5000,
    scheduledPendingDueWithin60Cents: 8000,
    installmentRemainingDueWithin7Cents: 200,
    installmentRemainingDueWithin30Cents: 900,
    installmentRemainingDueWithin60Cents: 1200,
    overdueRecoveryExpectedCents: 300,
    estimateDepositPipelineCents7: 100,
    estimateDepositPipelineCents30: 400,
    estimateDepositPipelineCents60: 400,
  })
  assert.equal(f.next7DaysExpectedCents, 1000 + 200 + 300 + 100)
  assert.ok(f.next30DaysExpectedCents >= f.next7DaysExpectedCents)
  assert.ok(f.next60DaysExpectedCents >= f.next30DaysExpectedCents)
}

function testRecoveryMultiplier() {
  assert.equal(blitzpayOverdueRecoveryMultiplier(0), 0.05)
  assert.equal(blitzpayOverdueRecoveryMultiplier(100), 0.35)
  assert.equal(blitzpayOverdueRecoveryMultiplier(50), 0.35)
}

function testRecommendationsSmoke() {
  const r = buildBlitzpayRevenueRecommendations({
    overdueCollectibleCents: 50_000,
    overdueInvoiceCount: 3,
    achPendingCount: 4,
    achSettledRatio: 0.2,
    estimateDepositShareApprox: 0.2,
    walletLiabilityCents: 300_00,
    walletCreditInflowWindowCents: 100_00,
    activeInstallmentPlansCount: 0,
    largeOpenInvoiceBalanceCents: 15_000_00,
    reminderEffectivenessRatePct: 20,
  })
  assert.ok(r.some((x) => x.id === "prioritize_overdue"))
  assert.ok(r.some((x) => x.id === "ach_slow"))
}

function testOrgApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/revenue-intelligence/route.ts")
  assert.match(src, /canViewFinancialReports/)
  assert.match(src, /canViewFinancials/)
  assert.match(src, /fetchBlitzpayOrgRevenueIntelligence/)
}

function testPlatformRollupGate() {
  const src = read("app/api/platform/blitzpay/revenue-rollup/route.ts")
  assert.match(src, /isPlatformAdminEmail/)
}

function testNoPortalExposure() {
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
    assert.doesNotMatch(s, /revenue-intelligence/, `${f} must not reference org revenue-intelligence API`)
  }
}

function testReportingSourceConsistency() {
  const snap = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(snap, /reportingSource:/)
  const intel = read("lib/blitzpay/blitzpay-revenue-intelligence.ts")
  assert.match(intel, /reportingSource: reporting.reportingSource/)
}

testWalletLiabilityMath()
testForecastMath()
testRecoveryMultiplier()
testRecommendationsSmoke()
testOrgApiGate()
testPlatformRollupGate()
testNoPortalExposure()
testReportingSourceConsistency()

console.log("blitzpay phase 2q tests passed")
