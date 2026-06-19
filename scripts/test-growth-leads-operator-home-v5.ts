/**
 * Growth Leads operator home UX audit v5 (UX-AUDIT-5 — local only).
 *
 * Usage:
 *   pnpm test:growth-leads-operator-home-v5
 *   pnpm test:growth-leads-operator-home-v5:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildGrowthLeadsBriefingLines,
  formatGrowthLeadsBriefingHeadline,
  formatGrowthLeadsTimeGreeting,
  resolveGrowthLeadsContinueWorkingHref,
} from "../lib/growth/hubs/growth-leads-hub-briefing-utils"
import {
  GROWTH_LEADS_HUB_CREATE_ACTIONS,
  GROWTH_LEADS_HUB_KEYBOARD_HINTS,
  GROWTH_LEADS_HUB_UX_QA_MARKER,
  growthLeadsHubRevenueQueueCardDetails,
  growthLeadsHubSavedSearchResultDeltaLabel,
} from "../lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_LEADS_HUB_MANIFEST } from "../lib/growth/hubs/growth-leads-hub-manifest"
import { buildGrowthLeadsHubRecommendations } from "../lib/growth/hubs/growth-leads-hub-recommendations"
import { buildGrowthLeadsOperatorHealthItems } from "../lib/growth/hubs/growth-leads-hub-operator-health"
import { buildGrowthLeadsResumeSessionView } from "../lib/growth/hubs/growth-leads-hub-resume-session-utils"
import {
  GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY,
} from "../lib/growth/hubs/growth-leads-recommendations-snooze-memory"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_LEADS_OPERATOR_HOME_V5_QA_MARKER = "growth-leads-operator-home-v5" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertSectionOrder(page: string): void {
  const jsx = page.split("export function GrowthLeadsHubPage")[1] ?? page
  const sections = [
    "<GrowthLeadsHubTodaysBriefing",
    "<GrowthLeadsHubResumeSession",
    "<GrowthLeadsHubRevenueQueueSummary",
    "<GrowthLeadsHubOperatorHealth",
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
    `\n=== Growth Leads operator home v5 audit (${GROWTH_LEADS_OPERATOR_HOME_V5_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_LEADS_HUB_UX_QA_MARKER, "growth-leads-hub-operator-home-v5")
  assert.equal(GROWTH_LEADS_HUB_CREATE_ACTIONS.length, 4)
  assert.equal(GROWTH_LEADS_HUB_CREATE_ACTIONS[3]?.label, "Research Run")
  assert.equal(GROWTH_LEADS_HUB_KEYBOARD_HINTS.length, 3)
  console.log("  ✓ UX marker v5, New menu, and keyboard hints")

  for (const action of GROWTH_LEADS_HUB_CREATE_ACTIONS) {
    assert.match(action.href, /^\/growth\//)
  }

  const metrics = {
    queueDepth: 10,
    capturedToday: null,
    readyToCall: 9,
    researchRuns: 1,
    accountsAwaitingResearch: 18,
    needFollowUp: 6,
    leadsAwaitingResearch: 18,
    meetingsScheduled: 4,
    followUpsOverdue: 4,
    nextReadyCallLabel: "Acme Roofing",
    highPriorityCount: 3,
    needsReviewCount: 8,
    enrichmentNeededCount: 10,
  }

  assert.match(formatGrowthLeadsTimeGreeting(new Date("2026-06-18T14:00:00")), /Good afternoon/)
  assert.equal(formatGrowthLeadsBriefingHeadline("Michael"), "Good afternoon, Michael")
  assert.ok(buildGrowthLeadsBriefingLines(metrics).length > 0)
  assert.equal(resolveGrowthLeadsContinueWorkingHref(metrics), `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`)
  console.log("  ✓ Today's Briefing greeting, lines, and continue routing priority")

  const resume = buildGrowthLeadsResumeSessionView({
    id: "x",
    verb: "Ran",
    label: "Mid-Market SaaS",
    href: `${GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}?savedSearchId=abc`,
    viewedAt: new Date().toISOString(),
  })
  assert.equal(resume?.category, "Saved Search")
  console.log("  ✓ Resume Last Session restore mapping")

  const revenueDetails = growthLeadsHubRevenueQueueCardDetails("ready-to-call", metrics)
  assert.match(revenueDetails.primary, /9 accounts/)
  assert.match(revenueDetails.secondary, /3 high priority/)
  assert.match(revenueDetails.tertiary, /4 overdue/)
  console.log("  ✓ Revenue Queue urgency indicators")

  const recommendations = buildGrowthLeadsHubRecommendations({ metrics, savedSearches: [] })
  assert.ok(recommendations.every((item) => item.severity && item.timestampLabel && item.detail))
  assert.match(recommendations[0]?.label ?? "", /Call Acme Roofing/)
  console.log("  ✓ Recommendations work inbox rendering")

  assert.equal(GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY, "equipify:growth-leads-recommendations-snoozed/v1")

  const delta = growthLeadsHubSavedSearchResultDeltaLabel({
    id: "x",
    created_at: "",
    updated_at: "",
    created_by: null,
    name: "Roofing",
    query_text: "",
    filters: {},
    metadata: {},
    workflow: {
      resultCount: 682,
      previousResultCount: 670,
      countDelta: 12,
      lastRefreshedAt: null,
      page: null,
      pageSize: null,
      savePagination: false,
      ownerLabel: null,
      discoveryMode: "internal",
      territoryOpportunityCount: null,
      previousTerritoryOpportunityCount: null,
      territoryOpportunityDelta: null,
      bestTerritoryBucket: null,
      territoryOpportunityScore: null,
      previousTerritoryOpportunityScore: null,
      territoryOpportunityScoreDelta: null,
    },
  })
  assert.equal(delta, "12 new since yesterday")
  console.log("  ✓ Saved search delta derivation")

  const health = buildGrowthLeadsOperatorHealthItems(metrics)
  assert.equal(health.length, 3)
  assert.equal(health.find((item) => item.id === "research-queue")?.status, "yellow")
  assert.equal(health.find((item) => item.id === "call-queue")?.status, "yellow")
  assert.equal(health.find((item) => item.id === "follow-ups")?.status, "yellow")
  console.log("  ✓ Operator Health thresholds")

  assert.ok(GROWTH_LEADS_HUB_MANIFEST.quickActions.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  assert.doesNotMatch(
    GROWTH_LEADS_HUB_MANIFEST.quickActions.map((item) => item.href).join("\n"),
    /\/admin\/growth/,
  )

  if (!production) {
    const page = readSource("components/growth/hubs/growth-leads-hub-page.tsx")
    const briefing = readSource("components/growth/hubs/leads/growth-leads-hub-todays-briefing.tsx")
    const resumeUi = readSource("components/growth/hubs/leads/growth-leads-hub-resume-session.tsx")
    const healthUi = readSource("components/growth/hubs/leads/growth-leads-hub-operator-health.tsx")
    const header = readSource("components/growth/hubs/leads/growth-leads-hub-header-actions.tsx")
    const recommendationsUi = readSource("components/growth/hubs/leads/growth-leads-hub-recommendations.tsx")
    const revenue = readSource("components/growth/hubs/leads/growth-leads-hub-revenue-queue-summary.tsx")
    const favorites = readSource("components/growth/hubs/leads/growth-leads-hub-favorite-saved-searches.tsx")

    assertSectionOrder(page)
    assert.match(page, /GrowthLeadsHubHeaderActions/)
    assert.match(briefing, /Today&apos;s briefing|Today's briefing/)
    assert.match(briefing, /Continue Working/)
    assert.match(resumeUi, /Resume where you left off/)
    assert.match(healthUi, /operator-health/)
    assert.match(header, /\n            New\n/)
    assert.match(header, /GROWTH_LEADS_HUB_KEYBOARD_HINTS/)
    assert.match(readSource("lib/growth/hubs/growth-leads-hub-config.ts"), /⌘K/)
    assert.match(recommendationsUi, /data-recommendation-severity/)
    assert.match(recommendationsUi, /Snooze/)
    assert.match(revenue, /growthLeadsHubRevenueQueueCardDetails/)
    assert.match(favorites, /growthLeadsHubSavedSearchResultDeltaLabel/)
    assert.doesNotMatch(page, /\/admin\/growth/)
    assert.equal(fs.existsSync(path.join(ROOT, "components/growth/hubs/leads/growth-leads-hub-todays-pipeline.tsx")), false)
    assert.equal(fs.existsSync(path.join(ROOT, "components/growth/hubs/leads/growth-leads-hub-create-menu.tsx")), false)
    console.log("  ✓ page IA, components, accessibility hooks, and no admin fallbacks")
  }

  console.log("\nGrowth Leads operator home v5 audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_LEADS_OPERATOR_HOME_V5_QA_MARKER,
        hub_ux_marker: GROWTH_LEADS_HUB_UX_QA_MARKER,
        mode,
        snooze_storage_key: GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY,
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)
