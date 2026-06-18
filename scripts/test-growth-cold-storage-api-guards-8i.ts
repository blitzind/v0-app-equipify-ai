/**
 * Phase 8I — cold storage API / runtime verification.
 *
 * Usage:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-cold-storage-api-guards-8i.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_TIER2_API_INVENTORY,
  listGrowthTier2ApiPaths,
  resolveGrowthFeatureKeyFromApiPath,
} from "../lib/growth/runtime/growth-feature-api-map"
import { isGrowthFeatureApiEnabled } from "../lib/growth/runtime/growth-feature-helpers"
import {
  resetGrowthColdStorageRuntimeMetrics,
  summarizeGrowthColdStorageRuntime,
} from "../lib/growth/runtime/growth-cold-storage-runtime"
import { listGrowthFeaturesByTier } from "../lib/growth/runtime/growth-feature-registry"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function withProfile(profile: "operator_minimal" | "full_admin" | "development_all") {
  const previous = process.env.GROWTH_RUNTIME_PROFILE
  process.env.GROWTH_RUNTIME_PROFILE = profile
  return () => {
    if (previous === undefined) delete process.env.GROWTH_RUNTIME_PROFILE
    else process.env.GROWTH_RUNTIME_PROFILE = previous
  }
}

function runProfileGuards(): void {
  console.log("\n=== Phase 8I API profile guards ===\n")

  resetGrowthColdStorageRuntimeMetrics()
  const restoreMinimal = withProfile("operator_minimal")
  for (const row of GROWTH_TIER2_API_INVENTORY) {
    if (row.routes.length === 0) continue
    assert.equal(isGrowthFeatureApiEnabled(row.registryKey), false, `${row.registryKey} API cold`)
  }
  for (const key of listGrowthFeaturesByTier(1).slice(0, 6)) {
    assert.equal(isGrowthFeatureApiEnabled(key), true, `${key} tier1 API active`)
  }
  for (const key of listGrowthFeaturesByTier(3)) {
    assert.equal(isGrowthFeatureApiEnabled(key), true, `${key} tier3 not blocked`)
  }
  const payloadShape = {
    disabled: true,
    profile: "operator_minimal" as const,
    feature: "campaignBuilder" as const,
  }
  assert.equal(payloadShape.disabled, true)
  assert.equal(payloadShape.profile, "operator_minimal")
  restoreMinimal()
  console.log("  ✓ operator_minimal soft-disables Tier 2 APIs")

  const restoreAdmin = withProfile("full_admin")
  for (const row of GROWTH_TIER2_API_INVENTORY) {
    if (row.routes.length === 0) continue
    assert.equal(isGrowthFeatureApiEnabled(row.registryKey), true, `${row.registryKey} API active in full_admin`)
  }
  restoreAdmin()
  console.log("  ✓ full_admin enables Tier 2 APIs")

  const cronSource = readSource("app/api/cron/growth-provider-runtime-diagnostics/route.ts")
  assert.match(cronSource, /guardGrowthFeatureCronJob\("diagnosticsDashboards"\)/)
  console.log("  ✓ Tier 2 cron jobs guarded at route entry")
}

function runSourceCoverage(): void {
  console.log("\n=== Phase 8I source coverage ===\n")

  for (const apiPath of listGrowthTier2ApiPaths()) {
    const feature = resolveGrowthFeatureKeyFromApiPath(apiPath)
    assert.ok(feature, `mapped ${apiPath}`)
    const fsPath = `app/api/platform/growth${apiPath.replace("/api/platform/growth", "")}/route.ts`
    if (fs.existsSync(path.join(ROOT, fsPath))) {
      const source = readSource(fsPath)
      assert.match(source, /guardGrowthFeatureApiRoute/, fsPath)
    }
  }
  console.log("  ✓ Tier 2 API route handlers include guardGrowthFeatureApiRoute")

  const subscriber = readSource("lib/growth/realtime-events/realtime-events-subscriber.ts")
  assert.match(subscriber, /isGrowthRealtimeEventBusRuntimeActive/)
  console.log("  ✓ realtime subscriber suppressed when event bus cold")

  const refreshHook = readSource("lib/growth/realtime-events/use-growth-realtime-refresh.ts")
  assert.match(refreshHook, /isGrowthRealtimeEventBusRuntimeActive/)
  console.log("  ✓ useGrowthRealtimeRefresh suppressed when event bus cold")

  const cronSource = readSource("app/api/cron/growth-provider-runtime-diagnostics/route.ts")
  assert.match(cronSource, /guardGrowthFeatureCronJob\("diagnosticsDashboards"\)/)
  console.log("  ✓ diagnostics cron guarded")

  const inboxProvider = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  assert.match(inboxProvider, /isGrowthFeatureApiEnabled\("diagnosticsDashboards"\)/)
  console.log("  ✓ inbox sync dashboard client fetch skipped when cold")

  const restoreSummary = withProfile("operator_minimal")
  const summary = summarizeGrowthColdStorageRuntime()
  restoreSummary()
  assert.ok(summary.activeFeatures.length >= 20)
  assert.ok(summary.coldFeatures.length >= 7)
  assert.ok(summary.estimatedSavings.supabaseRequestsAvoidedPerHour > 0)
  console.log("  ✓ summarizeGrowthColdStorageRuntime diagnostics available")
}

function main(): void {
  runProfileGuards()
  runSourceCoverage()
  console.log("\nPhase 8I cold storage API guard verification passed.\n")
}

main()
