/**
 * BlitzPay Phase 2T — financial command center math, scorecards, recommendations, portal isolation.
 * Run: pnpm test:blitzpay-phase-2t
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import { fileURLToPath } from "node:url"

import { buildCombinedArApCashForecast } from "../lib/blitzpay/blitzpay-command-center-math"
import { buildFinancialCommandCenterRecommendations } from "../lib/blitzpay/blitzpay-command-center-recommendations"
import { buildOwnerScorecards, scorecardStatusLabel } from "../lib/blitzpay/blitzpay-owner-scorecards"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testCombinedForecast() {
  const c = buildCombinedArApCashForecast({
    forecastHorizons: {
      next7DaysExpectedCents: 10_000,
      next30DaysExpectedCents: 40_000,
      next60DaysExpectedCents: 70_000,
    },
    apDue7OpenCents: 15_000,
    apDue30OpenCents: 20_000,
    apDue60OpenCents: 25_000,
    payoutPressureCents: 5_000,
  })
  assert.equal(c.netCashPosition7Cents, 10_000 - 15_000 - 5_000)
  assert.ok(c.riskNotes.length > 0)
}

function testScorecards() {
  const s = buildOwnerScorecards({
    overdueInvoiceCount: 0,
    overdueCollectibleCents: 0,
    netCashPosition30Cents: 1000,
    netCashPosition7Cents: 500,
    abandonedCheckoutInvoices: 0,
    stripePayoutsEnabled: true,
    failedPayoutCount30d: 0,
    apDue30OpenCents: 1000,
    operatingBalanceCents: 50_000_00,
    walletLiabilityCents: 1000,
    openDisputesCount: 0,
    openDisputesAmountCents: 0,
    reminderEffectivenessRatePct: 40,
  })
  const ch = s.find((x) => x.id === "collection_health")
  assert.ok(ch && ch.status === "healthy")
  assert.equal(scorecardStatusLabel("watch"), "Watch")
}

function testCommandRecommendations() {
  const base = buildCombinedArApCashForecast({
    forecastHorizons: { next7DaysExpectedCents: 1000, next30DaysExpectedCents: 2000, next60DaysExpectedCents: 3000 },
    apDue7OpenCents: 100,
    apDue30OpenCents: 5000,
    apDue60OpenCents: 6000,
    payoutPressureCents: 100,
  })
  const r = buildFinancialCommandCenterRecommendations({
    combined: base,
    overdueInvoiceCount: 2,
    overdueCollectibleCents: 500_00,
    apDue7OpenCents: 100,
    apDue30OpenCents: 5000,
    expectedInflow30Cents: 2000,
    reserveTargetCents: 10_000_00,
    heldReserveCents: 5_000_00,
    openDisputesAmountCents: 10_000_00,
    failedPayoutCount30d: 1,
    financingReadyQuotesCount: 3,
    estimateOpenQuotesWithTotalCount: 5,
    workOrderCollectPaymentLinksWindowCount: 0,
    pendingApprovalPayableCount: 2,
  })
  assert.ok(r.some((x) => x.id === "collect_before_ap"))
  assert.ok(r.some((x) => x.id === "ap_exceeds_collections_forecast"))
}

function testOrgApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/financial-command-center/route.ts")
  assert.match(src, /canViewFinancialReports/)
  assert.match(src, /canViewFinancials/)
  assert.match(src, /fetchBlitzpayOrgFinancialCommandCenter/)
}

function testPlatformApiGate() {
  const src = read("app/api/platform/blitzpay/command-center-rollup/route.ts")
  assert.match(src, /isPlatformAdminEmail/)
  assert.match(src, /fetchBlitzpayPlatformCommandCenterRollup/)
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
    assert.doesNotMatch(s, /financial-command-center/, `${f} must not reference financial-command-center`)
    assert.doesNotMatch(s, /command-center-rollup/, `${f} must not reference command-center-rollup`)
  }
}

function testDrilldownSafety() {
  const src = read("lib/blitzpay/blitzpay-financial-command-center.ts")
  assert.doesNotMatch(src, /pi_/)
  assert.doesNotMatch(src, /po_/)
  assert.ok(src.includes('"/invoices"'))
}

function main() {
  testCombinedForecast()
  testScorecards()
  testCommandRecommendations()
  testOrgApiGate()
  testPlatformApiGate()
  testNoPortalExposure()
  testDrilldownSafety()
  console.log("blitzpay-phase-2t tests passed")
}

main()
