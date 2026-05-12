/**
 * BlitzPay Phase 3B — AP automation foundations (deterministic helpers + static guards; no DB).
 * Run: pnpm test:blitzpay-phase-3b-ap-automation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { validateBalancedLines } from "../lib/blitzpay/blitzpay-general-ledger"
import {
  assertAllocationIntegrity,
  BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS,
  BLITZPAY_AP_BILL_LIST_CAP,
  buildBillAccrualJournalLines,
  computeApCashOptimizationScore0to100,
  computePayableAgingHealthScore0to100,
  computeTreasuryCoverageForPayablesBps,
  computeVendorConcentrationRisk0to100,
  deriveApprovalRequired,
  sortPaymentAllocationsDeterministic,
} from "../lib/blitzpay/blitzpay-ap-automation"
import { bucketVendorBillAging } from "../lib/blitzpay/blitzpay-vendor-aging"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

// --- Approval threshold ---
assert.equal(deriveApprovalRequired(BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS - 1), false)
assert.equal(deriveApprovalRequired(BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS), true)

// --- Accrual journal (integer cents, balanced) ---
const e1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const e2 = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"
const ap = "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee"
const accrual = buildBillAccrualJournalLines({
  lineExpenses: [
    { expenseAccountId: e2, amountCents: 400, description: "Materials" },
    { expenseAccountId: e1, amountCents: 600, description: "Labor" },
  ],
  accountsPayableAccountId: ap,
})
const accBal = validateBalancedLines(accrual)
assert.equal(accBal.ok, true)
assert.equal(accrual.filter((l) => l.lineType === "credit").length, 1)

// --- Treasury coverage bps ---
assert.equal(computeTreasuryCoverageForPayablesBps(0, 0), 1_000_000)
assert.equal(computeTreasuryCoverageForPayablesBps(50_000, 25_000), 20_000)

// --- Concentration & scores (bounded 0–100) ---
assert.equal(computeVendorConcentrationRisk0to100([30_000, 70_000]), 70)
const agingScore = computePayableAgingHealthScore0to100({
  overdueCents: 0,
  totalOpenCents: 100_000,
  treasuryCoverageBps: 25_000,
})
assert.ok(agingScore >= 0 && agingScore <= 100)
const opt = computeApCashOptimizationScore0to100({
  treasuryCoverageBps: 30_000,
  due7dCents: 10_000,
  operatingCashCents: 100_000,
})
assert.ok(opt >= 0 && opt <= 100)

// --- Vendor aging buckets ---
const buckets = bucketVendorBillAging(
  [
    { remaining_balance_cents: 100, due_date: "2026-05-20" },
    { remaining_balance_cents: 200, due_date: "2026-04-20" },
  ],
  "2026-05-11",
)
assert.equal(buckets.currentDueCents, 100)
assert.ok(buckets.days30Cents >= 200)

// --- Allocation sort & integrity ---
const sortedAllocs = sortPaymentAllocationsDeterministic([
  { vendorBillId: "z", allocatedAmountCents: 50 },
  { vendorBillId: "a", allocatedAmountCents: 100 },
  { vendorBillId: "a", allocatedAmountCents: 50 },
])
assert.deepEqual(
  sortedAllocs.map((x) => x.vendorBillId),
  ["a", "a", "z"],
)
assert.equal(assertAllocationIntegrity(0, 100).ok, false)
assert.equal(assertAllocationIntegrity(101, 100).ok, false)
assert.equal(assertAllocationIntegrity(100, 100).ok, true)

// --- Paid bill immutability (migration) ---
const mig = readUtf8("supabase/migrations/20261012120000_blitzpay_phase_3b_ap_automation.sql")
assert.match(mig, /blitzpay_vendor_bills_paid_immutable/)

// --- API gates (financial staff only; schema guard) ---
for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/ap/vendors/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ap/bills/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ap/payment-runs/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ap/vendor-aging/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ap/ap-health/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ap/bills/[billId]/approve/route.ts",
]) {
  const s = readUtf8(rel)
  assert.match(s, /requireAnyOrgPermission/)
  assert.match(s, /blitzpaySchemaGuardNextResponse/)
}

// --- Bounded list caps ---
assert.ok(BLITZPAY_AP_BILL_LIST_CAP > 0 && BLITZPAY_AP_BILL_LIST_CAP < 10_000)

// --- Schema health: Phase 3B tables ---
const schemaHealth = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
for (const t of [
  "blitzpay_vendors",
  "blitzpay_vendor_bills",
  "blitzpay_vendor_bill_lines",
  "blitzpay_ap_payment_runs",
  "blitzpay_ap_payment_allocations",
  "blitzpay_ap_approval_flows",
  "blitzpay_vendor_aging_snapshots",
  "blitzpay_ap_audit_events",
]) {
  assert.ok(schemaHealth.includes(`"${t}"`), `schema health lists ${t}`)
}

// --- Default vendor COA extension present ---
const gl = readUtf8("lib/blitzpay/blitzpay-general-ledger.ts")
assert.ok(gl.includes("BLITZPAY_VENDOR_COA_EXTENSION") && gl.includes("5300"))

console.log("blitzpay phase 3b ap automation tests passed")
