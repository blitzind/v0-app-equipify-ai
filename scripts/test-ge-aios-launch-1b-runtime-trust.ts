/**
 * GE-AIOS-LAUNCH-1B — Runtime trust wiring smoke test (local, no production).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "@/lib/growth/specialists/execution/sales-outcome-types"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const dashboard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
)
const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const summaryTypes = readSource("lib/growth/home/growth-home-workspace-summary-types.ts")

assert.match(dashboard, /GrowthHomeAvaRuntimeTrustSection/)
assert.match(dashboard, /buildGrowthHomeRuntimeTrustViewModel/)
assert.match(dashboard, /data-qa-marker-launch-1b=\{GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER\}/)
assert.doesNotMatch(dashboard, /GrowthHomeAvaLiveStatusSection/)

assert.match(summaryService, /loadGrowthHomeRuntimeTrustPayload/)
assert.match(summaryTypes, /runtimeTrust\?: GrowthHomeRuntimeTrustServerPayload/)

const generatedAt = new Date().toISOString()
const viewModel = buildGrowthHomeRuntimeTrustViewModel({
  server: {
    qaMarker: GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
    generatedAt,
    killSwitches: { autonomy_enabled: false },
    autonomyTickHealth: null,
    lastSchedulerRunAt: generatedAt,
    lastSchedulerOk: true,
    nextSchedulerEstimateAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  },
  salesOutcomes: {
    qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    outcomes: [],
    dailySummary: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      generatedAt,
      researched: 0,
      qualified: 0,
      strong_opportunities: 0,
      outreach_prepared: 0,
      meetings_prepared: 0,
      approvals_pending: 0,
    },
  },
  activeWork: null,
  pendingApprovals: 0,
  setupIncomplete: false,
  activation: {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activated: false,
    activatedAt: null,
    autonomyEnabled: false,
    objectiveModeEnabled: false,
    readiness: { qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER, ready: true, blockers: [] },
    employment: null,
  },
  missionDiscovery: null,
  generatedAt,
})

assert.equal(viewModel.qaMarker, GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER)
assert.equal(viewModel.startStatus.mode, "activation_required")
assert.equal(viewModel.startStatus.primaryActionKind, "activate")
assert.equal(viewModel.activityFeed.length, 0)
assert.ok(viewModel.heartbeat.some((row) => row.id === "last-scheduler-cycle"))

console.log("GE-AIOS-LAUNCH-1B runtime trust wiring smoke test passed")
