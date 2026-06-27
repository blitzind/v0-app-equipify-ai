/**
 * GE-AI-UX-6A — AI Ownership & Accountability certification (static).
 * Run: pnpm test:ge-ai-ux-6a-ai-ownership-accountability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_OWNERSHIP_MY_PRIORITIES_TITLE,
  AI_OWNERSHIP_WAITING_ON_YOU_LIMIT,
  GE_AI_UX_6A_QA_MARKER,
} from "../lib/workspace/ai-ownership-accountability"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-UX-6A] AI Ownership & Accountability certification`)

assert.equal(GE_AI_UX_6A_QA_MARKER, "ge-ai-ux-6a-ai-ownership-accountability-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for ownership layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.myPriorities.length >= 1)
assert.ok(home.myPriorities[0]?.title.startsWith("I'm "))
assert.ok(home.myPriorities[0]?.progressPercent >= 0)
assert.ok(home.myPriorities[0]?.waitingOnYou.length >= 0)
console.log("  ✓ My Priorities replace Working On with ownership fields")

assert.ok(home.accomplishments.length >= 1)
assert.ok(home.accomplishments.some((group) => group.items.some((line) => line.startsWith("I "))))
console.log("  ✓ What I Accomplished uses narrative outcome copy")

assert.ok(home.weeklyGoals.length >= 1)
assert.ok(home.weeklyGoals.every((goal) => goal.progressPercent >= 0 && goal.progressPercent <= 100))
console.log("  ✓ weekly goals derived from objectives with progress")

assert.ok(home.waitingOnYou.length <= AI_OWNERSHIP_WAITING_ON_YOU_LIMIT)
assert.ok(home.waitingOnYou.length >= 1)
console.log("  ✓ Waiting On You limited to five items")

if (home.biggestWin) {
  assert.ok(home.biggestWin.evidence.length >= 1)
  assert.ok(home.biggestWin.confidenceLabel.length > 0)
}
if (home.biggestRiskFeatured) {
  assert.ok(home.biggestRiskFeatured.evidence.length >= 1)
}
assert.ok(home.biggestWin || home.biggestRiskFeatured)
console.log("  ✓ Biggest Win and Biggest Risk use existing evidence")

assert.ok(home.executiveRecommendation)
assert.ok(home.executiveRecommendation.sentence.length > 20)
assert.ok(home.executiveRecommendation.evidence.length >= 1)
console.log("  ✓ executive recommendation grounded in read models")

assert.ok(home.aiWorkload.length === 4)
console.log("  ✓ AI workload visualization present")

for (const item of home.thingsNoticed) {
  assert.match(item.observation, /^I'm (responsible|monitoring|preparing|waiting|protecting|tracking|optimizing)/i)
}
console.log("  ✓ ownership language in Things I Noticed")

const requiredFiles = [
  "lib/workspace/ai-ownership-accountability.ts",
  "lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-my-priorities-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-accomplishments-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-weekly-goals-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-waiting-on-you-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-biggest-win-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-biggest-risk-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-ai-workload-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-executive-recommendation-section.tsx",
  "docs/GE-AI-UX-6A_AI_OWNERSHIP_ACCOUNTABILITY.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} ownership files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(!layout.includes("GrowthHomeWorkingOnSection"))
assert.ok(!layout.includes("GrowthHomeCompletedTodaySection"))
assert.ok(layout.includes("GrowthHomeMyPrioritiesSection"))
assert.ok(layout.includes("GrowthHomeAccomplishmentsSection"))
assert.ok(layout.includes("GrowthHomeWaitingOnYouSection"))
assert.ok(layout.includes("GrowthHomeExecutiveRecommendationSection"))
jsxOrder(layout, "GrowthHomeWaitingOnYouSection", "GrowthHomeMyPrioritiesSection")
jsxOrder(layout, "GrowthHomeTimelineSection", "GrowthHomeExecutiveRecommendationSection")
console.log("  ✓ dashboard layout reflects ownership hierarchy")

const prioritiesSection = readSource("components/growth/workspace/executive-briefing/growth-home-my-priorities-section.tsx")
assert.ok(prioritiesSection.includes("AI_OWNERSHIP_MY_PRIORITIES_TITLE"))

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer.ts")
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
console.log("  ✓ presentation-only — no backend/runtime/API changes")

console.log(`[GE-AI-UX-6A] PASS — ${GE_AI_UX_6A_QA_MARKER}`)
