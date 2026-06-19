/**
 * Growth Leads operator home UX audit (UX-AUDIT-4 — local only).
 *
 * Usage:
 *   pnpm test:growth-leads-operator-home
 *   pnpm test:growth-leads-operator-home:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_LEADS_HUB_CREATE_ACTIONS,
  GROWTH_LEADS_HUB_PIPELINE_METRICS,
  GROWTH_LEADS_HUB_REVENUE_QUEUE_CARDS,
  GROWTH_LEADS_HUB_UX_QA_MARKER,
  growthLeadsHubSavedSearchRunHref,
} from "../lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_LEADS_HUB_MANIFEST } from "../lib/growth/hubs/growth-leads-hub-manifest"
import {
  GROWTH_LEADS_HUB_METRICS_QA_MARKER,
  resolveGrowthLeadsContinueWorkingHref,
} from "../lib/growth/hubs/growth-leads-hub-metrics-client"
import {
  GROWTH_LEADS_HUB_RECOMMENDATIONS_QA_MARKER,
  buildGrowthLeadsHubRecommendations,
} from "../lib/growth/hubs/growth-leads-hub-recommendations"
import {
  GROWTH_LEADS_RECOMMENDATIONS_SNOOZE_QA_MARKER,
  GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY,
} from "../lib/growth/hubs/growth-leads-recommendations-snooze-memory"
import {
  GROWTH_LEADS_RECENT_WORK_QA_MARKER,
  GROWTH_LEADS_RECENT_WORK_STORAGE_KEY,
  formatGrowthLeadsActivityRelativeTime,
} from "../lib/growth/hubs/growth-leads-recent-work-memory"
import { GROWTH_LEADS_HUB_SEARCH_QA_MARKER } from "../lib/growth/hubs/growth-leads-hub-search-client"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_LEADS_OPERATOR_HOME_QA_MARKER = "growth-leads-operator-home-v4" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertSectionOrder(page: string): void {
  const jsx = page.split("export function GrowthLeadsHubPage")[1] ?? page
  const sections = [
    "<GrowthLeadsHubTodaysPipeline",
    "<GrowthLeadsHubRevenueQueueSummary",
    "<GrowthLeadsHubRecommendations",
    "<GrowthLeadsHubSearch",
    "<GrowthLeadsHubPrimaryActions",
    "<GrowthLeadsHubKpiStrip",
    "<GrowthLeadsHubOperatorLauncher",
    "<GrowthLeadsHubFavoriteSavedSearches",
    "<GrowthLeadsHubActivityTimeline",
  ]
  for (let i = 0; i < sections.length - 1; i += 1) {
    assert.ok(
      jsx.indexOf(sections[i + 1]!) > jsx.indexOf(sections[i]!),
      `expected ${sections[i]} before ${sections[i + 1]}`,
    )
  }
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Leads operator home audit (${GROWTH_LEADS_OPERATOR_HOME_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_LEADS_HUB_UX_QA_MARKER, "growth-leads-hub-operator-home-v5")
  assert.equal(GROWTH_LEADS_HUB_PIPELINE_METRICS.length, 4)
  assert.equal(GROWTH_LEADS_HUB_REVENUE_QUEUE_CARDS.length, 3)
  assert.equal(GROWTH_LEADS_HUB_CREATE_ACTIONS.length, 4)
  console.log("  ✓ UX marker v4 and operator home config")

  for (const action of [...GROWTH_LEADS_HUB_CREATE_ACTIONS, ...GROWTH_LEADS_HUB_PIPELINE_METRICS.map((m) => ({ href: m.href }))]) {
    assert.match(action.href, /^\/growth\//)
  }
  console.log("  ✓ create menu and pipeline routes stay inside /growth")

  assert.equal(GROWTH_LEADS_RECENT_WORK_STORAGE_KEY, "equipify:growth-leads-recent-work/v2")
  assert.equal(GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY, "equipify:growth-leads-recommendations-snoozed/v1")
  assert.equal(GROWTH_LEADS_RECENT_WORK_QA_MARKER, "growth-leads-recent-work-v2")
  assert.equal(GROWTH_LEADS_RECOMMENDATIONS_SNOOZE_QA_MARKER, "growth-leads-recommendations-snooze-v1")
  assert.match(formatGrowthLeadsActivityRelativeTime(new Date(Date.now() - 120_000).toISOString()), /m ago/)
  console.log("  ✓ activity timeline v2 and snooze storage keys")

  const recommendations = buildGrowthLeadsHubRecommendations({
    metrics: {
      queueDepth: 4,
      capturedToday: null,
      readyToCall: 2,
      researchRuns: 1,
      accountsAwaitingResearch: 3,
      needFollowUp: 1,
      leadsAwaitingResearch: 3,
      meetingsScheduled: 5,
      followUpsOverdue: 1,
      nextReadyCallLabel: "Acme Roofing",
    },
    savedSearches: [],
  })
  assert.ok(recommendations.every((item) => item.emoji && item.reason && item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  assert.match(recommendations[0]?.label ?? "", /Call Acme Roofing/)
  console.log("  ✓ deterministic recommendations include emoji, reason, and label")

  assert.equal(
    resolveGrowthLeadsContinueWorkingHref({
      queueDepth: null,
      capturedToday: null,
      readyToCall: 2,
      researchRuns: null,
      accountsAwaitingResearch: null,
      needFollowUp: null,
      leadsAwaitingResearch: null,
      meetingsScheduled: null,
      followUpsOverdue: null,
      nextReadyCallLabel: null,
    }),
    `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`,
  )
  console.log("  ✓ continue working CTA resolves from metrics")

  assert.match(
    growthLeadsHubSavedSearchRunHref("sample-id"),
    /^\/growth\/leads\/prospect-search\?savedSearchId=sample-id$/,
  )
  assert.ok(GROWTH_LEADS_HUB_MANIFEST.quickActions.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  assert.doesNotMatch(
    GROWTH_LEADS_HUB_MANIFEST.quickActions.map((item) => item.href).join("\n"),
    /\/admin\/growth/,
  )
  console.log("  ✓ manifest quick actions remain workspace-scoped")

  if (!production) {
    const page = readSource("components/growth/hubs/growth-leads-hub-page.tsx")
    const pipeline = readSource("components/growth/hubs/leads/growth-leads-hub-todays-pipeline.tsx")
    const revenue = readSource("components/growth/hubs/leads/growth-leads-hub-revenue-queue-summary.tsx")
    const recommendationsUi = readSource("components/growth/hubs/leads/growth-leads-hub-recommendations.tsx")
    const search = readSource("components/growth/hubs/leads/growth-leads-hub-search.tsx")
    const searchClient = readSource("lib/growth/hubs/growth-leads-hub-search-client.ts")
    const favorites = readSource("components/growth/hubs/leads/growth-leads-hub-favorite-saved-searches.tsx")
    const timeline = readSource("components/growth/hubs/leads/growth-leads-hub-activity-timeline.tsx")
    const createMenu = readSource("components/growth/hubs/leads/growth-leads-hub-create-menu.tsx")
    const config = readSource("lib/growth/hubs/growth-leads-hub-config.ts")

    assertSectionOrder(page)
    console.log("  ✓ page section order matches operator home IA")

    assert.match(page, /GrowthLeadsHubCreateMenu/)
    assert.match(createMenu, /GROWTH_LEADS_HUB_CREATE_ACTIONS/)
    assert.match(createMenu, /Popover/)
    console.log("  ✓ header create menu popover present")

    assert.match(pipeline, /Today's Pipeline/)
    assert.match(pipeline, /Continue Working/)
    assert.match(pipeline, /grid-cols-2 gap-3 lg:grid-cols-4/)
    console.log("  ✓ today's pipeline widget with responsive grid and CTA")

    assert.match(revenue, /Open Queue/)
    assert.match(revenue, /cursor-pointer/)
    assert.match(revenue, /focus-visible:ring/)
    console.log("  ✓ revenue queue summary cards are fully clickable")

    assert.match(recommendationsUi, /Snooze/)
    assert.match(recommendationsUi, /Open Lead/)
    assert.match(recommendationsUi, /snoozeGrowthLeadsRecommendation/)
    console.log("  ✓ recommendations render actionable cards with snooze")

    assert.match(search, /DEBOUNCE_MS/)
    assert.match(search, /role="combobox"/)
    assert.match(searchClient, /Contacts/)
    assert.match(searchClient, /Campaigns/)
    assert.match(searchClient, /Meetings/)
    assert.match(searchClient, /Share Pages/)
    assert.match(searchClient, /Videos/)
    assert.match(searchClient, /runGrowthWorkspaceSearchProviders/)
    console.log("  ✓ global search expanded categories reuse existing APIs")

    assert.match(favorites, /Favorite Saved Searches/)
    assert.match(favorites, /View All Saved Searches/)
    assert.match(favorites, /id="saved-searches"/)
    assert.match(favorites, /id="saved-searches-all"/)
    console.log("  ✓ favorite saved searches compact cards with view-all anchor")

    assert.match(timeline, /Activity Timeline/)
    assert.match(timeline, /formatGrowthLeadsActivityRelativeTime/)
    assert.match(config, /Your recent searches and lead activity will appear here/)
    console.log("  ✓ activity timeline replaces grouped recent work")

    assert.doesNotMatch(page, /\/admin\/growth/)
    assert.equal(fs.existsSync(path.join(ROOT, "components/growth/hubs/leads/growth-leads-hub-saved-searches.tsx")), false)
    assert.equal(fs.existsSync(path.join(ROOT, "components/growth/hubs/leads/growth-leads-hub-recent-work.tsx")), false)
    console.log("  ✓ no admin fallbacks; legacy sections removed")

    assert.equal(GROWTH_LEADS_HUB_SEARCH_QA_MARKER, "growth-leads-hub-search-v2")
    assert.equal(GROWTH_LEADS_HUB_METRICS_QA_MARKER, "growth-leads-hub-metrics-v2")
    assert.equal(GROWTH_LEADS_HUB_RECOMMENDATIONS_QA_MARKER, "growth-leads-hub-recommendations-v2")
    assert.equal(GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF, `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search`)
  }

  console.log("\nGrowth Leads operator home audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_LEADS_OPERATOR_HOME_QA_MARKER,
        hub_ux_marker: GROWTH_LEADS_HUB_UX_QA_MARKER,
        mode,
        pipeline_metrics: GROWTH_LEADS_HUB_PIPELINE_METRICS.length,
        create_actions: GROWTH_LEADS_HUB_CREATE_ACTIONS.length,
        recent_work_storage_key: GROWTH_LEADS_RECENT_WORK_STORAGE_KEY,
        snooze_storage_key: GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY,
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)
