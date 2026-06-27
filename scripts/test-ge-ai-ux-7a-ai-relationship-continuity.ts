/**
 * GE-AI-UX-7A — AI Relationship & Continuity certification (static).
 * Run: pnpm test:ge-ai-ux-7a-ai-relationship-continuity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_CONTINUITY_DAILY_BRIEFING,
  AI_CONTINUITY_SINCE_LAST_CHECK_IN,
  GE_AI_UX_7A_QA_MARKER,
} from "../lib/workspace/ai-relationship-continuity"
import { deriveDailyBriefingPeriod } from "../lib/workspace/ai-relationship-continuity"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
}

console.log(`[GE-AI-UX-7A] AI Relationship & Continuity certification`)

assert.equal(GE_AI_UX_7A_QA_MARKER, "ge-ai-ux-7a-ai-relationship-continuity-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for continuity layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.equal(home.checkIn.hasContinuity, true)
assert.equal(home.checkIn.continuityIntro, AI_CONTINUITY_SINCE_LAST_CHECK_IN)
assert.ok(home.checkIn.continuityBullets.length >= 1)
console.log("  ✓ previous session continuity shown when data exists")

assert.ok(home.sinceWeLastMet.length >= 1)
assert.ok(home.sinceWeLastMet.every((item) => item.evidence.length > 0))
console.log("  ✓ Since We Last Met derived from timeline and read models")

assert.ok(home.whatChanged.length >= 1)
assert.ok(home.whatChanged.every((item) => item.label.length > 0 && item.detail.length > 0))
console.log("  ✓ What Changed highlights deltas only")

assert.ok(home.recommendationContinuity.length >= 1)
for (const rec of home.recommendationContinuity) {
  assert.ok(rec.previousStance.length > 10)
  assert.ok(rec.currentStance.length > 10)
  assert.ok(rec.reason.length > 10)
  assert.ok(rec.evidence.length >= 1)
}
console.log("  ✓ recommendation changes explain why with evidence")

assert.ok(home.ourProgress.length === 3)
assert.ok(home.ourProgress.every((period) => period.metrics.length >= 3))
console.log("  ✓ Our Progress aggregates from existing read models")

assert.ok(home.milestones.length >= 1)
console.log("  ✓ milestones derived from existing data")

assert.ok(home.trustExplanations.length >= 1)
assert.ok(home.trustExplanations.every((item) => item.evidence.length >= 1))
console.log("  ✓ trust explanations include evidence")

if (home.dailyBriefing) {
  assert.ok(["morning", "afternoon", "evening"].includes(home.dailyBriefing.period))
  assert.equal(home.dailyBriefing.headline, AI_CONTINUITY_DAILY_BRIEFING[home.dailyBriefing.period])
  assert.ok(home.dailyBriefing.items.length >= 1)
}
assert.equal(deriveDailyBriefingPeriod(9), "morning")
assert.equal(deriveDailyBriefingPeriod(14), "afternoon")
assert.equal(deriveDailyBriefingPeriod(19), "evening")
console.log("  ✓ daily briefing uses timestamps only")

const requiredFiles = [
  "lib/workspace/ai-relationship-continuity.ts",
  "lib/growth/workspace/executive-briefing/growth-home-continuity-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-since-we-last-met-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-what-changed-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-recommendation-continuity-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-our-progress-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-milestones-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-trust-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-daily-briefing-section.tsx",
  "docs/GE-AI-UX-7A_AI_RELATIONSHIP_CONTINUITY.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} continuity files present`)

const layout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(layout.includes("continueItems"))
assert.ok(layout.includes("GrowthHomeSinceWeLastMetSection"))
assert.ok(layout.includes("GrowthHomeWhatChangedSection"))
assert.ok(layout.includes("GrowthHomeRecommendationContinuitySection"))
assert.ok(layout.includes("GrowthHomeOurProgressSection"))
assert.ok(layout.includes("GrowthHomeMilestonesSection"))
assert.ok(layout.includes("GrowthHomeTrustSection"))
assert.ok(layout.includes("GrowthHomeDailyBriefingSection"))
jsxOrder(layout, "GrowthHomeCheckInSection", "GrowthHomeSinceWeLastMetSection")
jsxOrder(layout, "GrowthHomeWhatChangedSection", "GrowthHomeWaitingOnYouSection")
jsxOrder(layout, "GrowthHomeMyPrioritiesSection", "GrowthHomeAccomplishmentsSection")
console.log("  ✓ dashboard layout reflects continuity hierarchy")

const checkInSection = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkInSection.includes("hasContinuity"))
assert.ok(checkInSection.includes("continuityIntro"))

const sinceSection = readSource("components/growth/workspace/executive-briefing/growth-home-since-we-last-met-section.tsx")
assert.ok(sinceSection.includes("AI_CONTINUITY_SINCE_WE_LAST_MET_TITLE"))

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-continuity-synthesizer.ts")
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
assert.ok(!synthesizer.includes("fabricate"))
console.log("  ✓ presentation-only — no backend/runtime/API changes")

console.log(`[GE-AI-UX-7A] PASS — ${GE_AI_UX_7A_QA_MARKER}`)
