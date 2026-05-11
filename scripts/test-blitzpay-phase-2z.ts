/**
 * BlitzPay Phase 2Z — internal cash planning, reserve rules, runway (deterministic).
 * Run: pnpm test:blitzpay-phase-2z
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  allocateCollectionsToCashAccounts,
  buildCashRunwaySnapshot,
  calculateReserveTargets,
  deriveBlitzpayCashPlanningMetrics,
  estimateOperatingBalance,
  releaseCashAccountAllocation,
} from "../lib/blitzpay/blitzpay-cash-accounts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigration() {
  const p = "supabase/migrations/20260929120000_blitzpay_phase_2z_cash_accounts.sql"
  const s = read(p)
  assert.match(s, /blitzpay_cash_accounts/)
  assert.match(s, /blitzpay_cash_account_allocations/)
  assert.match(s, /blitzpay_cash_reserve_rules/)
  assert.match(s, /blitzpay_cash_runway_snapshots/)
  assert.match(s, /is_org_member/)
}

function testPureMath() {
  const op = estimateOperatingBalance({
    treasuryOperatingCents: 100_000,
    pendingPayoutTotalCents: 20_000,
    walletSpendableLiabilityCents: 30_000,
    unappliedEstimateDepositCents: 10_000,
    walletDepositOverlapCents: 10_000,
  })
  assert.equal(op, 70_000)

  const rules = calculateReserveTargets(
    [
      {
        ruleType: "percent_of_collections",
        basisPoints: 1000,
        fixedAmountCents: null,
        active: true,
      },
    ],
    {
      netCollectedWindowCents: 200_000,
      payrollLiabilityCents: 50_000,
      apOpenOutstandingCents: 40_000,
      disputeExposureCents: 10_000,
    },
  )
  assert.equal(rules.totalReserveTargetCents, 20_000)

  const alloc = allocateCollectionsToCashAccounts(10_000, [
    { accountType: "operating", weightBps: 7000 },
    { accountType: "reserve", weightBps: 3000 },
  ])
  assert.equal((alloc.operating ?? 0) + (alloc.reserve ?? 0), 10_000)

  const released = releaseCashAccountAllocation({ allocation_status: "confirmed" } as const)
  assert.equal(released.allocation_status, "released")

  const runway = buildCashRunwaySnapshot({
    estimatedOperatingCashCents: 5_000,
    expectedInflows7dCents: 1_000,
    expectedInflows30dCents: 10_000,
    expectedOutflows7dCents: 20_000,
    expectedOutflows30dCents: 30_000,
    reserveTargetCents: 50_000,
  })
  assert.equal(runway.runwayStatus, "risk")
}

function testNoDoubleCountWalletDeposit() {
  const overlap = Math.min(25_000, 25_000)
  const a = estimateOperatingBalance({
    treasuryOperatingCents: 100_000,
    pendingPayoutTotalCents: 0,
    walletSpendableLiabilityCents: 25_000,
    unappliedEstimateDepositCents: 25_000,
    walletDepositOverlapCents: overlap,
  })
  const b = estimateOperatingBalance({
    treasuryOperatingCents: 100_000,
    pendingPayoutTotalCents: 0,
    walletSpendableLiabilityCents: 25_000,
    unappliedEstimateDepositCents: 25_000,
    walletDepositOverlapCents: 0,
  })
  assert.ok(a >= b)
}

function testDerivePipeline() {
  const d = deriveBlitzpayCashPlanningMetrics({
    treasuryOperatingCents: 80_000,
    heldReserveCents: 20_000,
    reserveTargetFromSettingsCents: 50_000,
    pendingPayoutTotalCents: 10_000,
    walletSpendableLiabilityCents: 0,
    unappliedEstimateDepositCents: 0,
    walletDepositOverlapCents: 0,
    netCollectedWindowCents: 100_000,
    payrollLiabilityCents: 15_000,
    apOpenOutstandingCents: 25_000,
    disputeExposureCents: 5_000,
    reserveRules: [],
    apDue7OpenCents: 5_000,
    apDue30OpenCents: 15_000,
    treasuryPendingPayoutTotalsCents: 10_000,
    treasuryEstimateUpcomingTransferCents: 8_000,
    recurringPlannedInflow30dCents: 12_000,
  })
  assert.ok(d.estimatedOperatingCashCents >= 0)
  assert.ok(["healthy", "watch", "risk"].includes(d.cashRunwayStatus))
}

function testBoundedCaps() {
  const svc = read("lib/blitzpay/blitzpay-cash-accounts-service.ts")
  const plat = read("lib/blitzpay/blitzpay-platform-cash-accounts-rollup.ts")
  const row = Number(svc.match(/CASH_ACCOUNTS_ROW_CAP = (\d+)/)?.[1])
  const rules = Number(svc.match(/CASH_RESERVE_RULES_CAP = (\d+)/)?.[1])
  const alloc = Number(svc.match(/CASH_ALLOCATIONS_SCAN_CAP = (\d+)/)?.[1])
  const sample = Number(svc.match(/PLATFORM_CASH_ORG_SAMPLE_CAP = (\d+)/)?.[1])
  assert.ok(row > 0 && row <= 120)
  assert.ok(rules > 0 && rules <= 120)
  assert.ok(alloc > 0 && alloc <= 500)
  assert.ok(sample > 0 && sample <= 120)
  assert.match(plat, /PLATFORM_CASH_ORG_SAMPLE_CAP/)
}

function testOrgApisGated() {
  for (const f of [
    "app/api/organizations/[organizationId]/blitzpay/cash-accounts/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/cash-runway/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/cash-reserve-rules/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/cash-reserve-rules/[ruleId]/route.ts",
  ]) {
    const s = read(f)
    assert.match(s, /requireAnyOrgPermission|requireOrgPermission/)
    assert.match(s, /blitzpaySchemaGuardNextResponse/)
  }
}

function testPlatformRollupAuth() {
  const s = read("app/api/platform/blitzpay/cash-accounts-rollup/route.ts")
  assert.match(s, /isPlatformAdminEmail/)
}

function testNoStripeInClientPanel() {
  const s = read("components/blitzpay/blitzpay-cash-accounts-panel.tsx")
  assert.doesNotMatch(s, /pi_[a-zA-Z0-9]+/)
  assert.doesNotMatch(s, /acct_[a-zA-Z0-9]+/)
}

function testPortalExclusion() {
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/portal/blitzpay/cash-accounts")), false)
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/portal/blitzpay/cash-runway")), false)
}

function testSchemaHealthTables() {
  const s = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(s, /blitzpay_cash_accounts/)
  assert.match(s, /blitzpay_cash_reserve_rules/)
}

function testReportingSnapshotFields() {
  const s = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(s, /estimatedOperatingCashCents/)
  assert.match(s, /cashRunwayStatus/)
}

function main() {
  testMigration()
  testPureMath()
  testNoDoubleCountWalletDeposit()
  testDerivePipeline()
  testBoundedCaps()
  testOrgApisGated()
  testPlatformRollupAuth()
  testNoStripeInClientPanel()
  testPortalExclusion()
  testSchemaHealthTables()
  testReportingSnapshotFields()
  console.log("blitzpay phase 2z tests passed")
}

main()
