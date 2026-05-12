/**
 * BlitzPay Phase 3B — collections engine, deterministic retries, recovery flows (orchestration only).
 * Run: pnpm test:blitzpay-phase-3b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  BLITZPAY_COLLECTION_STATE_LIST_CAP,
  buildDeterministicRetryTimeline,
  computeEscalationLevel,
  computeNextRetryAtFromFirstFailure,
  computeRetryEligibility,
  deriveCollectionStatusFromInvoice,
  MAX_DETERMINISTIC_RETRY_SLOTS,
  MAX_PAYMENT_ATTEMPT_COUNT,
  phase3bReportingMetrics,
  RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE,
  retryScheduleExhausted,
} from "../lib/blitzpay/blitzpay-collections-engine"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigration() {
  const p = "supabase/migrations/20261002120000_blitzpay_phase_3b_collections_engine.sql"
  const s = read(p)
  assert.match(s, /blitzpay_invoice_collection_states/)
  assert.match(s, /blitzpay_collection_attempts/)
  assert.match(s, /blitzpay_collection_recovery_flows/)
  assert.match(s, /blitzpay_collection_activity_log/)
  assert.match(s, /is_org_member/)
}

function testRetrySchedule() {
  const t0 = "2026-01-01T12:00:00.000Z"
  const n0 = computeNextRetryAtFromFirstFailure(t0, 0)
  assert.ok(n0 && n0.length > 10)
  assert.equal(computeNextRetryAtFromFirstFailure(t0, MAX_DETERMINISTIC_RETRY_SLOTS), null)
  assert.equal(retryScheduleExhausted(MAX_DETERMINISTIC_RETRY_SLOTS), true)
  assert.equal(RETRY_DAY_OFFSETS_FROM_FIRST_FAILURE.length, 4)
}

function testRetryCaps() {
  const e = computeRetryEligibility({
    recoveryPaused: false,
    collectionStatus: "current",
    failedAttemptCount: MAX_DETERMINISTIC_RETRY_SLOTS,
    paymentAttemptCount: 0,
  })
  assert.equal(e.eligible, false)
  const e2 = computeRetryEligibility({
    recoveryPaused: false,
    collectionStatus: "current",
    failedAttemptCount: 0,
    paymentAttemptCount: MAX_PAYMENT_ATTEMPT_COUNT,
  })
  assert.equal(e2.eligible, false)
}

function testEscalation() {
  assert.equal(computeEscalationLevel(0), 0)
  assert.ok(computeEscalationLevel(5) >= 3)
}

function testDeriveStatus() {
  const d = deriveCollectionStatusFromInvoice({
    invoiceStatus: "paid",
    paidAt: "2026-02-01",
    dueDate: null,
    todayIsoDate: "2026-02-10",
    partialPaidCents: 0,
    invoiceAmountCents: 1000,
    recoveryPaused: false,
    failedAttemptCount: 0,
    nextRetryAt: null,
  })
  assert.equal(d, "resolved")
}

function testReportingMetrics() {
  const m = phase3bReportingMetrics({
    collectionStates: [
      { collection_status: "resolved", failed_attempt_count: 1 },
      { collection_status: "failed", failed_attempt_count: 2 },
    ],
    recoveryFlows: [{ flow_status: "completed", resolved_at: "2026-02-10T00:00:00Z", created_at: "2026-02-01T00:00:00Z" }],
  })
  assert.ok(m.collectionSuccessRate >= 0 && m.collectionSuccessRate <= 100)
  assert.ok(m.averageRecoveryDurationDays >= 0)
}

function testTimeline() {
  const tl = buildDeterministicRetryTimeline("2026-01-01T00:00:00.000Z")
  assert.ok(tl.length >= 4)
}

function testOrgApisGated() {
  for (const f of [
    "app/api/organizations/[organizationId]/blitzpay/collections/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/collections/attempts/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/collections/recovery-flows/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/collections/retry/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/collections/pause/route.ts",
  ]) {
    const s = read(f)
    assert.match(s, /requireAnyOrgPermission/)
    assert.match(s, /blitzpaySchemaGuardNextResponse/)
  }
}

function testServiceBounded() {
  const svc = read("lib/blitzpay/blitzpay-collections-service.ts")
  assert.match(svc, /\.limit\(BLITZPAY_COLLECTION_STATE_LIST_CAP\)/)
  assert.match(svc, /BLITZPAY_PHASE_3B_REPORTING_SCAN_CAP/)
}

function testNoStripeInPortalBilling() {
  const inv = read("app/api/portal/billing/invoices/route.ts")
  assert.doesNotMatch(inv, /stripe_payment_intent_id/)
  const ps = read("app/api/portal/billing/payment-status/route.ts")
  assert.doesNotMatch(ps, /escalation_level/)
}

function testPortalIsolationPaths() {
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/portal/blitzpay/collections")), false)
}

function testSchemaHealth() {
  const s = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(s, /blitzpay_invoice_collection_states/)
  assert.match(s, /blitzpay_collection_activity_log/)
}

function testReportingSnapshot() {
  const s = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(s, /collectionSuccessRate/)
  assert.match(s, /averageRecoveryDurationDays/)
}

function testStaffPanelNoRawStripe() {
  const s = read("components/blitzpay/blitzpay-collections-engine-panel.tsx")
  assert.doesNotMatch(s, /\bpm_[A-Za-z0-9]+\b/)
}

function testCapsConstant() {
  assert.ok(BLITZPAY_COLLECTION_STATE_LIST_CAP > 0 && BLITZPAY_COLLECTION_STATE_LIST_CAP <= 200)
}

function main() {
  testMigration()
  testRetrySchedule()
  testRetryCaps()
  testEscalation()
  testDeriveStatus()
  testReportingMetrics()
  testTimeline()
  testOrgApisGated()
  testServiceBounded()
  testNoStripeInPortalBilling()
  testPortalIsolationPaths()
  testSchemaHealth()
  testReportingSnapshot()
  testStaffPanelNoRawStripe()
  testCapsConstant()
  console.log("blitzpay phase 3b tests passed")
}

main()
