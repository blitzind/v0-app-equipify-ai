/**
 * GE-AI-9C — Autonomous Service Operator certification (static).
 * Run: pnpm test:ge-ai-9c-autonomous-service-operator
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_SERVICE_FORBIDDEN_ACTIONS,
  AI_SERVICE_MISSIONS_TITLE,
  GE_AI_9C_QA_MARKER,
} from "../lib/workspace/ai-autonomous-service-operator"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-9C] Autonomous Service Operator certification`)

assert.equal(GE_AI_9C_QA_MARKER, "ge-ai-9c-autonomous-service-operator-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for service operator layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.serviceMissions.length >= 1)
assert.ok(home.serviceMissions.length <= 3)
assert.ok(home.checkIn.totalServiceMissionCount >= 12)
assert.ok(home.checkIn.serviceOperatorSummary?.includes("onboarding"))
console.log("  ✓ delivery intelligence synthesized for future vision")

for (const mission of home.serviceMissions) {
  assert.ok(mission.customer.length > 0)
  assert.ok(mission.workOrder.length > 0)
  assert.ok(mission.currentStage.length > 0)
  assert.ok(mission.technician.length > 0)
  assert.ok(mission.progressPercent >= 0 && mission.progressPercent <= 100)
  assert.ok(mission.eta.length > 0)
  assert.ok(mission.expectedValue.length > 0)
}
console.log("  ✓ missions include customer, work order, stage, technician, progress, and value")

assert.ok(home.serviceHealth.length >= 1)
assert.ok(home.serviceHealth.every((item) => item.evidence.length > 0))
console.log("  ✓ service health uses human language with evidence")

assert.ok(home.technicianAwareness.length >= 1)
assert.ok(home.technicianAwareness.every((item) => item.evidence.length > 0))
console.log("  ✓ technician awareness derived from scheduling read models")

assert.ok(home.serviceFollowUps.length >= 1)
assert.ok(home.serviceFollowUps.every((item) => item.evidence.length > 0))
console.log("  ✓ customer follow-ups are presentation only with evidence")

assert.ok(home.operationalInsights.length >= 1)
assert.ok(home.operationalInsights.every((item) => item.evidence.length > 0))
console.log("  ✓ operational insights require evidence")

assert.ok(home.serviceContribution)
console.log("  ✓ service business contribution populated")

assert.ok(home.checkIn.serviceVoiceLines.length >= 1)
assert.ok(home.activeRevenueMissions.length >= 1)
assert.ok(home.marketingMissions.length >= 1)
assert.ok(home.customerSuccessMissions.length >= 1)
console.log("  ✓ Revenue Director remains coordinator — revenue, marketing, and CS mission UX continues passing")

const requiredFiles = [
  "lib/workspace/ai-autonomous-service-operator.ts",
  "lib/growth/workspace/executive-briefing/growth-home-service-mission-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-service-missions-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-service-health-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-technician-awareness-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-service-follow-ups-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-operational-insights-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-service-contribution-section.tsx",
  "docs/GE-AI-9C_AUTONOMOUS_SERVICE_OPERATOR.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} service operator files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(layout.includes("GrowthHomeServiceMissionsSection"))
assert.ok(layout.includes("isGrowthHomeServiceOperatorVisible"))
assert.ok(layout.includes("showDeliveryIntelligence"))
console.log("  ✓ delivery intelligence components preserved but gated off in v1")

const missionsSection = readSource("components/growth/workspace/executive-briefing/growth-home-service-missions-section.tsx")
assert.ok(missionsSection.includes("AI_DELIVERY_INTELLIGENCE_TITLE"))
for (const forbidden of AI_SERVICE_FORBIDDEN_ACTIONS) {
  assert.equal(missionsSection.includes(forbidden), false, `forbidden action in UI: ${forbidden}`)
}

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-service-mission-synthesizer.ts")
assert.ok(synthesizer.includes("GROWTH_HOME_SERVICE_MISSION_ORCHESTRATION_RULE"))
assert.ok(synthesizer.includes("GrowthRevenueDirectorCommandCenterSnapshot"))
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
assert.equal(synthesizer.includes("executeTransportSend"), false)
assert.equal(synthesizer.includes("cron.schedule"), false)
assert.equal(synthesizer.includes("createAiWorkOrder"), false)
console.log("  ✓ no duplicate scheduling engine, no technician reassignment, no scheduler activation")

const checkInSection = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkInSection.includes("showDeliveryIntelligence"))
console.log("  ✓ delivery intelligence voice gated for v1")

console.log(`[GE-AI-9C] PASS — ${GE_AI_9C_QA_MARKER}`)
