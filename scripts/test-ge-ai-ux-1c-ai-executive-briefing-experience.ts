/**
 * GE-AI-UX-1C — AI Executive Briefing Experience certification (static).
 * Run: pnpm test:ge-ai-ux-1c-ai-executive-briefing-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import {
  GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER,
  GROWTH_HOME_EXECUTIVE_BRIEFING_RULE,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { sanitizeHomeNarrative, translateHomeActivityTitle } from "../lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import { GROWTH_WORKSPACE_DASHBOARD_QA_MARKER } from "../lib/growth/workspace/growth-workspace-dashboard-types"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"

export const GE_AI_UX_1C_QA_MARKER = "ge-ai-ux-1c-ai-executive-briefing-experience-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[GE-AI-UX-1C] AI Executive Briefing Experience certification`)

assert.ok(GROWTH_HOME_EXECUTIVE_BRIEFING_RULE.includes("presentation-only"))
assert.equal(GROWTH_WORKSPACE_DASHBOARD_QA_MARKER, "growth-workspace-dashboard-v4")
console.log("  ✓ dashboard QA marker bumped for executive briefing layout")

const body = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
assert.ok(body.includes("GrowthHomeExecutiveBriefingDashboard"))
assert.equal(body.includes("GrowthOperatorBriefingOperationalSummary"), false, "metrics-first welcome removed")
assert.equal(body.includes("MetricGrid"), false, "metric-first grids removed from default home")
console.log("  ✓ Home body uses executive briefing dashboard")

const requiredComponents = [
  "growth-home-executive-brief-section.tsx",
  "growth-home-needs-attention-section.tsx",
  "growth-home-recommendation-card.tsx",
  "growth-home-approval-summary-section.tsx",
  "growth-home-business-snapshot-section.tsx",
  "growth-home-ai-activity-section.tsx",
  "growth-home-timeline-section.tsx",
  "growth-home-executive-briefing-dashboard.tsx",
]
for (const file of requiredComponents) {
  assert.ok(
    fs.existsSync(path.join(ROOT, "components/growth/workspace/executive-briefing", file)),
    `${file} must exist`,
  )
}
console.log(`  ✓ ${requiredComponents.length} executive briefing components present`)

const translated = translateHomeActivityTitle("Growth Communication Plan Generated")
assert.ok(translated.includes("communication strategy"))
const sanitized = sanitizeHomeNarrative("approval_queue_size = 3 confidence score")
assert.equal(sanitized.includes("confidence"), false)
console.log("  ✓ narrative formatter translates engineering terms")

const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
assert.equal(fixture.qaMarker, GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER)
assert.ok(fixture.executiveBrief.greeting.includes("Michael"))
assert.ok(fixture.executiveBrief.completedOutcomes.length >= 3)
assert.ok(fixture.executiveBrief.introLine.includes("handled"))
assert.ok(fixture.executiveBrief.progressSinceLastVisit.length >= 3)
assert.ok(fixture.executiveBrief.estimatedBusinessImpact?.includes("$"))
assert.ok(fixture.recommendation?.headline.length)
assert.ok(fixture.exceptions.length <= 5)
assert.equal(fixture.aiActivity.length, 6)
assert.ok(fixture.timeline.length >= 2)
assert.ok(fixture.approvalSummary?.totalPending)
console.log("  ✓ cert fixture produces outcome-first executive briefing")

const empty = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: buildGrowthWorkspaceDashboardViewModel({
    briefing: null,
    leadInboxSections: [],
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: null,
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
  }),
})
assert.ok(empty.executiveBrief.progressSinceLastVisit.length >= 1)
assert.equal(empty.readOnly, true)
console.log("  ✓ empty dashboard degrades gracefully")

const synthesizerSource = readSource("lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts")
assert.equal(synthesizerSource.includes('import "server-only"'), false)
assert.equal(synthesizerSource.includes("fetch("), false)
assert.equal(synthesizerSource.includes("openai"), false)
console.log("  ✓ synthesizer is client-safe — no fetch, no LLM")

const hookSource = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.equal(hookSource.includes("executive-briefing"), false, "fetch hook unchanged")
console.log("  ✓ no API/repository/event bus changes")

const dashboardLayout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
function jsxOrder1c(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`))
}
// GE-AIOS-7A — Hero → Needs Your Decision → Revenue Queue summary, then collapsible groups.
jsxOrder1c(dashboardLayout, "GrowthHomeAvaHeroSection", "GrowthHomeAiOsWaitingOnYouSection")
jsxOrder1c(dashboardLayout, "GrowthHomeAiOsWaitingOnYouSection", "GrowthHomeExecutiveSnapshotSection")
jsxOrder1c(dashboardLayout, "GrowthHomeAiOsWaitingOnYouSection", "GrowthHomeMissionCenterSection")
jsxOrder1c(dashboardLayout, "GrowthHomeMissionCenterSection", "GrowthHomeGrowthStrategySection")
jsxOrder1c(dashboardLayout, "GrowthHomeGrowthStrategySection", "GrowthHomeMarketingMissionsSection")
jsxOrder1c(dashboardLayout, "GrowthHomeCollapsibleSection", "GrowthHomeDailyWorkQueueSection")
jsxOrder1c(dashboardLayout, "GrowthHomeCollapsibleSection", "GrowthHomeBusinessSnapshotSection")

const heroLayout = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
const heroMain = heroLayout.slice(heroLayout.indexOf("export function GrowthHomeAvaHeroSection"))
assert.ok(heroMain.includes('data-qa-section="home-ava-hero"'))
assert.doesNotMatch(heroMain, /data-section="home-executive-kpis"/)
console.log("  ✓ visual hierarchy order enforced in unified Ava hero")

console.log(`[GE-AI-UX-1C] PASS — ${GE_AI_UX_1C_QA_MARKER}`)
