/**
 * BlitzPay Phase 2V — collections copilot (deterministic), platform rollup, API gates, portal isolation.
 * Run: pnpm test:blitzpay-phase-2v
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import { fileURLToPath } from "node:url"

import { buildCollectionsPriorityQueue, type PriorityInvoiceInput } from "../lib/blitzpay/blitzpay-collections-priority"
import { buildCollectionsPlaybook } from "../lib/blitzpay/blitzpay-collections-playbooks"
import { blitzpayOverdueRecoveryMultiplier } from "../lib/blitzpay/blitzpay-revenue-forecast-math"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testPriorityOrderingDeterministic() {
  const rows: PriorityInvoiceInput[] = [
    {
      invoiceId: "a",
      customerId: "c1",
      balanceDueCents: 10_000,
      daysPastDue: 5,
      hasActiveInstallment: false,
      hasScheduledPayment: false,
      abandonedCheckout: false,
      walletCreditAvailableCents: 0,
      customerLateRatePct: 10,
      customerAvgDaysToPayWhenPaid: 8,
      workOrderScheduledWithin14d: false,
      workOrderCompletedWithin30d: true,
      reminderDispatchesLast30d: 0,
      hasTechnicianOnWorkOrder: true,
      achHeavyCustomer: false,
    },
    {
      invoiceId: "b",
      customerId: "c2",
      balanceDueCents: 50_000,
      daysPastDue: 20,
      hasActiveInstallment: false,
      hasScheduledPayment: false,
      abandonedCheckout: true,
      walletCreditAvailableCents: 0,
      customerLateRatePct: 50,
      customerAvgDaysToPayWhenPaid: null,
      workOrderScheduledWithin14d: false,
      workOrderCompletedWithin30d: false,
      reminderDispatchesLast30d: 6,
      hasTechnicianOnWorkOrder: false,
      achHeavyCustomer: false,
    },
  ]
  const q1 = buildCollectionsPriorityQueue(rows)
  const q2 = buildCollectionsPriorityQueue(rows)
  assert.deepEqual(
    q1.map((x) => x.invoiceId),
    q2.map((x) => x.invoiceId),
  )
  assert.equal(q1[0].invoiceId, "b")
}

function testPlaybookDeterministic() {
  const a = buildCollectionsPlaybook({
    balanceDueCents: 80_000,
    daysPastDue: 10,
    hasActiveInstallment: false,
    hasScheduledPayment: true,
    abandonedCheckout: true,
    walletCreditAvailableCents: 0,
    customerLateRatePct: 20,
    customerAvgDaysToPayWhenPaid: 5,
    workOrderScheduledWithin14d: false,
    workOrderCompletedWithin30d: false,
    reminderDispatchesLast30d: 0,
    hasTechnicianOnWorkOrder: false,
    achHeavyCustomer: false,
  })
  assert.match(a.recommendedAction, /Pause reminders/i)
}

function testRecoveryMultiplierBounds() {
  assert.equal(blitzpayOverdueRecoveryMultiplier(0), 0.05)
  assert.ok(blitzpayOverdueRecoveryMultiplier(100) <= 0.35)
}

function testOrgCollectionsCopilotApiGate() {
  const src = read("app/api/organizations/[organizationId]/blitzpay/collections-copilot/route.ts")
  assert.match(src, /canViewFinancialReports/)
  assert.match(src, /fetchBlitzpayCollectionsCopilot/)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
}

function testPlatformCollectionsRollupGate() {
  const src = read("app/api/platform/blitzpay/collections-rollup/route.ts")
  assert.match(src, /isPlatformAdminEmail/)
  assert.match(src, /fetchBlitzpayPlatformCollectionsRollup/)
}

function testBoundedScans() {
  assert.match(read("lib/blitzpay/blitzpay-collections-copilot.ts"), /PRIORITY_SCAN/)
  assert.match(read("lib/blitzpay/blitzpay-collections-acceleration-metrics.ts"), /OVERDUE_INVOICE_CAP/)
  assert.match(read("lib/blitzpay/blitzpay-platform-collections-rollup.ts"), /ORG_SAMPLE_CAP/)
}

function testPortalIsolation() {
  const bootstrap = read("app/api/portal/bootstrap/route.ts")
  assert.ok(!bootstrap.includes("collections-copilot"))
}

function testNoRawStripeIdsInPhase2vLibs() {
  for (const rel of [
    "lib/blitzpay/blitzpay-collections-copilot.ts",
    "lib/blitzpay/blitzpay-collections-priority.ts",
    "lib/blitzpay/blitzpay-collections-playbooks.ts",
    "lib/blitzpay/blitzpay-collections-automation-insights.ts",
    "lib/blitzpay/blitzpay-collections-acceleration-metrics.ts",
    "lib/blitzpay/blitzpay-platform-collections-rollup.ts",
  ]) {
    const s = read(rel)
    assert.doesNotMatch(s, /\bpi_[A-Za-z0-9]+\b/, rel)
    assert.doesNotMatch(s, /\bpo_[A-Za-z0-9]+\b/, rel)
  }
}

function main() {
  testPriorityOrderingDeterministic()
  testPlaybookDeterministic()
  testRecoveryMultiplierBounds()
  testOrgCollectionsCopilotApiGate()
  testPlatformCollectionsRollupGate()
  testBoundedScans()
  testPortalIsolation()
  testNoRawStripeIdsInPhase2vLibs()
  console.info("blitzpay phase 2v tests: OK")
}

main()
