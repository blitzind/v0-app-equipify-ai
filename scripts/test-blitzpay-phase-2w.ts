/**
 * BlitzPay Phase 2W — recurring revenue, membership health, renewal forecasting (deterministic).
 * Run: pnpm test:blitzpay-phase-2w
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { blitzpayAutopayRenewalRetryIdempotencyKeyV1, buildDeterministicAutopayRetryScheduleUtc } from "../lib/blitzpay/blitzpay-recurring-autopay-rules"
import { buildRecurringCollectionsCopilotSlice } from "../lib/blitzpay/blitzpay-recurring-collections-bridge"
import { churnRiskScore0to100, scoreMembershipHealthFromSignals } from "../lib/blitzpay/blitzpay-membership-health"
import {
  countMaintenancePlansDueWithinDays,
  maintenanceIntervalMonthsEquivalent,
  projectedRenewalInflowNextDaysCents,
} from "../lib/blitzpay/blitzpay-renewal-forecast"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testRetryScheduleDeterministic() {
  const t0 = Date.parse("2026-05-01T12:00:00.000Z")
  const a = buildDeterministicAutopayRetryScheduleUtc(t0)
  const b = buildDeterministicAutopayRetryScheduleUtc(t0)
  assert.deepEqual(a, b)
  assert.equal(a.length, 3)
  assert.ok(a[0] > t0)
}

function testIdempotencyKeyStable() {
  const k = blitzpayAutopayRenewalRetryIdempotencyKeyV1("11111111-1111-4111-8111-111111111111", 2)
  assert.match(k, /^blitzpay:schedule_retry:v1:/)
}

function testChurnRiskBounds() {
  const s = churnRiskScore0to100({
    failedScheduledWindowCount: 0,
    failedExposureCents: 0,
    overdueInvoiceCount: 0,
    customersMissingAutopayWithActivePlans: 0,
    expiredContractDataRiskCount: 0,
  })
  assert.ok(s >= 0 && s <= 100)
}

function testMembershipBand() {
  const x = scoreMembershipHealthFromSignals({
    failedScheduledWindowCount: 3,
    overdueOpenInvoiceCountForCohort: 4,
    activeMaintenanceWithoutAutopay: true,
    contractExpiring30d: true,
    financingHeavy: true,
    disputePressure: true,
  })
  assert.ok(["payment_risk", "renewal_risk", "engagement_risk", "at_risk", "stable"].includes(x.band))
}

function testRenewalForecastMath() {
  const n = projectedRenewalInflowNextDaysCents({
    scheduledPendingCents: 10_000,
    installmentDueCents: 5000,
    maintenanceCadenceUpliftCents: 2000,
  })
  assert.equal(n, 17_000)
  assert.equal(maintenanceIntervalMonthsEquivalent("month", 3), 3)
  assert.equal(
    countMaintenancePlansDueWithinDays(
      [
        { status: "active", nextDueYmd: "2026-05-15", isArchived: false },
        { status: "paused", nextDueYmd: "2026-05-10", isArchived: false },
      ],
      "2026-05-10",
      10,
    ),
    1,
  )
}

function testCopilotSlice() {
  const slice = buildRecurringCollectionsCopilotSlice({
    metrics: {
      reportingWindowDays: 30,
      generatedAt: new Date().toISOString(),
      recurringPlannedInflow7dCents: 0,
      recurringPlannedInflow30dCents: 50_000,
      recurringPlannedInflow90dCents: 120_000,
      annualizedRecurringRunRateProxyCents: 600_000,
      recurringMixOfCollectedWindowPct: 12,
      autopayAdoptionPct: 40,
      renewalSuccessProxyPct: 88,
      churnRiskScore0to100: 35,
      failedRenewalExposureCents: 5000,
      maintenanceActiveCount: 2,
      maintenancePausedCount: 0,
      maintenanceExpiredCount: 0,
      maintenanceDueNext30dCount: 1,
      contractActiveCount: 1,
      contractSuspendedCount: 0,
      contractExpiring30dCount: 0,
      expiredContractDataRiskCount: 0,
      customersMissingAutopayWithActivePlans: 1,
      scheduledPendingCount: 2,
      scheduledFailedWindowCount: 0,
      recurringStabilityScore0to100: 72,
      projectedRenewalRevenue90dCents: 80_000,
      serviceAgreementUtilizationPct: 40,
      maintenanceCadenceUpliftCents: 1000,
      treasuryConfidenceNote: "ok",
    },
    overdueCollectibleCents: 100_000,
    reminderEffectivenessRatePct: 60,
  })
  assert.ok(["supportive", "neutral", "pressure"].includes(slice.churnAdjustedForecastSignal))
}

function testOrgRecurringApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/recurring-revenue/route.ts")
  assert.match(src, /canViewFinancialReports/)
  assert.match(src, /fetchBlitzpayRecurringRevenuePulse/)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
}

function testPlatformRecurringRollupGate() {
  const src = read("app/api/platform/blitzpay/recurring-revenue-rollup/route.ts")
  assert.match(src, /isPlatformAdminEmail/)
  assert.match(src, /fetchBlitzpayPlatformRecurringRevenueRollup/)
}

function testPortalIsolation() {
  const bootstrap = read("app/api/portal/bootstrap/route.ts")
  assert.ok(!bootstrap.includes("recurring-revenue"))
}

function testBoundedScans() {
  const billing = read("lib/blitzpay/blitzpay-recurring-billing.ts")
  assert.match(billing, /RECURRING_MAINTENANCE_SCAN_CAP/)
  const cap = Number(billing.match(/export const RECURRING_MAINTENANCE_SCAN_CAP = (\d+)/)?.[1] ?? "0")
  assert.ok(cap > 0 && cap <= 500)
  assert.match(read("lib/blitzpay/blitzpay-platform-recurring-revenue-rollup.ts"), /ORG_SAMPLE_CAP/)
}

function testNoStripeIdStringsInClientPayloadSources() {
  for (const rel of [
    "lib/blitzpay/blitzpay-recurring-billing.ts",
    "lib/blitzpay/blitzpay-recurring-revenue-types.ts",
    "lib/blitzpay/blitzpay-membership-health.ts",
    "lib/blitzpay/blitzpay-renewal-forecast.ts",
  ]) {
    const s = read(rel)
    assert.ok(!s.includes("pi_"), rel)
    assert.ok(!s.includes("sub_"), rel)
  }
}

testRetryScheduleDeterministic()
testIdempotencyKeyStable()
testChurnRiskBounds()
testMembershipBand()
testRenewalForecastMath()
testCopilotSlice()
testOrgRecurringApiGate()
testPlatformRecurringRollupGate()
testPortalIsolation()
testBoundedScans()
testNoStripeIdStringsInClientPayloadSources()

console.log("blitzpay phase 2w tests: OK")
