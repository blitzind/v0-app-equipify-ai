/**
 * GE-AVA-FRESH-SLATE-1C — Certification for /growth Home debug source + cache guards.
 *
 * Run: pnpm test:growth-home-debug-source-fresh-slate-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_DEBUG_SOURCE_QA_MARKER,
  GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import {
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_NO_STORE_CACHE_CONTROL,
  GROWTH_HOME_WORKSPACE_API_ROUTES,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
} from "../lib/growth/home/growth-home-workspace-api-contract"
import {
  extractSupabaseProjectRef,
  isGrowthHomeProductionRuntime,
  resolveGrowthHomeSupabaseRuntimeEnv,
} from "../lib/growth/home/growth-home-supabase-runtime-env"
import { growthHomeRouteDynamic } from "../lib/growth/home/growth-home-no-store-response"

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runStructureCertification(): void {
  console.log(`\n=== ${GROWTH_HOME_DEBUG_SOURCE_QA_MARKER} (structure) ===\n`)

  assert.equal(GROWTH_HOME_DEBUG_SOURCE_QA_MARKER, "growth-home-debug-source-fresh-slate-1c-v1")
  assert.equal(GROWTH_HOME_DEBUG_SOURCE_API_PATH, "/api/platform/growth/home/debug-source")
  assert.equal(GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER, "growth-workspace-dashboard-fetch-batch-v3")
  assert.equal(growthHomeRouteDynamic, "force-dynamic")
  assert.ok(GROWTH_HOME_NO_STORE_CACHE_CONTROL.includes("no-store"))

  assert.equal(GROWTH_HOME_WORKSPACE_API_ROUTES.length, 12)

  for (const routePath of [
    "lib/growth/home/growth-home-debug-source.ts",
    "lib/growth/home/growth-home-no-store-response.ts",
    "lib/growth/home/growth-home-supabase-runtime-env.ts",
    "lib/growth/home/growth-home-workspace-api-contract.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, routePath)), `missing production module: ${routePath}`)
  }

  const routeIds = new Set(GROWTH_HOME_WORKSPACE_API_ROUTES.map((route) => route.id))
  assert.ok(routeIds.has("aiden_briefing"))
  assert.ok(routeIds.has("revenue_queue"))
  assert.ok(routeIds.has("daily_revenue_work_queue"))
  assert.ok(routeIds.has("opportunities_pipeline"))

  assert.ok(fs.existsSync(path.join(ROOT, "app/api/platform/growth/home/workspace-summary/route.ts")))

  const dashboardHook = read("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(dashboardHook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.match(dashboardHook, /cache: "no-store"/)
  assert.match(dashboardHook, /\[growth\/home\/dashboard-fetch\]/)
  assert.doesNotMatch(dashboardHook, /route\.id === "lead_inbox"/)

  const dashboardBody = read("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /GrowthHomeDebugFooter/)

  const debugRoute = read("app/api/platform/growth/home/debug-source/route.ts")
  assert.match(debugRoute, /buildGrowthHomeDebugSourceReport/)
  assert.match(debugRoute, /isGrowthHomeProductionRuntime/)
  assert.match(debugRoute, /growthHomeNoStoreJson/)
  assert.doesNotMatch(debugRoute, /GROWTH_HOME_DEBUG_SOURCE_ENABLED/)

  const resetScript = read("scripts/reset-growth-engine-operational-data.ts")
  assert.match(resetScript, /--execute/)
  assert.match(resetScript, /resolveGrowthResetSupabaseConfig/)
  assert.match(resetScript, /runGrowthEngineOperationalReset/)
  assert.doesNotMatch(resetScript, /--production-env/)
  assert.doesNotMatch(resetScript, /growth-reset-env-comparison/)

  const homeApiRoutes = [
    "app/api/platform/growth/aiden/briefing/route.ts",
    "app/api/platform/growth/lead-inbox/route.ts",
    "app/api/platform/growth/daily-revenue-work-queue/route.ts",
    "app/api/platform/growth/opportunities/pipeline/route.ts",
    "app/api/platform/growth/cadence/command-summary/route.ts",
    "app/api/platform/growth/opportunities/dashboard/route.ts",
    "app/api/platform/growth/sequences/dashboard/route.ts",
    "app/api/platform/growth/sequences/execution/dashboard/route.ts",
    "app/api/platform/growth/engagement-dashboard/command-center/route.ts",
    "app/api/platform/growth/conversations/dashboard/route.ts",
    "app/api/platform/growth/relationships/dashboard/route.ts",
    "app/api/platform/growth/calls/dashboard/route.ts",
  ]

  for (const routePath of homeApiRoutes) {
    const source = read(routePath)
    assert.match(source, /export const dynamic = "force-dynamic"/, `${routePath} must force dynamic`)
    assert.match(source, /growthHomeNoStoreJson/, `${routePath} must use no-store JSON helper`)
  }

  const runtimeEnv = resolveGrowthHomeSupabaseRuntimeEnv()
  assert.ok(typeof runtimeEnv === "object")
  assert.equal(extractSupabaseProjectRef("https://abc123.supabase.co"), "abc123")
  assert.equal(extractSupabaseProjectRef("not-a-url"), null)
  assert.equal(typeof isGrowthHomeProductionRuntime(), "boolean")

  assert.notEqual(GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER, GROWTH_HOME_DEBUG_SOURCE_QA_MARKER)

  console.log("PASS — Home debug source structure certification")
}

runStructureCertification()
