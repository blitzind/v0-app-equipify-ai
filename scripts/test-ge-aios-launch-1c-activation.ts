/**
 * GE-AIOS-LAUNCH-1C — Activation wiring smoke test (local).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const dashboard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
)

assert.match(dashboard, /GrowthHomeAvaActivationSection/)
assert.match(dashboard, /data-qa-marker-launch-1c/)
assert.match(dashboard, /avaActivation/)

assert.match(readSource("app/api/growth/workspace/ava/activate/route.ts"), /activateGrowthAvaAutonomousMode/)

const vm = buildGrowthHomeRuntimeTrustViewModel({
  server: null,
  salesOutcomes: null,
  activeWork: null,
  pendingApprovals: 0,
  setupIncomplete: false,
  activation: {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activated: true,
    activatedAt: new Date().toISOString(),
    autonomyEnabled: true,
    objectiveModeEnabled: true,
    readiness: { qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER, ready: true, blockers: [] },
    employment: {
      qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
      activatedAt: new Date().toISOString(),
      activatedLabel: "Today",
      daysActive: 1,
      companiesResearched: 2,
      opportunitiesPrepared: 1,
      approvalsCompleted: 0,
      companiesRejected: 0,
      discoveryCyclesToday: 1,
      autonomousMinutesToday: 15,
    },
  },
})

assert.equal(vm.employeeMode, true)
assert.equal(vm.startStatus.mode, "employee_active")

console.log("GE-AIOS-LAUNCH-1C activation wiring smoke test passed")
