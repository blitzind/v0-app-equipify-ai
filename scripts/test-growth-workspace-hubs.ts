/**
 * Growth workspace operator hub audit (Phase 7D — local only).
 *
 * Usage: pnpm test:growth-workspace-hubs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_CALLS_HUB_MANIFEST } from "../lib/growth/hubs/growth-calls-hub-manifest"
import { GROWTH_LEADS_HUB_MANIFEST } from "../lib/growth/hubs/growth-leads-hub-manifest"
import { GROWTH_OPPORTUNITIES_HUB_MANIFEST } from "../lib/growth/hubs/growth-opportunities-hub-manifest"
import { GROWTH_SHARE_PAGES_HUB_MANIFEST } from "../lib/growth/hubs/growth-share-pages-hub-manifest"
import {
  GROWTH_CALLS_HUB_WORKSPACE_HREF,
  GROWTH_LEADS_HUB_RESEARCH_HREF,
  GROWTH_SHARE_PAGES_HUB_MANAGE_HREF,
} from "../lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_HUB_QA_MARKER } from "../lib/growth/hubs/growth-workspace-hub-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import { GROWTH_SHELL_NAV_GROUPS } from "../lib/growth/navigation/growth-workspace-shell-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const HUB_PAGES = [
  { route: `${GROWTH_WORKSPACE_BASE_PATH}/leads`, file: "app/(growth)/growth/leads/page.tsx", manifest: GROWTH_LEADS_HUB_MANIFEST },
  { route: `${GROWTH_WORKSPACE_BASE_PATH}/calls`, file: "app/(growth)/growth/calls/page.tsx", manifest: GROWTH_CALLS_HUB_MANIFEST },
  {
    route: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`,
    file: "app/(growth)/growth/opportunities/page.tsx",
    manifest: GROWTH_OPPORTUNITIES_HUB_MANIFEST,
  },
  {
    route: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`,
    file: "app/(growth)/growth/share-pages/page.tsx",
    manifest: GROWTH_SHARE_PAGES_HUB_MANIFEST,
  },
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace hub audit (${GROWTH_WORKSPACE_HUB_QA_MARKER}) ===\n`)

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 12)
  console.log("  ✓ primary sidebar remains 12 items")

  for (const hub of HUB_PAGES) {
    const source = readSource(hub.file)
    assert.match(source, /GrowthWorkspaceHubPage/)
    assert.match(source, /manifest={/)
    const route = findGrowthRouteMetadataByPathname(hub.route)
    assert.ok(route, `missing registry route: ${hub.route}`)
    assert.equal(hub.manifest.quickActions.length > 0, true)
    assert.equal(hub.manifest.sections.length > 0, true)
  }
  console.log("  ✓ four hub pages render GrowthWorkspaceHubPage manifests")

  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_LEADS_HUB_RESEARCH_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_CALLS_HUB_WORKSPACE_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_SHARE_PAGES_HUB_MANAGE_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`))
  console.log("  ✓ drill-down routes registered for relocated operator surfaces")

  const pipelineCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`)
  assert.deepEqual(pipelineCrumbs.map((crumb) => crumb.label), ["Growth", "Opportunities", "Pipeline"])

  const templatesCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/share-pages/templates`)
  assert.deepEqual(templatesCrumbs.map((crumb) => crumb.label), ["Growth", "Share Pages", "Templates"])

  const researchCrumbs = resolveGrowthBreadcrumbs(GROWTH_LEADS_HUB_RESEARCH_HREF)
  assert.deepEqual(researchCrumbs.map((crumb) => crumb.label), ["Growth", "Leads", "Research Queue"])
  console.log("  ✓ pipeline, templates, and research breadcrumbs unchanged")

  const opportunitiesPipeline = GROWTH_OPPORTUNITIES_HUB_MANIFEST.quickActions.find((item) => item.id === "pipeline")
  assert.ok(opportunitiesPipeline?.href.endsWith("/opportunities/pipeline"))

  const shareTemplates = GROWTH_SHARE_PAGES_HUB_MANIFEST.sections.find((section) => section.id === "templates")
  assert.ok(shareTemplates?.drilldowns?.some((item) => item.href.endsWith("/share-pages/templates")))
  console.log("  ✓ hubs link to pipeline and templates drill-downs (not sidebar)")

  console.log("\nGrowth workspace hub audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_HUB_QA_MARKER,
        hubs: HUB_PAGES.length,
        sidebar_items: navItems.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
