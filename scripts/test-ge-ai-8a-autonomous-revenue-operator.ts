/**
 * GE-AI-8A — Autonomous Revenue Operator certification (static).
 * Run: pnpm test:ge-ai-8a-autonomous-revenue-operator
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE } from "../lib/growth/aios/revenue-director/growth-revenue-director-types"
import {
  AI_REVENUE_ACTIVE_MISSIONS_TITLE,
  AI_REVENUE_OPERATOR_FORBIDDEN_CONTROLS,
  GE_AI_8A_QA_MARKER,
} from "../lib/workspace/ai-autonomous-revenue-operator"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-8A] Autonomous Revenue Operator certification`)

assert.equal(GE_AI_8A_QA_MARKER, "ge-ai-8a-autonomous-revenue-operator-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for revenue operator layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.activeRevenueMissions.length >= 1)
assert.ok(home.activeRevenueMissions.length <= 3)
assert.ok(home.checkIn.activeMissionCount === home.activeRevenueMissions.length)
assert.ok(home.checkIn.operatorMissionSummary?.includes("driving"))
console.log("  ✓ missions synthesized from existing workflow state")

for (const mission of home.activeRevenueMissions) {
  assert.ok(mission.title.length > 5)
  assert.ok(mission.progressPercent >= 0 && mission.progressPercent <= 100)
  assert.ok(mission.currentStage.length > 0)
  assert.ok(mission.nextAction.length > 0)
  assert.ok(mission.controls.length >= 4)
  for (const control of mission.controls) {
    assert.ok(["pause", "resume", "review", "open_approvals"].includes(control.kind))
  }
}
console.log("  ✓ active missions include progress, stage, blocker, and operator controls")

assert.ok(home.missionHealth.length >= 1)
assert.ok(home.missionTimeline.length >= 1)
assert.ok(home.nextPlannedActions.length >= 1)
assert.ok(home.nextPlannedActions.every((action) => action.evidence.length > 0))
console.log("  ✓ mission timeline and planned actions derived from read models")

if (home.revenueForecast) {
  assert.ok(home.revenueForecast.monthlyGoal.length > 0)
  assert.ok(home.revenueForecast.projectedPercent >= 0)
  assert.ok(home.revenueForecast.confidence.length > 0)
}
console.log("  ✓ revenue forecast derived from pipeline read models")

const requiredFiles = [
  "lib/workspace/ai-autonomous-revenue-operator.ts",
  "lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-active-revenue-missions-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-mission-timeline-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-next-planned-actions-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-revenue-forecast-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-mission-health-section.tsx",
  "docs/GE-AI-8A_AUTONOMOUS_REVENUE_OPERATOR.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} revenue operator files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(layout.includes("GrowthHomeActiveRevenueMissionsSection"))
assert.ok(layout.includes("GrowthHomeMissionTimelineSection"))
assert.ok(layout.includes("GrowthHomeNextPlannedActionsSection"))
assert.ok(layout.includes("GrowthHomeRevenueForecastSection"))
jsxOrder(layout, "GrowthHomeCheckInSection", "GrowthHomeActiveRevenueMissionsSection")
jsxOrder(layout, "GrowthHomeActiveRevenueMissionsSection", "GrowthHomeDailyBriefingSection")
console.log("  ✓ dashboard layout reflects revenue mission hierarchy")

const missionsSection = readSource("components/growth/workspace/executive-briefing/growth-home-active-revenue-missions-section.tsx")
assert.ok(missionsSection.includes("AI_REVENUE_ACTIVE_MISSIONS_TITLE"))
for (const forbidden of AI_REVENUE_OPERATOR_FORBIDDEN_CONTROLS) {
  assert.equal(missionsSection.includes(forbidden), false, `forbidden control: ${forbidden}`)
}
console.log("  ✓ operator controls limited to pause, resume, review, open approvals")

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer.ts")
assert.ok(synthesizer.includes("GrowthRevenueDirectorCommandCenterSnapshot"))
assert.ok(synthesizer.includes("GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE"))
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
assert.equal(synthesizer.includes("createAiWorkOrder"), false)
assert.equal(synthesizer.includes("cron.schedule"), false)
assert.equal(synthesizer.includes("setInterval"), false)
console.log("  ✓ Revenue Director remains coordinator — no duplicate orchestration")

const checkInSection = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkInSection.includes("operatorMissionSummary"))
console.log("  ✓ operator summary uses mission-driving language")

console.log(`[GE-AI-8A] PASS — ${GE_AI_8A_QA_MARKER}`)
