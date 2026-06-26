/**
 * Growth workspace route audit (UX-AUDIT-1 — local inventory + regression guard).
 *
 * Usage:
 *   pnpm test:growth-workspace-route-audit
 *   pnpm test:growth-workspace-route-audit:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_CALLS_HUB_MANIFEST } from "../lib/growth/hubs/growth-calls-hub-manifest"
import { GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY } from "../lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { GROWTH_INBOX_HUB_MANIFEST } from "../lib/growth/hubs/growth-inbox-hub-manifest"
import {
  GROWTH_LEADS_HUB_MANIFEST,
  GROWTH_LEADS_HUB_SECONDARY_DESTINATIONS,
} from "../lib/growth/hubs/growth-leads-hub-manifest"
import { GROWTH_OPPORTUNITIES_HUB_MANIFEST } from "../lib/growth/hubs/growth-opportunities-hub-manifest"
import { GROWTH_SHARE_PAGES_HUB_MANIFEST } from "../lib/growth/hubs/growth-share-pages-hub-manifest"
import {
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_DISCOVER_HREF,
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
  GROWTH_LEADS_HUB_RESEARCH_HREF,
} from "../lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthWorkspaceHubManifest } from "../lib/growth/hubs/growth-workspace-hub-types"
import { resolveGrowthCommandPaletteHref } from "../lib/growth/navigation/growth-command-palette-derivation"
import { GROWTH_PROSPECT_SEARCH_DISCOVER_HREF } from "../lib/growth/navigation/growth-command-registry"
import {
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  findGrowthRouteMetadataByPathname,
} from "../lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "../lib/growth/navigation/growth-route-metadata-types"
import {
  growthProspectSearchHref,
  GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
  GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF,
} from "../lib/growth/navigation/growth-prospect-search-paths"
import { growthFeaturePath } from "../lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_WORKSPACE_ROUTE_AUDIT_QA_MARKER = "growth-workspace-route-audit-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

export type GrowthWorkspaceRouteAuditEntry = {
  sourceRoute: string
  action: string
  destinationRoute: string
  expectedRoute: string
  status: "workspace" | "admin_only" | "broken_fallback"
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function collectHubInventory(
  sourceRoute: string,
  manifest: GrowthWorkspaceHubManifest,
): GrowthWorkspaceRouteAuditEntry[] {
  const entries: GrowthWorkspaceRouteAuditEntry[] = []

  for (const action of manifest.quickActions) {
    entries.push(evaluateHref(sourceRoute, action.label, action.href, action.href))
  }

  for (const section of manifest.sections) {
    for (const drilldown of section.drilldowns ?? []) {
      entries.push(evaluateHref(sourceRoute, drilldown.label, drilldown.href, drilldown.href))
    }
  }

  return entries
}

function evaluateHref(
  sourceRoute: string,
  action: string,
  destinationRoute: string,
  expectedRoute: string,
): GrowthWorkspaceRouteAuditEntry {
  const onWorkspaceSource = sourceRoute.startsWith(GROWTH_WORKSPACE_BASE_PATH)
  let status: GrowthWorkspaceRouteAuditEntry["status"] = "workspace"

  if (destinationRoute.startsWith(GROWTH_ADMIN_BASE_PATH)) {
    status = onWorkspaceSource ? "broken_fallback" : "admin_only"
  } else if (!destinationRoute.startsWith(GROWTH_WORKSPACE_BASE_PATH)) {
    status = onWorkspaceSource ? "broken_fallback" : "admin_only"
  }

  return { sourceRoute, action, destinationRoute, expectedRoute, status }
}

function buildLeadsInventory(): GrowthWorkspaceRouteAuditEntry[] {
  const sourceRoute = `${GROWTH_WORKSPACE_BASE_PATH}/leads`
  const entries = collectHubInventory(sourceRoute, GROWTH_LEADS_HUB_MANIFEST)

  for (const dest of GROWTH_LEADS_HUB_SECONDARY_DESTINATIONS) {
    entries.push(evaluateHref(sourceRoute, dest.action, dest.href, dest.href))
  }

  entries.push(
    evaluateHref(
      sourceRoute,
      "Prospect Search (path helper)",
      growthProspectSearchHref(sourceRoute),
      GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
    ),
    evaluateHref(
      sourceRoute,
      "Discover Companies (path helper)",
      growthProspectSearchHref(sourceRoute, "discover"),
      GROWTH_LEADS_HUB_PROSPECT_SEARCH_DISCOVER_HREF,
    ),
    evaluateHref(
      sourceRoute,
      "Revenue Queue",
      GROWTH_LEADS_HUB_RESEARCH_HREF,
      GROWTH_LEADS_HUB_RESEARCH_HREF,
    ),
  )

  return entries
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth workspace route audit (${GROWTH_WORKSPACE_ROUTE_AUDIT_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  const leadsInventory = buildLeadsInventory()
  const broken = leadsInventory.filter((entry) => entry.status === "broken_fallback")
  assert.equal(broken.length, 0, `broken workspace fallbacks: ${JSON.stringify(broken, null, 2)}`)
  console.log(`  ✓ leads hub inventory (${leadsInventory.length} destinations, 0 broken fallbacks)`)

  for (const hub of [
    GROWTH_INBOX_HUB_MANIFEST,
    GROWTH_CALLS_HUB_MANIFEST,
    GROWTH_OPPORTUNITIES_HUB_MANIFEST,
    GROWTH_SHARE_PAGES_HUB_MANIFEST,
  ]) {
    const inventory = collectHubInventory(`${GROWTH_WORKSPACE_BASE_PATH}/${hub.id}`, hub)
    const hubBroken = inventory.filter((entry) => entry.status === "broken_fallback")
    assert.equal(hubBroken.length, 0, `${hub.id} broken: ${JSON.stringify(hubBroken)}`)
  }
  console.log("  ✓ inbox, calls, opportunities, share-pages hub links remain workspace-scoped")

  const conversationInventoryBroken = GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.filter(
    (entry) => entry.status === "workspace" && entry.workspaceRoute.startsWith(GROWTH_ADMIN_BASE_PATH),
  )
  assert.equal(conversationInventoryBroken.length, 0)
  const conversationWorkspaceSources = readSource("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.doesNotMatch(conversationWorkspaceSources, /href="\/admin\/growth/)
  console.log(
    `  ✓ inbox conversation workspace route inventory (${GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.length} destinations, 0 admin fallbacks)`,
  )

  assert.equal(growthProspectSearchHref("/growth/leads"), GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF)
  assert.equal(
    growthProspectSearchHref("/growth/leads", "discover"),
    GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
  )
  assert.equal(growthProspectSearchHref("/admin/growth/search"), `${GROWTH_ADMIN_BASE_PATH}/search`)
  assert.equal(
    growthProspectSearchHref("/admin/growth/search", "discover"),
    `${GROWTH_ADMIN_BASE_PATH}/search?mode=discover`,
  )
  console.log("  ✓ prospect search path helper is deterministic")

  assert.equal(
    resolveGrowthCommandPaletteHref("/growth/leads", GROWTH_PROSPECT_SEARCH_DISCOVER_HREF),
    GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
  )
  assert.equal(
    resolveGrowthCommandPaletteHref("/admin/growth/leads", GROWTH_PROSPECT_SEARCH_DISCOVER_HREF),
    GROWTH_PROSPECT_SEARCH_DISCOVER_HREF,
  )
  console.log("  ✓ command palette rewrites discover to workspace discover route")

  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF))
  console.log("  ✓ prospect search workspace routes registered")

  assert.equal(
    growthFeaturePath("/growth/leads", "leads/prospect-search"),
    GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF,
  )
  assert.equal(
    growthFeaturePath("/growth/leads", "leads/prospect-search/discover"),
    GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
  )
  console.log("  ✓ migrated prospect search segments resolve under /growth")

  if (!production) {
    const manifestSrc = readSource("lib/growth/hubs/growth-leads-hub-manifest.ts")
    assert.doesNotMatch(manifestSrc, /\/admin\/growth\//)
    assert.match(manifestSrc, /GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF/)

    const leadsPage = readSource("app/(growth)/growth/leads/page.tsx")
    assert.match(leadsPage, /GrowthLeadsHubPage/)

    assert.ok(fs.existsSync(path.join(ROOT, "app/(growth)/growth/leads/prospect-search/page.tsx")))
    assert.ok(fs.existsSync(path.join(ROOT, "app/(growth)/growth/leads/prospect-search/discover/page.tsx")))
    assert.ok(fs.existsSync(path.join(ROOT, "app/(growth)/growth/os/page.tsx")))
    assert.ok(
      fs.existsSync(path.join(ROOT, "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx")),
    )
    const inboxPanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
    assert.doesNotMatch(inboxPanel, /href="\/admin\/growth/)
    assert.match(inboxPanel, /GrowthInboxResumeWorkHero/)
    assert.doesNotMatch(inboxPanel, /GrowthOperatorInboxPanel/)
    console.log("  ✓ workspace page files, inbox panel, and manifest contain no admin fallbacks")
  }

  assert.ok(!fs.existsSync(path.join(ROOT, "app(growth)")), "erroneous root app(growth) folder must not exist")
  assert.ok(!fs.existsSync(path.join(ROOT, "app/growth)")), "erroneous app/growth) folder must not exist")
  console.log("  ✓ AI Operations + Mission Planning Review routes live under app/(growth)/growth/os/")

  const migratedCount = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.length
  assert.ok(migratedCount >= 65)
  console.log(`  ✓ migrated workspace registry (${migratedCount} routes)`)

  console.log("\nGrowth workspace route audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_ROUTE_AUDIT_QA_MARKER,
        mode,
        leads_inventory_count: leadsInventory.length,
        broken_fallback_count: broken.length,
        migrated_routes: migratedCount,
        sample_inventory: leadsInventory.slice(0, 8),
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)
