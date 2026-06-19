/**
 * Growth Leads hub UX audit (UX-AUDIT-4 — local only).
 *
 * Usage:
 *   pnpm test:growth-leads-ux
 *   pnpm test:growth-leads-ux:production
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
  growthLeadsHubSavedSearchRunHref,
} from "../lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_LEADS_HUB_MANIFEST } from "../lib/growth/hubs/growth-leads-hub-manifest"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(`\n=== Growth Leads hub UX audit (${GROWTH_LEADS_HUB_UX_QA_MARKER}${production ? " production" : ""}) ===\n`)

  assert.equal(GROWTH_LEADS_HUB_UX_QA_MARKER, "growth-leads-hub-operator-home-v5")
  assert.equal(GROWTH_LEADS_HUB_KPI_CARDS.length, 4)
  assert.equal(GROWTH_LEADS_HUB_QUICK_CREATE_ACTIONS.length, 0)
  assert.equal(GROWTH_LEADS_HUB_CREATE_ACTIONS.length, 4)
  assert.equal(GROWTH_LEADS_HUB_PRIMARY_ACTIONS.length, 2)

  for (const card of GROWTH_LEADS_HUB_KPI_CARDS) {
    assert.match(card.href, /^\/growth\//)
    assert.ok(card.helper.length > 0)
  }

  const launcherHrefs = GROWTH_LEADS_HUB_LAUNCHER_GROUPS.flatMap((group) => group.actions.map((action) => action.href))
  assert.ok(launcherHrefs.every((href) => href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  console.log("  ✓ operator launcher groups stay inside /growth")

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
    const jsx = page.split("export function GrowthLeadsHubPage")[1] ?? page
    assert.match(page, /GrowthLeadsHubTodaysBriefing/)
    assert.match(page, /GrowthLeadsHubHeaderActions/)
    assert.match(page, /GrowthLeadsHubActivityTimeline/)
    assert.match(page, /GrowthLeadsHubFavoriteSavedSearches/)
    assert.ok(jsx.indexOf("<GrowthLeadsHubTodaysPipeline") < jsx.indexOf("<GrowthLeadsHubSearch"))
    assert.ok(jsx.indexOf("<GrowthLeadsHubFavoriteSavedSearches") < jsx.indexOf("<GrowthLeadsHubActivityTimeline"))
    console.log("  ✓ page section order matches operator home IA")

    assert.match(readSource("components/growth/hubs/leads/growth-leads-hub-search.tsx"), /role="combobox"/)
    assert.match(readSource("lib/growth/hubs/growth-leads-hub-search-client.ts"), /Contacts/)
    assert.match(readSource("components/growth/hubs/leads/growth-leads-hub-recommendations.tsx"), /Snooze/)
    assert.doesNotMatch(page, /\/admin\/growth/)
    console.log("  ✓ search, recommendations, and routes verified locally")

    assert.ok(fs.existsSync(path.join(ROOT, "app/(growth)/growth/leads/prospect-search/page.tsx")))
    assert.equal(GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF, `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search`)
  }

  console.log("\nGrowth Leads hub UX audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_LEADS_HUB_UX_QA_MARKER,
        mode,
        kpi_cards: GROWTH_LEADS_HUB_KPI_CARDS.length,
        create_actions: GROWTH_LEADS_HUB_CREATE_ACTIONS.length,
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)
