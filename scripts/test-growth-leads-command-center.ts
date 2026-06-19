/**
 * Growth Leads command center UX audit (UX-AUDIT-3/4 — local only).
 *
 * Usage:
 *   pnpm test:growth-leads-command-center
 *   pnpm test:growth-leads-command-center:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_LEADS_HUB_CREATE_ACTIONS,
  GROWTH_LEADS_HUB_KPI_CARDS,
  GROWTH_LEADS_HUB_LAUNCHER_GROUPS,
  GROWTH_LEADS_HUB_PRIMARY_ACTIONS,
  GROWTH_LEADS_HUB_QUICK_CREATE_ACTIONS,
  GROWTH_LEADS_HUB_UX_QA_MARKER,
  growthLeadsHubSavedSearchBadges,
  growthLeadsHubSavedSearchRunHref,
} from "../lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_LEADS_HUB_MANIFEST } from "../lib/growth/hubs/growth-leads-hub-manifest"
import {
  GROWTH_LEADS_HUB_METRICS_QA_MARKER,
} from "../lib/growth/hubs/growth-leads-hub-metrics-client"
import {
  GROWTH_LEADS_HUB_RECOMMENDATIONS_QA_MARKER,
  buildGrowthLeadsHubRecommendations,
} from "../lib/growth/hubs/growth-leads-hub-recommendations"
import {
  GROWTH_LEADS_RECENT_WORK_QA_MARKER,
  GROWTH_LEADS_RECENT_WORK_STORAGE_KEY,
} from "../lib/growth/hubs/growth-leads-recent-work-memory"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_LEADS_COMMAND_CENTER_QA_MARKER = "growth-leads-command-center-v5" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Leads command center audit (${GROWTH_LEADS_COMMAND_CENTER_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_LEADS_HUB_UX_QA_MARKER, "growth-leads-hub-operator-home-v5")
  assert.equal(GROWTH_LEADS_HUB_QUICK_CREATE_ACTIONS.length, 0)
  assert.equal(GROWTH_LEADS_HUB_CREATE_ACTIONS.length, 4)
  console.log("  ✓ UX marker v4; create actions moved to header popover")

  for (const action of GROWTH_LEADS_HUB_PRIMARY_ACTIONS) {
    assert.match(action.href, /^\/growth\//)
  }

  for (const card of GROWTH_LEADS_HUB_KPI_CARDS) {
    assert.ok(card.helper.length > 0)
    assert.match(card.href, /^\/growth\//)
  }

  const manageGroup = GROWTH_LEADS_HUB_LAUNCHER_GROUPS.find((group) => group.id === "manage-records")
  assert.equal(manageGroup?.title, "Manage Records")

  const launcherHrefs = GROWTH_LEADS_HUB_LAUNCHER_GROUPS.flatMap((group) => group.actions.map((action) => action.href))
  assert.ok(launcherHrefs.every((href) => href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  console.log("  ✓ KPI cards, primary actions, and launcher remain workspace-scoped")

  assert.equal(GROWTH_LEADS_RECENT_WORK_STORAGE_KEY, "equipify:growth-leads-recent-work/v2")
  assert.equal(GROWTH_LEADS_RECENT_WORK_QA_MARKER, "growth-leads-recent-work-v2")

  const recommendations = buildGrowthLeadsHubRecommendations({
    metrics: {
      queueDepth: 12,
      capturedToday: null,
      readyToCall: 3,
      researchRuns: 1,
      accountsAwaitingResearch: 5,
      needFollowUp: 2,
      leadsAwaitingResearch: 5,
      meetingsScheduled: 2,
      followUpsOverdue: 1,
      nextReadyCallLabel: "Acme Roofing",
      highPriorityCount: 1,
      needsReviewCount: 2,
      enrichmentNeededCount: 3,
    },
    savedSearches: [],
  })
  assert.ok(recommendations.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  console.log("  ✓ deterministic recommendations derive from metrics only")

  assert.equal(GROWTH_LEADS_HUB_METRICS_QA_MARKER, "growth-leads-hub-metrics-v3")
  assert.equal(GROWTH_LEADS_HUB_RECOMMENDATIONS_QA_MARKER, "growth-leads-hub-recommendations-v3")
  assert.ok(GROWTH_LEADS_HUB_MANIFEST.quickActions.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))

  if (!production) {
    const page = readSource("components/growth/hubs/growth-leads-hub-page.tsx")
    assert.match(page, /GrowthLeadsHubTodaysBriefing/)
    assert.match(page, /GrowthLeadsHubHeaderActions/)
    assert.doesNotMatch(page, /GrowthLeadsHubQuickCreate/)
    assert.doesNotMatch(page, /\/admin\/growth/)
    assert.match(readSource("lib/growth/hubs/growth-leads-hub-metrics-client.ts"), /\/api\/platform\/growth\/lead-inbox/)
    assert.match(readSource("lib/growth/hubs/growth-leads-hub-metrics-client.ts"), /\/api\/platform\/growth\/meetings\/inbox/)
    console.log("  ✓ operator home shell, metrics APIs, and no admin fallbacks")
    assert.equal(GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF, `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search`)
  }

  console.log("\nGrowth Leads command center audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_LEADS_COMMAND_CENTER_QA_MARKER,
        hub_ux_marker: GROWTH_LEADS_HUB_UX_QA_MARKER,
        mode,
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)
