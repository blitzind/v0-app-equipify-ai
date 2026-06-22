/**
 * GS-AI-PLAYBOOK-5B — Activity center certification.
 * Run: pnpm test:growth-activity-center-5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ACTIVITY_FILTER_OPTIONS,
  GROWTH_ACTIVITY_WORKSPACE_PATH,
  GROWTH_ACTIVITY_WORKSPACE_QA_MARKER,
} from "../lib/growth/activity/growth-activity-workspace-constants"
import {
  buildGrowthActivityEventQuickActions,
  buildGrowthLeadWorkspaceHref,
  buildGrowthPersonalizationForLeadHref,
} from "../lib/growth/activity/growth-activity-workspace-deep-links"
import {
  filterGrowthActivityEvents,
  searchGrowthActivityEvents,
} from "../lib/growth/activity/growth-activity-workspace-filters"
import {
  mapSendrActivityFeedRowToEventView,
  mapSendrHotProspectToHighIntentView,
} from "../lib/growth/activity/growth-activity-workspace-view-model"
import type { GrowthActivityEventView } from "../lib/growth/activity/growth-activity-workspace-types"
import {
  buildGrowthWorkspaceShellNavGroups,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleEvent(overrides: Partial<GrowthActivityEventView> = {}): GrowthActivityEventView {
  return {
    id: "evt-1",
    type: "page_view",
    category: "content",
    title: "Video Viewed",
    description: "Demo page",
    leadId: "lead-1",
    leadName: "Nicole Smith",
    companyName: "Sterling Biomedical",
    occurredAt: new Date().toISOString(),
    urgency: "high",
    score: 82,
    source: "personalized_video",
    landingPageId: "page-1",
    landingPageTitle: "Demo",
    actions: buildGrowthActivityEventQuickActions({ leadId: "lead-1", landingPageId: "page-1" }),
    metadata: {},
    ...overrides,
  }
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-5B Activity Center Certification ===\n")

  assert.equal(GROWTH_ACTIVITY_WORKSPACE_PATH, "/growth/activity")
  assert.equal(GROWTH_ACTIVITY_FILTER_OPTIONS.length, 11)

  const activityPage = readSource("app/(growth)/growth/activity/page.tsx")
  assert.match(activityPage, /GrowthActivityWorkspace/)
  assert.match(activityPage, /title="Activity"/)
  assert.doesNotMatch(activityPage, /GrowthSendrActivityDashboard/)
  assert.doesNotMatch(activityPage, /Personalized Videos Activity/)
  console.log("  ✓ /growth/activity route + unified workspace shell")

  const workspace = readSource("components/growth/activity/growth-activity-workspace.tsx")
  assert.match(workspace, /GROWTH_ACTIVITY_WORKSPACE_QA_MARKER/)
  assert.match(workspace, /GrowthActivityEventCard/)
  assert.match(workspace, /GrowthActivityHighIntentRail/)
  assert.match(workspace, /GROWTH_ACTIVITY_FILTER_OPTIONS/)
  assert.match(workspace, /GROWTH_ACTIVITY_UNIFIED_API_PATH/)
  console.log("  ✓ activity workspace layout — filters, feed, high intent rail")

  const mapped = mapSendrActivityFeedRowToEventView({
    id: "row-1",
    eventType: "video_complete",
    eventLabel: "Video Completed",
    occurredAt: new Date().toISOString(),
    leadId: "lead-1",
    leadName: "Nicole",
    companyName: "Sterling",
    intentScore: 88,
    landingPageId: "page-1",
    landingPageTitle: "Demo",
    sessionId: null,
    metadata: {},
  })
  assert.equal(mapped.category, "content")
  assert.equal(mapped.urgency, "critical")
  assert.ok(mapped.actions.some((action) => action.id === "open-lead"))
  console.log("  ✓ activity aggregation view model")

  const filtered = filterGrowthActivityEvents(
    [sampleEvent(), sampleEvent({ id: "evt-2", category: "ai", score: 40, urgency: "low" })],
    "high-intent",
  )
  assert.equal(filtered.length, 1)

  const searched = searchGrowthActivityEvents([sampleEvent()], "sterling")
  assert.equal(searched.length, 1)
  console.log("  ✓ filters + search")

  const prospect = mapSendrHotProspectToHighIntentView({
    leadId: "lead-1",
    leadName: "Nicole",
    companyName: "Sterling",
    intentScore: 90,
    intentLevel: "high",
    pageViews: 3,
    videoCompletionPercent: 95,
    ctaClicks: 1,
    bookingStatus: "none",
    lastActivityAt: new Date().toISOString(),
    landingPageId: "page-1",
    landingPageTitle: "Demo",
    recommendations: ["Follow up today"],
  })
  assert.equal(prospect.score, 90)
  assert.ok(prospect.actions.length >= 2)
  console.log("  ✓ high intent rail view model")

  assert.equal(buildGrowthLeadWorkspaceHref("lead-1"), "/growth/leads/lead-1")
  assert.match(buildGrowthPersonalizationForLeadHref("lead-1"), /^\/growth\/personalization\?leadId=/)
  console.log("  ✓ cross-workspace quick actions")

  const shellNav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(shellNav, /id: "activity"/)
  assert.match(shellNav, /registryRouteId: "workspace-activity"/)
  assert.match(shellNav, /id: "intelligence"/)
  const intelligenceBlock = shellNav.slice(
    shellNav.indexOf('id: "intelligence"'),
    shellNav.indexOf("export const GROWTH_WORKSPACE_SHELL_OPERATOR_NAV_IDS"),
  )
  assert.match(intelligenceBlock, /id: "activity"/)
  assert.match(intelligenceBlock, /label: "Activity"/)
  assert.doesNotMatch(intelligenceBlock, /sendr\/activity/)

  const activityNav = buildGrowthWorkspaceShellNavGroups()
    .find((group) => group.id === "intelligence")
    ?.items.find((item) => item.id === "activity")
  assert.ok(activityNav)
  assert.equal(activityNav.href, GROWTH_ACTIVITY_WORKSPACE_PATH)
  assert.equal(isGrowthShellNavItemActive(GROWTH_ACTIVITY_WORKSPACE_PATH, activityNav), true)
  console.log("  ✓ activity registered in Intelligence sidebar with active state")

  console.log("\nActivity center 5B certification passed.\n")
}

main()
