/**
 * Growth opportunities workspace tab shell audit (Phase 7E — local only).
 *
 * Usage: pnpm test:growth-opportunities-tabs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_OPPORTUNITIES_TAB_SHELL_COMPONENT,
  GROWTH_OPPORTUNITIES_TAB_SHELL_PAGES,
} from "../lib/growth/navigation/growth-chrome-architecture"
import {
  GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER,
  GROWTH_OPPORTUNITIES_WORKSPACE_TABS,
  isGrowthOpportunitiesTabRoute,
  resolveGrowthOpportunitiesActiveTabId,
} from "../lib/growth/navigation/growth-opportunities-workspace-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth opportunities tab shell audit (${GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPPORTUNITIES_WORKSPACE_TABS.length, 3)
  assert.deepEqual(
    GROWTH_OPPORTUNITIES_WORKSPACE_TABS.map((tab) => tab.label),
    ["Overview", "Pipeline", "Readiness"],
  )
  console.log("  ✓ tab manifest defines Overview, Pipeline, and Readiness")

  const tabRoutes = [
    `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`,
    `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
    `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`,
  ] as const

  for (const route of tabRoutes) {
    assert.ok(isGrowthOpportunitiesTabRoute(route), `expected tab route: ${route}`)
    assert.ok(findGrowthRouteMetadataByPathname(route), `missing registry route: ${route}`)
    assert.ok(resolveGrowthOpportunitiesActiveTabId(route), `missing active tab for: ${route}`)
  }
  console.log("  ✓ tab routes resolve active states and registry metadata")

  assert.equal(
    isGrowthOpportunitiesTabRoute(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/workspace`),
    false,
  )
  console.log("  ✓ workspace drill-down remains outside tab shell")

  const layoutSource = readSource("app/(growth)/growth/opportunities/layout.tsx")
  assert.match(layoutSource, /GrowthOpportunitiesShell/)
  const shellSource = readSource(GROWTH_OPPORTUNITIES_TAB_SHELL_COMPONENT)
  assert.match(shellSource, /GROWTH_OPPORTUNITIES_WORKSPACE_TABS/)
  assert.match(shellSource, /cnDrawerTabButton/)
  console.log("  ✓ opportunities layout composes link-based tab shell")

  for (const page of GROWTH_OPPORTUNITIES_TAB_SHELL_PAGES) {
    const source = readSource(page)
    assert.doesNotMatch(source, /GrowthWorkspacePageHeader/, `${page} must not duplicate page header inside shell`)
  }
  console.log("  ✓ tab pages omit duplicate GrowthWorkspacePageHeader chrome")

  const overviewSource = readSource("app/(growth)/growth/opportunities/page.tsx")
  assert.match(overviewSource, /embedded/)
  console.log("  ✓ overview tab embeds hub body inside shared shell")

  const pipelineCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`)
  assert.deepEqual(pipelineCrumbs.map((crumb) => crumb.label), ["Growth", "Opportunities", "Pipeline"])

  const readinessCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`)
  assert.deepEqual(readinessCrumbs.map((crumb) => crumb.label), ["Growth", "Opportunities", "Readiness"])
  console.log("  ✓ pipeline and readiness breadcrumbs unchanged")

  const opportunitiesNav = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === "opportunities")
  assert.ok(opportunitiesNav)
  for (const route of tabRoutes) {
    assert.equal(isGrowthShellNavItemActive(route, opportunitiesNav), true, `sidebar should highlight Opportunities on ${route}`)
  }
  console.log("  ✓ sidebar highlights Opportunities on all tab routes")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 12)
  assert.equal(navItems.some((item) => item.label === "Pipeline"), false)
  console.log("  ✓ primary sidebar remains 12 items without Pipeline")

  const pipelineCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    "/admin/growth/opportunities/pipeline",
  )
  assert.equal(pipelineCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`)
  console.log("  ✓ Cmd+K rewrites admin pipeline route to workspace tab")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity unchanged")

  console.log("\nGrowth opportunities tab shell audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER,
        tabs: GROWTH_OPPORTUNITIES_WORKSPACE_TABS.length,
        sidebar_items: navItems.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
