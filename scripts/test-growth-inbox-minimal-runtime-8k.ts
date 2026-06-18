/**
 * Phase 8K — Inbox minimal runtime enforcement + Tier 3 on-demand verification.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-inbox-minimal-runtime-8k.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { classifyGrowthInboxFetchRoute } from "../lib/growth/inbox/growth-inbox-fetch-route-classifier"
import {
  auditGrowthInboxFetch,
  markGrowthInboxExplicitOperatorAction,
  markGrowthInboxInitialLoadComplete,
  markGrowthInboxThreadSelected,
  resetGrowthInboxFetchAuditLifecycle,
} from "../lib/growth/inbox/growth-inbox-fetch-audit"
import {
  getGrowthInboxMinimalRuntimeMetrics,
  resetGrowthInboxMinimalRuntimeMetrics,
} from "../lib/growth/inbox/growth-inbox-minimal-runtime-metrics"
import { summarizeGrowthInboxMinimalRuntimeDiagnostics } from "../lib/growth/inbox/growth-inbox-minimal-runtime-diagnostics"
import {
  buildGrowthOnDemandCacheKey,
  isGrowthOnDemandCacheLoaded,
  resetGrowthOnDemandFeatureCache,
  writeGrowthOnDemandCacheEntry,
} from "../lib/growth/runtime/growth-on-demand-feature-cache"
import { isGrowthFeatureApiEnabled } from "../lib/growth/runtime/growth-feature-helpers"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function withProfile(profile: "operator_minimal" | "full_admin") {
  const previous = process.env.GROWTH_RUNTIME_PROFILE
  process.env.GROWTH_RUNTIME_PROFILE = profile
  return () => {
    if (previous === undefined) delete process.env.GROWTH_RUNTIME_PROFILE
    else process.env.GROWTH_RUNTIME_PROFILE = previous
  }
}

function runFetchAudit(): void {
  console.log("\n=== Phase 8K fetch audit ===\n")

  resetGrowthInboxMinimalRuntimeMetrics()
  resetGrowthInboxFetchAuditLifecycle()
  resetGrowthOnDemandFeatureCache()

  const restoreMinimal = withProfile("operator_minimal")
  markGrowthInboxInitialLoadComplete()

  auditGrowthInboxFetch("/api/platform/growth/inbox")
  auditGrowthInboxFetch("/api/platform/growth/revenue-execution/forecast-evidence?leadId=x")
  let metrics = getGrowthInboxMinimalRuntimeMetrics()
  assert.equal(metrics.allowedInitialRequests, 1)
  assert.equal(metrics.flaggedTier3EagerRequests, 1)

  markGrowthInboxThreadSelected()
  auditGrowthInboxFetch("/api/platform/growth/leads/abc")
  auditGrowthInboxFetch("/api/platform/growth/opportunities/dashboard?leadId=abc")
  metrics = getGrowthInboxMinimalRuntimeMetrics()
  assert.equal(metrics.allowedSelectedThreadRequests, 1)
  assert.equal(metrics.flaggedTier3EagerRequests, 2)

  markGrowthInboxExplicitOperatorAction()
  auditGrowthInboxFetch("/api/platform/growth/opportunities/dashboard?leadId=abc")
  metrics = getGrowthInboxMinimalRuntimeMetrics()
  assert.equal(metrics.flaggedTier3EagerRequests, 2)

  auditGrowthInboxFetch("/api/platform/growth/inbox/sync/dashboard")
  metrics = getGrowthInboxMinimalRuntimeMetrics()
  assert.equal(metrics.tier2SoftDisabledRequests, 1)

  restoreMinimal()

  const restoreAdmin = withProfile("full_admin")
  resetGrowthInboxMinimalRuntimeMetrics()
  auditGrowthInboxFetch("/api/platform/growth/revenue-execution/forecast-evidence")
  metrics = getGrowthInboxMinimalRuntimeMetrics()
  assert.equal(metrics.flaggedTier3EagerRequests, 0)
  restoreAdmin()
  console.log("  ✓ fetch audit classifies initial, thread, Tier 3, Tier 2")
}

function runRouteClassifier(): void {
  console.log("\n=== Phase 8K route classifier ===\n")

  const forecast = classifyGrowthInboxFetchRoute("/api/platform/growth/revenue-execution/forecast-evidence?leadId=1")
  assert.equal(forecast?.tier, 3)
  assert.equal(forecast?.feature, "forecastEvidence")
  assert.equal(forecast?.isTier3OnDemand, true)

  const inbox = classifyGrowthInboxFetchRoute("/api/platform/growth/inbox")
  assert.equal(inbox?.isInitialAllowed, true)

  const workflow = classifyGrowthInboxFetchRoute("/api/platform/growth/replies/workflow-actions?leadId=1")
  assert.equal(workflow?.isSelectedThreadAllowed, true)
  console.log("  ✓ route classifier maps Tier 3 features")
}

function runOnDemandCache(): void {
  console.log("\n=== Phase 8K on-demand cache ===\n")

  resetGrowthOnDemandFeatureCache()
  const key = buildGrowthOnDemandCacheKey("forecastEvidence", "lead-1")
  assert.equal(isGrowthOnDemandCacheLoaded(key), false)
  writeGrowthOnDemandCacheEntry(key, { status: "loaded", error: null, loadedAt: Date.now() })
  assert.equal(isGrowthOnDemandCacheLoaded(key), true)

  const key2 = buildGrowthOnDemandCacheKey("forecastEvidence", "lead-2")
  assert.equal(isGrowthOnDemandCacheLoaded(key2), false)
  console.log("  ✓ cache keyed by feature + scope; reopen avoids re-fetch via hook")
}

function runDiagnostics(): void {
  console.log("\n=== Phase 8K diagnostics ===\n")

  const restoreMinimal = withProfile("operator_minimal")
  const summary = summarizeGrowthInboxMinimalRuntimeDiagnostics()
  assert.equal(summary.minimalRuntimeActive, true)
  assert.ok(summary.metrics.allowedInitialRequests >= 0)
  assert.ok(summary.allowlists.initial.length === 4)
  restoreMinimal()

  const routeSource = readSource("app/api/platform/growth/inbox/runtime-diagnostics/route.ts")
  assert.match(routeSource, /summarizeGrowthColdStorageRuntime/)
  assert.doesNotMatch(routeSource, /fetchInboxDashboard/)
  console.log("  ✓ diagnostics helper + lightweight runtime-diagnostics route")
}

function runSourceWiring(): void {
  console.log("\n=== Phase 8K source wiring ===\n")

  assert.match(readSource("lib/growth/platform-growth-client-fetch.ts"), /auditGrowthInboxFetch/)
  assert.match(readSource("lib/growth/runtime/use-growth-on-demand-feature.ts"), /recordGrowthInboxTier3CacheHit/)
  assert.match(readSource("components/growth/runtime/growth-on-demand-feature.tsx"), /Load intelligence/)
  assert.match(readSource("components/growth/inbox/growth-inbox-inline-revenue-context.tsx"), /GrowthOnDemandFeature/)
  assert.match(readSource("components/growth/inbox/growth-inbox-action-center-workflow-embeds.tsx"), /revenueCommandCenter/)
  assert.match(readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx"), /smartFollowUpPolicies/)
  assert.match(readSource("components/growth/inbox/growth-inbox-recommended-action-card.tsx"), /GROWTH_ON_DEMAND_DEFERRED_COPY/)
  assert.match(readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx"), /markGrowthInboxInitialLoadComplete/)
  assert.match(readSource("components/growth/inbox/growth-inbox-lead-context-provider.tsx"), /markGrowthInboxThreadSelected/)
  console.log("  ✓ audit, on-demand wrapper, and Tier 3 surfaces wired")
}

function runProfileBehavior(): void {
  console.log("\n=== Phase 8K profile behavior ===\n")

  const restoreMinimal = withProfile("operator_minimal")
  assert.equal(isGrowthFeatureApiEnabled("realtimeEventBus"), false)
  assert.equal(isGrowthFeatureApiEnabled("forecastEvidence"), true)
  restoreMinimal()

  const restoreAdmin = withProfile("full_admin")
  assert.equal(isGrowthFeatureApiEnabled("realtimeEventBus"), true)
  restoreAdmin()
  console.log("  ✓ Tier 1/Tier 3 APIs active; Tier 2 event bus cold only in operator_minimal")
}

function main(): void {
  console.log("Phase 8K — Inbox minimal runtime enforcement verification")
  runFetchAudit()
  runRouteClassifier()
  runOnDemandCache()
  runDiagnostics()
  runSourceWiring()
  runProfileBehavior()
  console.log("\n✅ Phase 8K verification passed\n")
}

main()
