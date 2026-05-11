/**
 * BlitzPay Phase 2S — vendor payables, AP math, lifecycle, portal isolation.
 * Run: pnpm test:blitzpay-phase-2s
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import { fileURLToPath } from "node:url"

import { buildBlitzpayApInsights } from "../lib/blitzpay/blitzpay-ap-insights"
import {
  aggregateApObligationBuckets,
  projectedOutgoingCashCents,
  reserveStressRatio,
  vendorPayoutVelocityPaidCents,
} from "../lib/blitzpay/blitzpay-ap-math"
import { isValidVendorPayableTransition } from "../lib/blitzpay/blitzpay-payable-lifecycle"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testApBuckets() {
  const today = "2026-05-11"
  const b = aggregateApObligationBuckets(
    [
      { amount_cents: 1000, due_date: "2026-05-01", status: "approved", reimbursement_flag: true },
      { amount_cents: 2000, due_date: "2026-05-20", status: "scheduled", material_cost_flag: true, work_order_id: "wo1" },
      { amount_cents: 500, due_date: "2026-06-01", status: "paid" },
    ],
    today,
  )
  assert.equal(b.outstandingOpenCents, 3000)
  assert.equal(b.overdueOpenCents, 1000)
  assert.equal(b.dueWithin7DaysOpenCents, 1000)
  assert.ok(b.dueWithin30DaysOpenCents >= 3000)
  assert.equal(b.pendingReimbursementOpenCents, 1000)
  assert.equal(b.materialOpenCents, 2000)
  assert.equal(b.workOrderLinkedOpenCents, 2000)
}

function testProjectedOutgoing() {
  assert.equal(
    projectedOutgoingCashCents({ apOpenDueWithin7DaysCents: 100, stripeEstimateUpcomingTransferCents: 50 }),
    150,
  )
}

function testReserveStress() {
  assert.equal(reserveStressRatio({ reserveTargetCents: 1000, apOpenDueWithin30DaysCents: 1500 }), 1.5)
  assert.equal(reserveStressRatio({ reserveTargetCents: 0, apOpenDueWithin30DaysCents: 100 }), null)
}

function testVendorVelocity() {
  const since = "2026-05-01T00:00:00.000Z"
  const v = vendorPayoutVelocityPaidCents(
    [
      { amount_cents: 100, recorded_at: "2026-05-10T12:00:00.000Z" },
      { amount_cents: 50, recorded_at: "2026-04-01T12:00:00.000Z" },
    ],
    since,
  )
  assert.equal(v, 100)
}

function testLifecycleTransitions() {
  assert.equal(isValidVendorPayableTransition("draft", "pending_approval"), true)
  assert.equal(isValidVendorPayableTransition("pending_approval", "approved"), true)
  assert.equal(isValidVendorPayableTransition("approved", "scheduled"), true)
  assert.equal(isValidVendorPayableTransition("scheduled", "paid"), true)
  assert.equal(isValidVendorPayableTransition("paid", "draft"), false)
  assert.equal(isValidVendorPayableTransition("draft", "paid"), false)
}

function testInsightsSmoke() {
  const i = buildBlitzpayApInsights({
    buckets: {
      outstandingOpenCents: 10_000,
      overdueOpenCents: 0,
      dueWithin7DaysOpenCents: 50_000,
      dueWithin30DaysOpenCents: 80_000,
      dueWithin60DaysOpenCents: 90_000,
      pendingReimbursementOpenCents: 30_000,
      materialOpenCents: 0,
      workOrderLinkedOpenCents: 0,
    },
    operatingBalanceCents: 10_000,
    reserveTargetCents: 50_000,
    stripeEstimateUpcomingTransferCents: 5_000,
    overdueVendorLabels: ["Acme Supply"],
  })
  assert.ok(i.some((x) => x.code === "ap_exceeds_operating_runway"))
  assert.ok(i.some((x) => x.code === "vendor_frequently_overdue"))
}

function testOrgApiGates() {
  const getList = read("app/api/organizations/[organizationId]/blitzpay/vendor-payables/route.ts")
  assert.match(getList, /requireAnyOrgPermission/)
  assert.match(getList, /requireOrgPermission/)
  const patch = read("app/api/organizations/[organizationId]/blitzpay/vendor-payables/[payableId]/route.ts")
  assert.match(patch, /requireOrgPermission/)
  const dash = read("app/api/organizations/[organizationId]/blitzpay/ap-dashboard/route.ts")
  assert.match(dash, /fetchBlitzpayApDashboard/)
}

function testReportingWiring() {
  const snap = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(snap, /apOpenOutstandingCents/)
  assert.match(snap, /fetchApReportingExtras/)
  const status = read("app/api/organizations/[organizationId]/blitzpay/status/route.ts")
  assert.match(status, /apProjectedOutgoingCents7d/)
}

function testPlatformRollup() {
  const ri = read("lib/blitzpay/blitzpay-revenue-intelligence.ts")
  assert.match(ri, /apOpenPayablesOrgsApprox/)
}

function testWorkOrderSummaryWiring() {
  const wo = read("lib/blitzpay/work-order-blitzpay-summary.ts")
  assert.match(wo, /vendorPayablesField/)
  assert.match(wo, /fetchWorkOrderVendorPayablesSlice/)
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
    assert.doesNotMatch(s, /blitzpay\/vendor-payables/, `${f} must not reference vendor-payables API`)
    assert.doesNotMatch(s, /blitzpay\/ap-dashboard/, `${f} must not reference ap-dashboard API`)
  }
}

function testMigrationMarker() {
  const m = read("supabase/migrations/20260925120000_blitzpay_phase_2s_vendor_payables.sql")
  assert.match(m, /blitzpay_vendor_payables/)
  assert.match(m, /blitzpay_vendor_payouts/)
}

function main() {
  testApBuckets()
  testProjectedOutgoing()
  testReserveStress()
  testVendorVelocity()
  testLifecycleTransitions()
  testInsightsSmoke()
  testOrgApiGates()
  testReportingWiring()
  testPlatformRollup()
  testWorkOrderSummaryWiring()
  testNoPortalExposure()
  testMigrationMarker()
  console.log("blitzpay-phase-2s tests passed")
}

main()
