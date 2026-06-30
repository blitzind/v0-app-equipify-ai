/**
 * GROWTH-WORKSPACE-ACTION-FIRST-1F — Action-before-metrics operator UX certification.
 *
 * Run: pnpm test:growth-workspace-action-first-1f
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ACTION_FIRST_AVA_IDLE,
  GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE,
  GROWTH_ACTION_FIRST_SUPPORTING_METRICS,
  GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER,
  GROWTH_ACTION_FIRST_1F_SURFACES,
} from "../lib/growth/workspace/growth-workspace-action-first-1f"

export { GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER }

const ROOT = process.cwd()

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist for action-first certification`)
  return fs.readFileSync(abs, "utf8")
}

function jsxIndex(source: string, marker: string): number {
  if (marker.startsWith("<") || marker.includes("=")) {
    return source.indexOf(marker)
  }
  return source.indexOf(`<${marker}`)
}

function assertOrderBefore(relativePath: string, earlier: string, later: string, label: string): void {
  const source = read(relativePath)
  const earlierIndex = jsxIndex(source, earlier)
  const laterIndex = jsxIndex(source, later)
  assert.ok(earlierIndex >= 0, `${relativePath} must include ${label} action section (${earlier})`)
  assert.ok(laterIndex >= 0, `${relativePath} must include ${label} metrics section (${later})`)
  assert.ok(
    earlierIndex < laterIndex,
    `${relativePath} must render ${label} actions before metrics (${earlier} before ${later})`,
  )
}

function main(): void {
  console.log(`\n=== GROWTH-WORKSPACE-ACTION-FIRST-1F (${GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER, "growth-workspace-action-first-1f-v1")
  assert.equal(GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE, "You're all caught up.")
  assert.equal(GROWTH_ACTION_FIRST_AVA_IDLE, "Ava doesn't need anything from you right now.")
  assert.equal(GROWTH_ACTION_FIRST_SUPPORTING_METRICS, "Supporting metrics")
  console.log("  ✓ Action-first marker and empty-state copy")

  for (const file of GROWTH_ACTION_FIRST_1F_SURFACES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
  }
  console.log("  ✓ All action-first surfaces present")

  assertOrderBefore(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
    "GrowthHomeExecutiveRecommendationSection",
    "GrowthHomeThroughputSection",
    "dashboard",
  )
  assert.match(
    read("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx"),
    /data-growth-action-first-order="actions-before-metrics"/,
  )
  console.log("  ✓ Dashboard executive briefing is action-first")

  assertOrderBefore(
    "components/growth/hubs/growth-leads-hub-page.tsx",
    "GrowthLeadsHubRecommendations",
    "GrowthLeadsHubKpiStrip",
    "leads",
  )
  console.log("  ✓ Leads hub prioritizes recommendations before KPI strip")

  assertOrderBefore(
    "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
    "GrowthInboxActionFirstStrip",
    "GrowthInboxResumeWorkHero",
    "inbox",
  )
  assert.match(read("components/growth/inbox/growth-inbox-action-first-strip.tsx"), /GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE/)
  console.log("  ✓ Inbox workspace leads with action strip")

  const hubPage = read("components/growth/hubs/growth-workspace-hub-page.tsx")
  assert.match(hubPage, /actionFirst\?: boolean/)
  assert.match(hubPage, /data-growth-action-first-order="actions-before-metrics"/)
  assert.ok(
    hubPage.indexOf("HubQuickActionsSection") < hubPage.indexOf('sectionId="supporting-metrics"'),
    "Hub action-first branch must render quick actions before supporting metrics",
  )
  assert.match(read("app/(growth)/growth/calls/page.tsx"), /actionFirst/)
  assert.match(read("app/(growth)/growth/opportunities/page.tsx"), /actionFirst/)
  console.log("  ✓ Calls and opportunities hubs use action-first ordering")

  assertOrderBefore(
    "components/growth/growth-call-copilot-dashboard.tsx",
    'data-section="calls-action-first"',
    'data-section="supporting-metrics"',
    "calls workspace",
  )
  console.log("  ✓ Calls copilot dashboard is action-first")

  assertOrderBefore(
    "components/growth/growth-opportunity-pipeline-dashboard.tsx",
    "title={GROWTH_OPPORTUNITIES_PIPELINE_HEALTH_TITLE}",
    'title="Pipeline analytics"',
    "opportunities pipeline",
  )
  console.log("  ✓ Opportunities pipeline keeps health/actions before analytics")

  assertOrderBefore(
    "components/growth/growth-conversations-dashboard.tsx",
    'data-section="conversations-action-first"',
    'data-section="supporting-metrics"',
    "conversations",
  )
  console.log("  ✓ Conversations dashboard is action-first")

  assertOrderBefore(
    "components/growth/growth-relationship-dashboard.tsx",
    'data-section="relationships-action-first"',
    'data-section="supporting-metrics"',
    "relationships",
  )
  console.log("  ✓ Relationships dashboard is action-first")

  assertOrderBefore(
    "components/growth/growth-meeting-intelligence-dashboard.tsx",
    'data-section="meetings-action-first"',
    'data-section="supporting-metrics"',
    "meetings",
  )
  console.log("  ✓ Meetings dashboard is action-first")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\n  Running GROWTH-WORKSPACE-OPERATOR-SIMPLIFICATION-1E regression…\n")
  execSync("pnpm test:growth-workspace-operator-simplification-1e", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running GROWTH-WORKSPACE-AVA-IDENTITY-1D regression…\n")
  execSync("pnpm test:growth-workspace-ava-identity-1d", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running GROWTH-WORKSPACE-UX-CERTIFICATION-1A regression…\n")
  execSync("pnpm test:growth-workspace-ux-certification-1a", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-ACTION-FIRST-1F verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER,
        surfaces: GROWTH_ACTION_FIRST_1F_SURFACES.length,
        empty_state: GROWTH_ACTION_FIRST_CAUGHT_UP_TITLE,
      },
      null,
      2,
    ),
  )
}

main()
