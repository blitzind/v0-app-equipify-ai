/**
 * BlitzPay Phase 2Y — payroll accruals, commissions, contractor settlements, revenue share (deterministic).
 * Run: pnpm test:blitzpay-phase-2y
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  calculateHybridCompensation,
  calculateTechnicianCommission,
  calculateWorkOrderRevenueBasis,
  buildCommissionApprovalQueue,
  buildPayrollPeriodSummary,
} from "../lib/blitzpay/blitzpay-payroll-engine"
import { blitzpayRevenueShareLedgerKeyV1, blitzpayWorkOrderCommissionAccrualKeyV1 } from "../lib/blitzpay/idempotency-keys"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigrationAndTableSplit() {
  const p = "supabase/migrations/20260928120000_blitzpay_phase_2y_payroll_and_payouts.sql"
  const s = read(p)
  assert.match(s, /blitzpay_payroll_runs/)
  assert.match(s, /blitzpay_technician_compensation_profiles/)
  assert.match(s, /blitzpay_work_order_commissions/)
  assert.match(s, /blitzpay_contractor_settlements/)
  assert.match(s, /blitzpay_revenue_share_rules/)
  assert.match(s, /blitzpay_revenue_share_ledger/)
  assert.match(s, /Phase 2S/)
  assert.doesNotMatch(s, /create table if not exists public\.blitzpay_vendor_payouts/i)
}

function testEngineMath() {
  const basis = calculateWorkOrderRevenueBasis({
    invoiceGrandTotalCents: 10_000,
    netPaidCents: 2500,
    depositDoubleCountOverlapCents: 0,
  })
  assert.equal(basis, 2500)
  const comm = calculateTechnicianCommission(10_000, {
    compensationType: "commission",
    commissionPercentage: 12.5,
    flatRateCents: 0,
    overtimeMultiplier: 1,
  })
  assert.equal(comm, 1250)
  const hybrid = calculateHybridCompensation({
    regularHours: 10,
    overtimeHours: 2,
    revenueBasisCents: 5000,
    profile: {
      compensationType: "hybrid",
      commissionPercentage: 10,
      flatRateCents: 2000,
      overtimeMultiplier: 1.5,
    },
  })
  assert.equal(hybrid.hourlyPortionCents, 20_000)
  assert.equal(hybrid.overtimePortionCents, 6000)
  assert.equal(hybrid.commissionPortionCents, 500)
}

function testIdempotencyKeys() {
  const org = "11111111-1111-4111-8111-111111111111"
  const a = blitzpayWorkOrderCommissionAccrualKeyV1({
    organizationId: org,
    orgInvoiceId: "22222222-2222-4222-8222-222222222222",
    technicianUserId: "33333333-3333-4333-8333-333333333333",
  })
  const b = blitzpayWorkOrderCommissionAccrualKeyV1({
    organizationId: org,
    orgInvoiceId: "22222222-2222-4222-8222-222222222222",
    technicianUserId: "33333333-3333-4333-8333-333333333333",
  })
  assert.equal(a, b)
  const rs = blitzpayRevenueShareLedgerKeyV1({
    organizationId: org,
    ruleId: "44444444-4444-4444-8444-444444444444",
    sourceType: "invoice",
    sourceId: "55555555-5555-4555-8555-555555555555",
  })
  assert.match(rs, /^blitzpay:revshare:v1:/)
}

function testBoundedCaps() {
  const runs = read("lib/blitzpay/blitzpay-payroll-runs.ts")
  const commCap = Number(runs.match(/PAYROLL_COMMISSION_SCAN_CAP = (\d+)/)?.[1])
  const settleCap = Number(runs.match(/PAYROLL_SETTLEMENT_SCAN_CAP = (\d+)/)?.[1])
  const plat = Number(runs.match(/PLATFORM_PAYROLL_ORG_SAMPLE_CAP = (\d+)/)?.[1])
  assert.ok(commCap > 0 && commCap <= 800)
  assert.ok(settleCap > 0 && settleCap <= 800)
  assert.ok(plat > 0 && plat <= 120)
}

function testNoStripeInClientComponents() {
  for (const f of [
    "components/blitzpay/blitzpay-payroll-dashboard.tsx",
    "components/blitzpay/blitzpay-commission-queue.tsx",
    "components/blitzpay/blitzpay-vendor-payouts-panel.tsx",
    "components/blitzpay/blitzpay-technician-payouts-panel.tsx",
    "components/blitzpay/blitzpay-work-order-payroll-strip.tsx",
  ]) {
    const s = read(f)
    assert.doesNotMatch(s, /pi_[a-zA-Z0-9]+/)
    assert.doesNotMatch(s, /acct_[a-zA-Z0-9]+/)
  }
}

function testOrgApisGated() {
  for (const f of [
    "app/api/organizations/[organizationId]/blitzpay/payroll/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/payroll-runs/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/commissions/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/vendor-payouts/route.ts",
  ]) {
    const s = read(f)
    assert.match(s, /canViewFinancialReports/)
    assert.match(s, /canViewFinancials/)
  }
  const approve = read("app/api/organizations/[organizationId]/blitzpay/payroll-runs/[runId]/approve/route.ts")
  assert.match(approve, /canManageSettings/)
  assert.match(approve, /canViewFinancials/)
}

function testPlatformPayrollRollup() {
  const s = read("app/api/platform/blitzpay/payroll-rollup/route.ts")
  assert.match(s, /isPlatformAdminEmail/)
}

function testServerOnlyIsolation() {
  const engine = read("lib/blitzpay/blitzpay-payroll-engine.ts")
  assert.doesNotMatch(engine, /server-only/)
  const accrual = read("lib/blitzpay/blitzpay-payroll-accrual.ts")
  assert.match(accrual, /server-only/)
}

function testQueueHelpers() {
  const q = buildCommissionApprovalQueue([
    {
      technicianUserId: "u1",
      commissionCents: 1,
      commissionStatus: "pending",
      workOrderId: null,
      orgInvoiceId: "i1",
      revenueBasisCents: 1,
      calculatedAt: "2026-01-02T00:00:00Z",
    },
    {
      technicianUserId: "u2",
      commissionCents: 2,
      commissionStatus: "pending",
      workOrderId: null,
      orgInvoiceId: "i0",
      revenueBasisCents: 2,
      calculatedAt: "2026-01-01T00:00:00Z",
    },
  ])
  assert.equal(q[0]!.orgInvoiceId, "i0")
  const s = buildPayrollPeriodSummary([
    { technicianUserId: "a", commissionCents: 100, commissionStatus: "pending" },
    { technicianUserId: "a", commissionCents: 50, commissionStatus: "paid" },
  ])
  assert.equal(s.totalCommissionPendingCents, 100)
  assert.equal(s.totalCommissionPaidCents, 50)
}

testMigrationAndTableSplit()
testEngineMath()
testIdempotencyKeys()
testBoundedCaps()
testNoStripeInClientComponents()
testOrgApisGated()
testPlatformPayrollRollup()
testServerOnlyIsolation()
testQueueHelpers()

console.log("blitzpay phase 2y tests passed")
