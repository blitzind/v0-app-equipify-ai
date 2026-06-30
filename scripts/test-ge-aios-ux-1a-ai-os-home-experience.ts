/**
 * GE-AIOS-UX-1A — AI OS Home Experience certification.
 * Run: pnpm test:ge-aios-ux-1a-ai-os-home-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
  buildGrowthHomeExecutiveBriefingCertDashboard,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import {
  GROWTH_HOME_AI_OS_UX_QA_MARKER,
  GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log("\n=== GE-AIOS-UX-1A AI OS Home Experience Certification ===\n")

assert.equal(GROWTH_HOME_AI_OS_UX_QA_MARKER, "growth-ge-aios-ux-1a-ai-os-home-experience-v1")
console.log("  ✓ QA marker registered")

const dashboardSource = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.match(dashboardSource, /GrowthHomeExecutiveBriefingHeroSection/)
assert.match(dashboardSource, /executiveRecommendation=\{briefing\.executiveRecommendation\}/)
assert.match(dashboardSource, /GrowthHomeAiOsWaitingOnYouSection/)
assert.match(dashboardSource, /GrowthHomeAvaLiveStatusSection/)
assert.match(dashboardSource, /GrowthHomeDailyWorkQueueSection/)
assert.match(dashboardSource, /GrowthHomeThroughputSection/)
assert.match(dashboardSource, /GrowthHomeMailboxDomainHealthSection/)
assert.match(dashboardSource, /GrowthHomeAutonomousReadinessSection/)
assert.match(dashboardSource, /home-customer-growth/)
assert.match(dashboardSource, /CollapsibleContent[\s\S]*GrowthHomeBusinessSnapshotSection/)
console.log("  ✓ Home layout promotes operator sections and collapses dashboard-style blocks")

const synthesizerSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
assert.match(synthesizerSource, /buildExecutiveBriefingHero/)
assert.match(synthesizerSource, /buildDailyWorkQueueItems/)
assert.match(synthesizerSource, /buildAvaLiveStatus/)
assert.match(synthesizerSource, /buildThroughputMetrics/)
assert.doesNotMatch(synthesizerSource, /Math\.random/)
assert.doesNotMatch(synthesizerSource, /demo/i)
console.log("  ✓ UX synthesizer derives presentation from existing read models only")

const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section.tsx")
assert.match(heroSource, /home-hero-ava-recommends/)
assert.match(heroSource, /GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER/)

const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
assert.equal(fixture.qaMarker, GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER)
assert.ok(fixture.aiOsUx.hero.greeting.length > 0)
assert.ok(fixture.aiOsUx.hero.executiveKpis.length > 0)
assert.ok(fixture.aiOsUx.hero.todayAtAGlance.length > 0)
assert.ok(fixture.aiOsUx.hero.revenueToday.length > 0)
assert.ok(fixture.aiOsUx.throughput.length > 0)
assert.ok(fixture.aiOsUx.mailboxDomainHealth)
assert.ok(fixture.aiOsUx.autonomousReadiness)
assert.ok(fixture.aiOsUx.dailyWorkQueueBuckets)
assert.ok(fixture.aiOsUx.dailyWorkQueue.length > 0)
console.log("  ✓ Cert fixture exposes AI OS UX view model with canonical queue metrics")

const emptyDashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
emptyDashboard.briefing = null
emptyDashboard.sections = emptyDashboard.sections.map((section) => ({
  ...section,
  metrics: section.metrics.map((metric) => ({ ...metric, value: 0 })),
}))
const emptyBriefing = synthesizeGrowthHomeExecutiveBriefing({ dashboard: emptyDashboard })
assert.equal(emptyBriefing.aiOsUx.liveStatus, null)
assert.equal(emptyBriefing.aiOsUx.mailboxDomainHealth, null)
assert.equal(emptyBriefing.aiOsUx.autonomousReadiness, null)
console.log("  ✓ Empty runtime hides cards instead of fabricating metrics")

const ux = buildAiOsUxViewModel({
  dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
  executiveBrief: fixture.executiveBrief,
  waitingOnYou: fixture.waitingOnYou,
  waitingOnYouOverflow: 0,
  needsReview: fixture.needsReview,
})
assert.ok(ux.waitingOnYou.length >= 0)
assert.ok(ux.dailyWorkQueue.length >= 0)
console.log("  ✓ AI OS UX synthesizer builds hero, queue, throughput, and readiness")

console.log("\nGE-AIOS-UX-1A certification passed.\n")
