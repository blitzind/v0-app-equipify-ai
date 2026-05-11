/**
 * BlitzPay Phase 2R — contractor treasury math, aggregation wiring, portal isolation.
 * Run: pnpm test:blitzpay-phase-2r
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  averagePayoutDelayDaysFromPaidRows,
  classifyPayoutSpeedLaneFromRecentMethods,
  computeHeldReserveCents,
  computeInstantTransferEligibility,
  computeOperatingBalanceCents,
  estimateUpcomingTransferCents,
  partitionBlitzpayActivityNetByAvailability,
} from "../lib/blitzpay/blitzpay-treasury-math"
import { buildBlitzpayTreasuryInsights } from "../lib/blitzpay/blitzpay-treasury-insights"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testPartitionMath() {
  const today = "2026-05-11"
  const { availableCents, pendingCents } = partitionBlitzpayActivityNetByAvailability(
    [
      { balance_type: "payment", net_cents: 1000, available_on: "2026-05-01" },
      { balance_type: "payment", net_cents: 500, available_on: "2026-05-20" },
      { balance_type: "payout", net_cents: -1000, available_on: "2026-05-01" },
    ],
    today,
  )
  assert.equal(availableCents, 1000)
  assert.equal(pendingCents, 500)
}

function testReserveAndOperating() {
  assert.equal(
    computeHeldReserveCents({ reserveTargetCents: 300, ledgerAvailableCents: 1000 }),
    300,
  )
  assert.equal(
    computeHeldReserveCents({ reserveTargetCents: 2000, ledgerAvailableCents: 1000 }),
    1000,
  )
  assert.equal(
    computeOperatingBalanceCents({ ledgerAvailableCents: 1000, heldReserveCents: 250 }),
    750,
  )
}

function testAvgDelay() {
  const d = averagePayoutDelayDaysFromPaidRows([
    {
      stripe_created_at: "2026-05-01T12:00:00.000Z",
      arrival_date: "2026-05-04",
    },
  ])
  assert.ok(d != null && d >= 2.9 && d <= 3.1)
}

function testForecastConsistency() {
  assert.equal(
    estimateUpcomingTransferCents({ payoutInTransitCents: 200, pendingLedgerCents: 100 }),
    300,
  )
}

function testInstantEligibility() {
  assert.equal(
    computeInstantTransferEligibility({
      stripePayoutsEnabled: true,
      usedInstantPayoutInWindow: false,
      instantPayoutInterest: true,
    }),
    true,
  )
  assert.equal(
    computeInstantTransferEligibility({
      stripePayoutsEnabled: false,
      usedInstantPayoutInWindow: true,
      instantPayoutInterest: false,
    }),
    false,
  )
}

function testPayoutSpeedLane() {
  assert.equal(classifyPayoutSpeedLaneFromRecentMethods(["standard", "instant"]), "accelerated")
  assert.equal(classifyPayoutSpeedLaneFromRecentMethods(["standard"]), "standard")
}

function testInsightsSmoke() {
  const i = buildBlitzpayTreasuryInsights({
    avgPayoutDelayDays: 6,
    avgPayoutDelayBaselineDays: 3,
    pendingAchSettlementCount: 5,
    pendingLedgerCents: 100,
    instantTransferEligible: true,
    usedInstantPayoutRecently: false,
    openDisputeCount: 2,
    openDisputeBaseline: 0,
    estimateUpcomingTransferCents: 10_000,
    upcomingTransferBaselineCents: 1000,
    failedPayoutCount30d: 1,
  })
  assert.ok(i.some((x) => x.id === "payout_delays_increasing"))
  assert.ok(i.some((x) => x.id === "payout_failures"))
}

function testTreasuryApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/treasury/route.ts")
  assert.match(src, /canViewFinancials/)
  assert.match(src, /canEditInvoices/)
  assert.match(src, /fetchBlitzpayTreasuryDashboard/)
}

function testMigrationMarker() {
  const m = read("supabase/migrations/20260924120000_blitzpay_phase_2r_treasury_balances.sql")
  assert.match(m, /blitzpay_org_balances/)
  assert.match(m, /blitzpay_balance_snapshots/)
}

function testSchemaHealthTables() {
  const h = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(h, /blitzpay_org_balances/)
  assert.match(h, /blitzpay_balance_snapshots/)
}

function testRevenueIntelligenceUsesReportingTreasury() {
  const intel = read("lib/blitzpay/blitzpay-revenue-intelligence.ts")
  assert.match(intel, /treasuryPendingPayoutTotalsCents/)
  assert.match(intel, /treasuryEstimateUpcomingTransferCents/)
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
    assert.doesNotMatch(s, /\/blitzpay\/treasury/, `${f} must not reference org treasury API path`)
  }
}

testPartitionMath()
testReserveAndOperating()
testAvgDelay()
testForecastConsistency()
testInstantEligibility()
testPayoutSpeedLane()
testInsightsSmoke()
testTreasuryApiGate()
testMigrationMarker()
testSchemaHealthTables()
testRevenueIntelligenceUsesReportingTreasury()
testNoPortalExposure()

console.log("blitzpay phase 2r tests passed")
