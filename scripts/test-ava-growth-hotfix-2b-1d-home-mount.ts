/**
 * AVA-GROWTH-HOTFIX-2B-1D — Home mount before data fetch certification.
 * Run: pnpm test:ava-growth-hotfix-2b-1d-home-mount
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
  GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
  mergeGrowthHomeWorkspaceSummaryWithCriticalState,
} from "../lib/growth/home/growth-home-critical-executive-state-2b-1c"
import {
  AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER,
  logGrowthHomeMountStage,
} from "../lib/growth/home/growth-home-mount-diagnostics-2b-1d"
import { canSynthesizeGrowthHomeExecutiveIdle } from "../lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER } from "../lib/growth/home/growth-home-workspace-summary-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertNoServerOnlyValueImports(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /from ["']@\/lib\/.*-server[^"']*["']/)
  assert.doesNotMatch(source, /import ["']server-only["']/)
}

console.log(`[${AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER}] Home mount certification`)

async function main(): Promise<void> {
// R4 — client/server module boundaries
assertNoServerOnlyValueImports("lib/growth/home/growth-home-workspace-summary-types.ts")
assertNoServerOnlyValueImports("lib/growth/home/growth-home-critical-executive-state-2b-1c.ts")
assertNoServerOnlyValueImports("lib/growth/home/growth-home-critical-executive-load-2b-1a.ts")
assertNoServerOnlyValueImports("lib/growth/home/growth-home-mount-diagnostics-2b-1d.ts")

const summaryTypes = readSource("lib/growth/home/growth-home-workspace-summary-types.ts")
assert.doesNotMatch(
  summaryTypes,
  /buildGrowthExecutiveGrowthIntelligenceReadModel/,
  "summary types must not import server intelligence builder",
)

const clientHook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.doesNotMatch(clientHook, /growth-home-critical-executive-state-server/)
assert.doesNotMatch(clientHook, /server-only/)
assert.match(clientHook, /logGrowthHomeMountStage\("hook_initialized"/)
assert.match(clientHook, /logGrowthHomeMountStage\("critical_effect_registered"/)
assert.match(clientHook, /logGrowthHomeMountStage\("critical_request_started"/)
assert.match(clientHook, /useState\(buildInitialAppliedFromCache\)/)
assert.match(clientHook, /requestGenerationRef/)
assert.match(clientHook, /GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH/)

const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
assert.match(dashboardBody, /GrowthHomeDashboardErrorBoundary/)
assert.match(dashboardBody, /logGrowthHomeMountStage\("shell_rendered"/)
assert.match(dashboardBody, /logGrowthHomeMountStage\("dashboard_body_rendered"/)

const growthPage = readSource("app/(growth)/growth/page.tsx")
assert.match(growthPage, /logGrowthHomeMountStage\("route_entered"/)

const errorBoundary = readSource("components/growth/workspace/growth-home-dashboard-error-boundary.tsx")
assert.match(errorBoundary, /componentDidCatch/)
assert.match(errorBoundary, /data-growth-home-dashboard-error-boundary/)

const criticalRoute = readSource("app/api/platform/growth/home/critical-executive-state/route.ts")
assert.match(criticalRoute, /buildGrowthHomeCriticalExecutiveState/)

// R3 — merge helper defaults use canonical Home shapes
const merged = mergeGrowthHomeWorkspaceSummaryWithCriticalState({
  existing: null,
  critical: {
    ok: true,
    qaMarker: AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
    generatedAt: new Date().toISOString(),
    requestGeneration: 1,
    retryAttempt: 1,
    criticalLoad: {
      availability: "confirmed_empty",
      pendingApprovalCount: 0,
      packages: [],
    },
    canonicalOperatorApproval: null,
    canonicalOperatorTask: null,
    canonicalActiveMissions: null,
    canonicalOrganizationTraining: null,
    avaActivation: null,
    executiveLoad: {
      qaMarker: "ava-growth-hotfix-2b-1a-home-runtime-v1",
      criticalStageMs: 50,
      secondaryStageMs: null,
      approvals: "confirmed_empty",
      training: "unavailable",
      activation: "unavailable",
      missions: "confirmed_empty",
      recommendation: "confirmed_empty",
    },
    stageTimingsMs: { critical_executive_state_wall: 50 },
  },
})
assert.equal(merged.qaMarker, GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER)
assert.deepEqual(merged.callQueue, { readyCount: 0, nextLabel: null })
assert.deepEqual(merged.meetings, { today: 0, thisWeek: 0, scheduled: 0 })
assert.deepEqual(merged.inbox, {
  repliesNeedingAttention: 0,
  threadsOpen: 0,
  newReplies: 0,
})
assert.equal(merged.operatorTasks.callTasksDue, 0)

// R6/R2 — false Idle remains impossible when approvals unavailable
assert.equal(canSynthesizeGrowthHomeExecutiveIdle({ executiveLoad: { approvals: "unavailable" } as never }), false)

// R1/R5 — browser-safe modules import without throwing
  await import("../lib/growth/home/growth-home-workspace-summary-types")
  await import("../lib/growth/home/growth-home-critical-executive-state-2b-1c")
  await import("../lib/growth/home/growth-home-critical-executive-load-2b-1a")
  await import("../lib/growth/home/growth-home-mount-diagnostics-2b-1d")

  // Mount logger is browser-gated and safe on server import
  assert.doesNotThrow(() => logGrowthHomeMountStage("route_entered", { certification: true }))

  assert.equal(
    GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
    "/api/platform/growth/home/critical-executive-state",
  )

  console.log(`[${AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
