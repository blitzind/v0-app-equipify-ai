/**
 * Growth Campaigns command center UX audit (UX-AUDIT-6 — local only).
 *
 * Usage:
 *   pnpm test:growth-campaigns-command-center
 *   pnpm test:growth-campaigns-command-center:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_CAMPAIGNS_HUB_PERFORMANCE_METRICS,
  GROWTH_CAMPAIGNS_HUB_QUICK_LINKS,
  GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER,
} from "../lib/growth/hubs/growth-campaigns-hub-config"
import { GROWTH_CAMPAIGNS_HUB_MANIFEST } from "../lib/growth/hubs/growth-campaigns-hub-manifest"
import { GROWTH_CAMPAIGNS_HUB_METRICS_QA_MARKER } from "../lib/growth/hubs/growth-campaigns-hub-metrics-client"
import { buildGrowthCampaignsHubRecommendations } from "../lib/growth/hubs/growth-campaigns-hub-recommendations"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { growthFeaturePath } from "../lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_CAMPAIGNS_COMMAND_CENTER_QA_MARKER = "growth-campaigns-command-center-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const CAMPAIGNS_WORKSPACE_PATHS = [
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertNoAdminFallbacksInCampaignsSources(): void {
  const sources = [
    "components/growth/hubs/growth-campaigns-hub-page.tsx",
    "components/growth/hubs/campaigns/growth-campaigns-hub-header-actions.tsx",
    "components/growth/hubs/campaigns/growth-campaigns-hub-advanced-settings.tsx",
    "components/growth/hubs/campaigns/growth-campaigns-hub-my-tasks.tsx",
    "components/growth/hubs/campaigns/growth-campaigns-hub-active-campaigns.tsx",
    "app/(growth)/growth/campaigns/page.tsx",
    "app/(growth)/growth/campaigns/sequences/page.tsx",
    "app/(growth)/growth/campaigns/bookings/page.tsx",
  ]

  for (const file of sources) {
    assert.doesNotMatch(readSource(file), /\/admin\/growth/, `${file} still contains admin fallback`)
  }
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Campaigns command center audit (${GROWTH_CAMPAIGNS_COMMAND_CENTER_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER, "growth-campaigns-hub-operator-home-v1")
  assert.equal(GROWTH_CAMPAIGNS_HUB_METRICS_QA_MARKER, "growth-campaigns-hub-metrics-v1")
  assert.equal(GROWTH_CAMPAIGNS_HUB_PERFORMANCE_METRICS.length, 5)
  console.log("  ✓ UX + metrics markers")

  for (const href of CAMPAIGNS_WORKSPACE_PATHS) {
    assert.ok(findGrowthRouteMetadataByPathname(href), `missing route metadata for ${href}`)
  }
  console.log("  ✓ campaigns, sequences, and bookings routes registered")

  assert.equal(
    growthFeaturePath("/growth/campaigns", "sequences/execution"),
    GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
  )
  assert.equal(
    growthFeaturePath("/growth/campaigns", "booking-intelligence"),
    GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  )
  assert.equal(growthFeaturePath("/growth/campaigns", "multichannel"), GROWTH_CAMPAIGNS_HUB_HREF)
  console.log("  ✓ pathname-aware growthFeaturePath resolves campaigns workspace routes")

  for (const link of GROWTH_CAMPAIGNS_HUB_QUICK_LINKS) {
    assert.match(link.href, /^\/growth\//)
  }
  assert.ok(GROWTH_CAMPAIGNS_HUB_MANIFEST.quickActions.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))

  const recommendations = buildGrowthCampaignsHubRecommendations({
    prospectsEnteredToday: 14,
    prospectsNeedFollowUp: 8,
    meetingsBooked: 3,
    campaignsNeedAttention: 2,
    overdueFollowUps: 1,
    repliesAwaitingReview: 2,
    runningNormally: 4,
    needsAttention: 2,
    stalledCampaigns: 1,
    emailsSent: 120,
    openRate: 42,
    replyRate: 8,
    pipelineCreated: 15,
    channelTasksDue: 8,
    taskQueue: [],
    recentEvents: [],
    routingRules: [],
    channelPerformance: [],
  })
  assert.ok(recommendations.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  console.log("  ✓ deterministic recommendations remain workspace-scoped")

  if (!production) {
    const page = readSource("components/growth/hubs/growth-campaigns-hub-page.tsx")
    assert.match(page, /GrowthCampaignsHubTodaysBriefing/)
    assert.match(page, /GrowthCampaignsHubAdvancedSettings/)
    assert.match(readSource("lib/workspace/workspace-shell-tokens.ts"), /GROWTH_WORKSPACE_SHELL_MAIN_INNER/)
    assert.match(readSource("components/growth/shell/growth-workspace-shell.tsx"), /GROWTH_WORKSPACE_SHELL_MAIN_INNER/)
    assertNoAdminFallbacksInCampaignsSources()
    assert.doesNotMatch(readSource("components/growth/growth-multichannel-dashboard.tsx"), /href="\/admin\/growth\/sequences\/execution"/)
    assert.doesNotMatch(readSource("components/growth/growth-multichannel-dashboard.tsx"), /href="\/admin\/growth\/booking-intelligence"/)
    console.log("  ✓ operator home IA, leads footer shell token, and zero admin fallbacks under /growth/campaigns/*")
  }

  console.log("\nGrowth Campaigns command center audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_CAMPAIGNS_COMMAND_CENTER_QA_MARKER,
        hub_ux_marker: GROWTH_CAMPAIGNS_HUB_UX_QA_MARKER,
        mode,
        routes: CAMPAIGNS_WORKSPACE_PATHS,
      },
      null,
      2,
    ),
  )
}

const production = process.argv.includes("--production")
runAudit(production ? "production" : "local")
