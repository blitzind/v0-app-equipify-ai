/**
 * GROWTH-WORKSPACE-LAUNCH-POLISH-1B — Launch polish certification.
 *
 * Run: pnpm test:growth-workspace-launch-polish-1b
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER,
  GROWTH_WORKSPACE_LAUNCH_POLISH_HUB_MANIFESTS,
  GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES,
} from "../lib/growth/workspace/growth-workspace-launch-polish"
import {
  GROWTH_CALLS_HUB_MANIFEST,
} from "../lib/growth/hubs/growth-calls-hub-manifest"
import {
  GROWTH_OPPORTUNITIES_HUB_MANIFEST,
} from "../lib/growth/hubs/growth-opportunities-hub-manifest"
import {
  GROWTH_VIDEOS_HUB_MANIFEST,
} from "../lib/growth/hubs/growth-videos-hub-manifest"
import {
  GROWTH_SHARE_PAGES_HUB_MANIFEST,
} from "../lib/growth/hubs/growth-share-pages-hub-manifest"
import { GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT } from "../lib/growth/hubs/growth-workspace-hub-types"
import {
  PROSPECT_SEARCH_LEGACY_BUYING_COMMITTEE_PANEL_TITLE,
  PROSPECT_SEARCH_LEGACY_COMPANY_SIGNALS_TITLE,
  PROSPECT_SEARCH_LEGACY_CONTACT_DISCOVERY_COMMITTEE_TITLE,
} from "../lib/growth/prospect-search/prospect-search-engine-intelligence-ux"

export { GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER }

const ROOT = process.cwd()
const GROWTH_PAGES_ROOT = path.join(ROOT, "app/(growth)/growth")

const OPERATOR_LEGACY_SURFACES = [
  "app/(growth)/growth/leads/crm/page.tsx",
  "components/growth/leads/growth-leads-crm-workspace.tsx",
  "components/growth/sendr/growth-sendr-asset-picker-panel.tsx",
  "components/growth/sendr/growth-sendr-page-detail.tsx",
  "lib/growth/prospect-search/prospect-search-engine-intelligence-ux.ts",
  "components/growth/growth-sequence-execution-foundation-dashboard.tsx",
  "components/growth/growth-bulk-sequence-enrollment-dialog.tsx",
] as const

const HUB_OPERATOR_SURFACES = [
  "components/growth/hubs/growth-workspace-hub-page.tsx",
  "components/growth/hubs/leads/growth-leads-hub-kpi-strip.tsx",
  "components/growth/hubs/leads/growth-leads-hub-favorite-saved-searches.tsx",
  "components/growth/videos/growth-video-analytics-shell.tsx",
  "components/growth/growth-engagement-dashboard.tsx",
] as const

const FORBIDDEN_LEGACY_COPY = [/\bLegacy\b/, /\blegacy CRM/i, /Legacy CRM/, /\bdeprecated\b/i] as const

const PAGE_TITLE_FILES: Array<{ file: string; title: string }> = [
  { file: "app/(growth)/growth/conversations/page.tsx", title: GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES.conversations },
  { file: "app/(growth)/growth/relationships/page.tsx", title: GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES.relationships },
  { file: "app/(growth)/growth/meetings/page.tsx", title: GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES.meetings },
  { file: "app/(growth)/growth/leads/crm/page.tsx", title: GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES.leadRecords },
]

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function listGrowthPageFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...listGrowthPageFiles(full))
    else if (entry.name === "page.tsx") results.push(full)
  }
  return results
}

function relativeFromRoot(absPath: string): string {
  return path.relative(ROOT, absPath).split(path.sep).join("/")
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
}

function main(): void {
  console.log(`\n=== GROWTH-WORKSPACE-LAUNCH-POLISH-1B (${GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER, "growth-workspace-launch-polish-1b-v1")
  console.log("  ✓ Launch polish marker")

  for (const file of OPERATOR_LEGACY_SURFACES) {
    const visible = stripComments(read(file))
    for (const pattern of FORBIDDEN_LEGACY_COPY) {
      assert.doesNotMatch(visible, pattern, `${file} must not expose legacy terminology (${pattern})`)
    }
  }
  console.log("  ✓ Operator surfaces free of legacy terminology")

  assert.doesNotMatch(PROSPECT_SEARCH_LEGACY_COMPANY_SIGNALS_TITLE, /Legacy/i)
  assert.doesNotMatch(PROSPECT_SEARCH_LEGACY_CONTACT_DISCOVERY_COMMITTEE_TITLE, /legacy/i)
  assert.doesNotMatch(PROSPECT_SEARCH_LEGACY_BUYING_COMMITTEE_PANEL_TITLE, /Legacy/i)
  console.log("  ✓ Prospect search intelligence panels use customer-safe titles")

  const hubPage = read("components/growth/hubs/growth-workspace-hub-page.tsx")
  assert.doesNotMatch(hubPage, /value="—"/)
  assert.match(hubPage, /GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT|emptyValue/)
  assert.match(hubPage, /Nothing to show here yet/)
  console.log("  ✓ Hub overview uses contextual empty metrics (no bare dashes)")

  for (const manifestPath of GROWTH_WORKSPACE_LAUNCH_POLISH_HUB_MANIFESTS) {
    const src = read(manifestPath)
    assert.match(src, /emptyValue:/, `${manifestPath} overview metrics must define emptyValue`)
    assert.doesNotMatch(src, /value="—"/, `${manifestPath} must not hardcode dash metrics`)
  }
  console.log("  ✓ All hub manifests ship emptyValue on overview metrics")

  const hubManifests = [
    GROWTH_CALLS_HUB_MANIFEST,
    GROWTH_OPPORTUNITIES_HUB_MANIFEST,
    GROWTH_VIDEOS_HUB_MANIFEST,
    GROWTH_SHARE_PAGES_HUB_MANIFEST,
  ]
  for (const manifest of hubManifests) {
    for (const metric of manifest.overview) {
      assert.ok(metric.emptyValue && metric.emptyValue.length > 0, `${manifest.id}/${metric.id} missing emptyValue`)
      assert.notEqual(metric.emptyValue, "—")
    }
  }
  assert.equal(GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT, "No activity yet")
  console.log("  ✓ Hub manifest empty values are non-dash guidance copy")

  for (const { file, title } of PAGE_TITLE_FILES) {
    const src = read(file)
    assert.match(src, new RegExp(`title="${title}"`), `${file} page title must be "${title}"`)
  }
  console.log("  ✓ Page titles align with nav labels (Conversations, Relationships, Meetings, Lead Records)")

  for (const file of HUB_OPERATOR_SURFACES) {
    const visible = stripComments(read(file))
    assert.doesNotMatch(visible, /value="—"/, `${file} must not render bare dash stat tiles`)
    assert.doesNotMatch(visible, /value=\{[^}]*"—"/, `${file} must not render bare dash stat tiles`)
  }
  console.log("  ✓ Hub KPI and analytics surfaces avoid bare dash placeholders")

  const pageFiles = listGrowthPageFiles(GROWTH_PAGES_ROOT)
  assert.ok(pageFiles.length >= 100, `Expected 100+ Growth routes, found ${pageFiles.length}`)
  for (const pageFile of pageFiles) {
    const rel = relativeFromRoot(pageFile)
    const visible = stripComments(read(rel))
    if (rel.includes("/sendr/") && visible.includes("redirect")) continue
    if (visible.includes("LegacyGrowth") || visible.includes("LegacyRedirect")) continue
    for (const pattern of FORBIDDEN_LEGACY_COPY) {
      assert.doesNotMatch(visible, pattern, `${rel} must not expose legacy terminology in UI copy`)
    }
  }
  console.log("  ✓ Growth route pages free of user-visible legacy terminology")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\n  Running GROWTH-WORKSPACE-UX-CERTIFICATION-1A regression…\n")
  execSync("pnpm test:growth-workspace-ux-certification-1a", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-LAUNCH-POLISH-1B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_LAUNCH_POLISH_1B_QA_MARKER,
        hub_manifests: GROWTH_WORKSPACE_LAUNCH_POLISH_HUB_MANIFESTS.length,
        growth_routes: pageFiles.length,
        page_titles: GROWTH_WORKSPACE_LAUNCH_POLISH_PAGE_TITLES,
      },
      null,
      2,
    ),
  )
}

main()
