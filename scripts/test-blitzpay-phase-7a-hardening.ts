/**
 * BlitzPay Phase 7A — production hardening foundations (deterministic helpers + guardrails).
 * Run: pnpm test:blitzpay-phase-7a-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  blitzpayModuleWouldBeGatedAtTier,
  isBlitzpayModuleEnabledForTier,
  normalizeCommercialProductTier,
} from "../lib/billing/blitzpay-entitlements"
import { orderBlitzpayFinancialEventIdsForReplay } from "../lib/blitzpay/blitzpay-event-sourcing"
import { computeBlitzpayOperationalReadinessStrip } from "../lib/blitzpay/blitzpay-operational-readiness"
import {
  BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH,
  resolveBlitzpayReportingSnapshotNestedSkipState,
} from "../lib/blitzpay/blitzpay-reporting-snapshot-nesting"
import {
  blitzpayConnectWebhookReadinessNotes,
  scanJsonForStripeLikeTokens,
} from "../lib/blitzpay/blitzpay-stripe-readiness-guards"
import { validateBlitzpayWorkflowReplayAuthorization } from "../lib/blitzpay/blitzpay-workflow-orchestration"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

async function main(): Promise<void> {
  assert.equal(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH, 3)

  const nominal = resolveBlitzpayReportingSnapshotNestedSkipState({
    nestingDepth: 1,
    skipMultiEntity: false,
    skipSupplierNetwork: false,
    skipClaimsWarranty: false,
    skipMobilePhase6a: false,
    skipObservabilityPhase6b: false,
  })
  assert.equal(nominal.atDepthCap, false)
  assert.equal(nominal.skipMultiEntity, false)

  const capped = resolveBlitzpayReportingSnapshotNestedSkipState({
    nestingDepth: 3,
    skipMultiEntity: false,
    skipSupplierNetwork: false,
    skipClaimsWarranty: false,
    skipMobilePhase6a: false,
    skipObservabilityPhase6b: false,
  })
  assert.equal(capped.atDepthCap, true)
  assert.equal(capped.skipMultiEntity, true)
  assert.equal(capped.skipSupplierNetwork, true)
  assert.equal(capped.skipClaimsWarranty, true)
  assert.equal(capped.skipMobilePhase6a, true)
  assert.equal(capped.skipObservabilityPhase6b, true)

  assert.equal(isBlitzpayModuleEnabledForTier("solo", "ai_copilot"), true)
  assert.equal(isBlitzpayModuleEnabledForTier(null, "financial_command_center"), true)
  assert.equal(blitzpayModuleWouldBeGatedAtTier("solo", "ai_copilot"), true)
  assert.equal(blitzpayModuleWouldBeGatedAtTier("growth", "ai_copilot"), false)
  assert.equal(normalizeCommercialProductTier("enterprise"), "enterprise")
  assert.equal(normalizeCommercialProductTier("growth"), "growth")

  assert.deepEqual(scanJsonForStripeLikeTokens({ ok: true, nested: ["no ids here"] }), [])
  const leaks = scanJsonForStripeLikeTokens({ acct: "acct_1AbCdEfGhIjKlMn", pi: "pi_1234567890ABCDEF" })
  assert.ok(leaks.length >= 1)

  assert.ok(blitzpayConnectWebhookReadinessNotes().length >= 3)

  assert.deepEqual(orderBlitzpayFinancialEventIdsForReplay(["z", "a", "m"]), ["a", "m", "z"])

  assert.deepEqual(validateBlitzpayWorkflowReplayAuthorization({ orgMemberRole: "tech", userEmail: "x@y.com" }), {
    ok: false,
    code: "forbidden",
  })
  assert.deepEqual(validateBlitzpayWorkflowReplayAuthorization({ orgMemberRole: "owner", userEmail: "x@y.com" }), {
    ok: true,
  })

  const strip = computeBlitzpayOperationalReadinessStrip({
    reportingForcedSkips: false,
    trialBalanceHealthy: true,
    stripePayoutsEnabled: true,
    mobileSyncFailureRate: 0.02,
    mobileTreasuryVisibilityScore: 70,
    mobileSignatureCoverageRate: 80,
    observabilityCoverageRate: 0.75,
    queueHealthScore: 90,
    workflowFailureRate: 0.01,
    replayIntegrityScore: 85,
  })
  assert.equal(strip.reportingSnapshotRecursionGuard, "nominal")
  assert.ok(strip.overallComfort0to100 >= 0 && strip.overallComfort0to100 <= 100)
  assert.ok(strip.checklistLines.length >= 2)
  assert.ok(strip.checklistLines[0]!.includes(String(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH)))

  const stripCapped = computeBlitzpayOperationalReadinessStrip({
    reportingForcedSkips: true,
    trialBalanceHealthy: false,
    stripePayoutsEnabled: false,
    mobileSyncFailureRate: 0.5,
    mobileTreasuryVisibilityScore: 10,
    mobileSignatureCoverageRate: 10,
    observabilityCoverageRate: 0,
    queueHealthScore: 40,
    workflowFailureRate: 0.2,
    replayIntegrityScore: 0,
  })
  assert.equal(stripCapped.reportingSnapshotRecursionGuard, "depth_capped")

  const replayRoute = fs.readFileSync(
    path.join(APP_ROOT, "app/api/organizations/[organizationId]/blitzpay/observability/workflows/[workflowId]/replay/route.ts"),
    "utf8",
  )
  assert.match(replayRoute, /validateBlitzpayWorkflowReplayAuthorization/)
  assert.match(replayRoute, /requireAnyOrgPermission/)

  const schemaHealthScript = path.join(APP_ROOT, "scripts/test-blitzpay-schema-health.ts")
  assert.ok(fs.existsSync(schemaHealthScript), "schema health script present")

  // eslint-disable-next-line no-console
  console.log("blitzpay phase 7a hardening checks ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
