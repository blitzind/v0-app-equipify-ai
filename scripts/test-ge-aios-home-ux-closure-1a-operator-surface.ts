/**
 * GE-AIOS-HOME-UX-CLOSURE-1A — Operator Home surface wiring smoke test (local).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const dashboard = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
const runtimeTrust = readSource("components/growth/workspace/executive-briefing/growth-home-ava-runtime-trust-section.tsx")
const hero = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
const closure = readSource("lib/growth/home/growth-home-operator-closure-1a.ts")

assert.match(dashboard, /operatorClosureMode/)
assert.match(dashboard, /GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER/)
assert.match(dashboard, /operator-work-details/)
assert.match(dashboardBody, /employeeMode && !employeeMode|!employeeMode\)/)
assert.match(dashboardBody, /isGrowthWorkspacePriorityFeedActive\(\) && !employeeMode/)
assert.match(runtimeTrust, /operatorClosureMode/)
assert.match(runtimeTrust, /whatHappensNextLines/)
assert.match(hero, /compact/)
assert.match(closure, /buildOperatorCanCloseBrowserLine/)

console.log("GE-AIOS-HOME-UX-CLOSURE-1A operator Home wiring smoke test passed")
