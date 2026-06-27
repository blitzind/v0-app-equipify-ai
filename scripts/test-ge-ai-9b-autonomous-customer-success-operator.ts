/**
 * GE-AI-9B — Autonomous Customer Success Operator certification (static).
 * Run: pnpm test:ge-ai-9b-autonomous-customer-success-operator
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_CS_FORBIDDEN_ACTIONS,
  AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE,
  GE_AI_9B_QA_MARKER,
} from "../lib/workspace/ai-autonomous-customer-success-operator"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-9B] Autonomous Customer Success Operator certification`)

assert.equal(GE_AI_9B_QA_MARKER, "ge-ai-9b-autonomous-customer-success-operator-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for customer success layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.customerSuccessMissions.length >= 1)
assert.ok(home.customerSuccessMissions.length <= 3)
assert.ok(home.checkIn.activeCustomerSuccessMissionCount === home.customerSuccessMissions.length)
assert.ok(home.checkIn.customerSuccessOperatorSummary?.includes("customer growth"))
console.log("  ✓ customer success missions synthesized from existing read models")

for (const mission of home.customerSuccessMissions) {
  assert.ok(mission.customer.length > 0)
  assert.ok(mission.currentHealth.length > 0)
  assert.ok(mission.renewalStatus.length > 0)
  assert.ok(mission.progressPercent >= 0 && mission.progressPercent <= 100)
  assert.ok(mission.nextMilestone.length > 0)
  assert.ok(mission.expectedValue.length > 0)
}
console.log("  ✓ missions include customer, health, renewal, progress, and value")

assert.ok(home.customerHealth.length >= 1)
assert.ok(home.customerHealth.every((item) => item.evidence.length > 0))
console.log("  ✓ customer health uses human language with evidence")

assert.ok(home.expansionOpportunities.length >= 1)
assert.ok(home.expansionOpportunities.every((item) => item.evidence.length > 0))
console.log("  ✓ expansion opportunities require evidence")

assert.ok(home.renewalsMonitoring.length >= 1)
assert.ok(home.renewalsMonitoring.every((item) => item.recommendedAction.length > 0))
console.log("  ✓ renewals monitoring includes risk and recommended action")

assert.ok(home.customerWins.length >= 1)
assert.ok(home.csContribution)
console.log("  ✓ customer wins and business contribution populated")

assert.ok(home.checkIn.customerSuccessVoiceLines.length >= 1)
assert.ok(home.activeRevenueMissions.length >= 1)
assert.ok(home.marketingMissions.length >= 1)
console.log("  ✓ revenue and marketing mission UX continues passing")

const requiredFiles = [
  "lib/workspace/ai-autonomous-customer-success-operator.ts",
  "lib/growth/workspace/executive-briefing/growth-home-customer-success-mission-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-customer-success-missions-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-customer-health-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-expansion-opportunities-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-renewals-monitoring-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-customer-wins-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-cs-contribution-section.tsx",
  "docs/GE-AI-9B_AUTONOMOUS_CUSTOMER_SUCCESS_OPERATOR.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} customer success files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(layout.includes("GrowthHomeCustomerSuccessMissionsSection"))
assert.ok(layout.includes("GrowthHomeCustomerHealthSection"))
assert.ok(layout.includes("GrowthHomeExpansionOpportunitiesSection"))
assert.ok(layout.includes("GrowthHomeRenewalsMonitoringSection"))
assert.ok(layout.includes("GrowthHomeCustomerWinsSection"))
assert.ok(layout.includes("GrowthHomeCsContributionSection"))
jsxOrder(layout, "GrowthHomeMarketingMissionsSection", "GrowthHomeCustomerSuccessMissionsSection")
console.log("  ✓ dashboard layout reflects customer success hierarchy")

const missionsSection = readSource("components/growth/workspace/executive-briefing/growth-home-customer-success-missions-section.tsx")
assert.ok(missionsSection.includes("AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE"))
for (const forbidden of AI_CS_FORBIDDEN_ACTIONS) {
  assert.equal(missionsSection.includes(forbidden), false, `forbidden action in UI: ${forbidden}`)
}

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-customer-success-mission-synthesizer.ts")
assert.ok(synthesizer.includes("GROWTH_HOME_CS_MISSION_ORCHESTRATION_RULE"))
assert.ok(synthesizer.includes("GrowthRevenueDirectorCommandCenterSnapshot"))
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
assert.equal(synthesizer.includes("executeTransportSend"), false)
assert.equal(synthesizer.includes("cron.schedule"), false)
console.log("  ✓ Revenue Director remains coordinator — no duplicate CS engine")

const checkInSection = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkInSection.includes("customerSuccessOperatorSummary"))
console.log("  ✓ operator voice includes customer success language")

console.log(`[GE-AI-9B] PASS — ${GE_AI_9B_QA_MARKER}`)
