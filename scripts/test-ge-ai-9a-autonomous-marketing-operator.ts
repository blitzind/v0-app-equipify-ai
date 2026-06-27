/**
 * GE-AI-9A — Autonomous Marketing Operator certification (static).
 * Run: pnpm test:ge-ai-9a-autonomous-marketing-operator
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_MARKETING_FORBIDDEN_ACTIONS,
  AI_MARKETING_MISSIONS_TITLE,
  GE_AI_9A_QA_MARKER,
} from "../lib/workspace/ai-autonomous-marketing-operator"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-9A] Autonomous Marketing Operator certification`)

assert.equal(GE_AI_9A_QA_MARKER, "ge-ai-9a-autonomous-marketing-operator-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for marketing operator layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.marketingMissions.length >= 1)
assert.ok(home.marketingMissions.length <= 3)
assert.ok(home.checkIn.activeMarketingMissionCount === home.marketingMissions.length)
assert.ok(home.checkIn.marketingOperatorSummary?.includes("sell Equipify"))
console.log("  ✓ marketing missions synthesized from existing read models")

for (const mission of home.marketingMissions) {
  assert.ok(mission.campaign.length > 0)
  assert.ok(mission.goal.length > 0)
  assert.ok(mission.progressPercent >= 0 && mission.progressPercent <= 100)
  assert.ok(mission.currentStage.length > 0)
  assert.ok(mission.expectedImpact.length > 0)
}
console.log("  ✓ marketing missions include campaign, goal, stage, and impact")

assert.ok(home.campaignPerformance.length >= 1)
assert.ok(home.campaignPerformance.every((item) => !item.summary.includes("SELECT")))
console.log("  ✓ campaign performance uses human language only")

assert.ok(home.contentPreparing.length >= 1)
assert.ok(home.audienceIntelligence.length >= 1)
assert.ok(home.marketingContribution)
assert.ok(home.marketingContribution.pipelineInfluenced.length > 0)
console.log("  ✓ content, audience, and contribution sections populated")

assert.ok(home.checkIn.marketingVoiceLines.length >= 1)
console.log("  ✓ operator voice includes marketing initiative language")

assert.ok(home.activeRevenueMissions.length >= 1)
console.log("  ✓ revenue mission UX continues alongside marketing layer")

const requiredFiles = [
  "lib/workspace/ai-autonomous-marketing-operator.ts",
  "lib/growth/workspace/executive-briefing/growth-home-marketing-mission-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-marketing-missions-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-campaign-performance-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-content-preparing-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-audience-intelligence-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-marketing-contribution-section.tsx",
  "docs/GE-AI-9A_AUTONOMOUS_MARKETING_OPERATOR.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} marketing operator files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(layout.includes("GrowthHomeMarketingMissionsSection"))
assert.ok(layout.includes("GrowthHomeCampaignPerformanceSection"))
assert.ok(layout.includes("GrowthHomeContentPreparingSection"))
assert.ok(layout.includes("GrowthHomeAudienceIntelligenceSection"))
assert.ok(layout.includes("GrowthHomeMarketingContributionSection"))
jsxOrder(layout, "GrowthHomeActiveRevenueMissionsSection", "GrowthHomeMarketingMissionsSection")
console.log("  ✓ dashboard layout reflects marketing mission hierarchy")

const missionsSection = readSource("components/growth/workspace/executive-briefing/growth-home-marketing-missions-section.tsx")
assert.ok(missionsSection.includes("AI_GROWTH_INITIATIVES_TITLE"))
for (const forbidden of AI_MARKETING_FORBIDDEN_ACTIONS) {
  assert.equal(missionsSection.includes(forbidden), false, `forbidden action in UI: ${forbidden}`)
}

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-marketing-mission-synthesizer.ts")
assert.ok(synthesizer.includes("GROWTH_HOME_MARKETING_MISSION_ORCHESTRATION_RULE"))
assert.ok(synthesizer.includes("GrowthRevenueDirectorCommandCenterSnapshot"))
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
assert.equal(synthesizer.includes("executeTransportSend"), false)
assert.equal(synthesizer.includes("cron.schedule"), false)
assert.equal(synthesizer.includes("setInterval"), false)
console.log("  ✓ Revenue Director remains coordinator — no duplicate campaign engine")

console.log(`[GE-AI-9A] PASS — ${GE_AI_9A_QA_MARKER}`)
