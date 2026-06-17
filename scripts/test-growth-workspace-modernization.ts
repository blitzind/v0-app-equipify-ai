/**
 * Growth workspace shell modernization audit (Phase 6B — local only).
 *
 * Usage: pnpm test:growth-workspace-modernization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_SHELL_NAV_GROUPS,
  listGrowthWorkspaceShellNavHrefs,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_SEARCH_CATEGORIES } from "../lib/workspace/growth-workspace-search-categories"
import { WORKSPACE_SWITCHER_QA_MARKER } from "../components/workspace/workspace-switcher"
import { WORKSPACE_SEARCH_QA_MARKER } from "../components/workspace/workspace-search"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

export const GROWTH_WORKSPACE_MODERNIZATION_QA_MARKER = "growth-workspace-modernization-v1" as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertIncludes(relativePath: string, needle: string, message: string): void {
  assert.ok(read(relativePath).includes(needle), message)
}

function assertExcludes(relativePath: string, needle: string, message: string): void {
  assert.ok(!read(relativePath).includes(needle), message)
}

function runAudit(): void {
  console.log(`\n=== Growth workspace modernization audit (${GROWTH_WORKSPACE_MODERNIZATION_QA_MARKER}) ===\n`)

  assertExcludes(
    "components/growth/shell/growth-sidebar.tsx",
    "GROWTH_BRAND.name",
    "sidebar must not render Growth Engine title from brand constant",
  )
  assertExcludes(
    "components/growth/shell/growth-sidebar.tsx",
    "workspaceLabel",
    "sidebar must not render Workspace subtitle label",
  )
  assertExcludes(
    "components/growth/shell/growth-mobile-nav-drawer.tsx",
    "GROWTH_BRAND.name",
    "mobile drawer must not render Growth Engine title from brand constant",
  )
  assertIncludes(
    "components/growth/shell/growth-sidebar.tsx",
    "WorkspaceShellBrand",
    "sidebar must use shared WorkspaceShellBrand",
  )
  assertIncludes(
    "components/growth/shell/growth-mobile-nav-drawer.tsx",
    "WorkspaceShellBrand",
    "mobile drawer must use logo-only WorkspaceShellBrand",
  )
  console.log("  ✓ logo-only branding (no Growth Engine Workspace title)")

  assertIncludes("components/app-topbar.tsx", "WorkspaceSwitcher", "Core topbar must include WorkspaceSwitcher")
  assertIncludes("components/growth/shell/growth-topbar.tsx", "WorkspaceSwitcher", "Growth topbar must include WorkspaceSwitcher")
  assertIncludes(
    "components/workspace/workspace-switcher.tsx",
    WORKSPACE_SWITCHER_QA_MARKER,
    "WorkspaceSwitcher must expose QA marker",
  )
  console.log("  ✓ workspace switcher present in Core and Growth headers")

  assertIncludes("components/growth/shell/growth-topbar.tsx", 'workspace="growth"', "Growth topbar must mount growth WorkspaceSearch")
  assertIncludes("components/workspace/workspace-search.tsx", WORKSPACE_SEARCH_QA_MARKER, "WorkspaceSearch QA marker")
  assertIncludes("components/global-search-header.tsx", "WorkspaceSearch", "GlobalSearchHeader must delegate to WorkspaceSearch")
  assertIncludes(
    "components/workspace/global-search-panel.tsx",
    "GlobalSearchPanel",
    "shared GlobalSearchPanel must exist",
  )
  assertExcludes(
    "components/growth/shell/growth-topbar.tsx",
    "GlobalSearchHeader",
    "Growth must not mount duplicate GlobalSearchHeader",
  )
  console.log("  ✓ shared WorkspaceSearch / GlobalSearchPanel (no duplicate search UI)")

  assertIncludes(
    "components/growth/shell/growth-workspace-shell.tsx",
    "WorkspaceContainer",
    "Growth shell must use WorkspaceContainer",
  )
  assertIncludes(
    "components/workspace/workspace-container.tsx",
    "WORKSPACE_SHELL_QA_MARKER",
    "WorkspaceContainer must expose shell QA marker",
  )
  assertIncludes("components/page-shell.tsx", "WORKSPACE_SHELL_MAIN_INNER", "Core PageShell must share main inner rhythm")
  console.log("  ✓ shell spacing uses shared Core container tokens")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 15, "sidebar must contain exactly 15 items")
  const hrefs = listGrowthWorkspaceShellNavHrefs()
  assert.equal(hrefs.length, 15)
  assert.deepEqual(hrefs, [
    "/growth",
    "/growth/leads",
    "/growth/campaigns",
    "/growth/inbox",
    "/growth/calls",
    "/growth/meetings",
    "/growth/share-pages",
    "/growth/media",
    "/growth/share-pages/templates",
    "/growth/automation",
    "/growth/engagement",
    "/growth/opportunities",
    "/growth/opportunities/pipeline",
    "/growth/conversations",
    "/growth/relationships",
  ])
  console.log("  ✓ sidebar contains exactly 15 items with unchanged hrefs")

  assertIncludes(
    "components/growth/shell/growth-sidebar-nav-content.tsx",
    "NAV_ROW_ACTIVE_SIDEBAR",
    "Growth nav must use Core sidebar active tokens",
  )
  assertIncludes(
    "components/growth/shell/growth-sidebar-nav-content.tsx",
    "NAV_SIDEBAR_ACTIVE_INDICATOR",
    "Growth nav must use Core orange active rail",
  )
  assertIncludes(
    "components/growth/shell/growth-sidebar.tsx",
    "WORKSPACE_SIDEBAR_WIDTH_EXPANDED",
    "Growth sidebar expanded width must match Core",
  )
  assertIncludes(
    "components/growth/shell/growth-sidebar.tsx",
    "WORKSPACE_SIDEBAR_WIDTH_COLLAPSED",
    "Growth sidebar collapsed width must match Core",
  )
  console.log("  ✓ sidebar navigation styling mirrors Core chrome tokens")

  assert.equal(GROWTH_WORKSPACE_SEARCH_CATEGORIES.length, 11)
  assertIncludes(
    "lib/workspace/run-growth-workspace-search-client.ts",
    "runGrowthWorkspaceSearchClient",
    "growth search client orchestrator must exist",
  )
  console.log("  ✓ growth search category architecture (11 categories)")

  for (const shellFile of [
    "components/growth/shell/growth-sidebar.tsx",
    "components/growth/shell/growth-topbar.tsx",
    "components/growth/shell/growth-workspace-shell.tsx",
    "components/workspace/workspace-switcher.tsx",
  ]) {
    assertExcludes(shellFile, GROWTH_ADMIN_BASE_PATH, `${shellFile} must not hardcode admin paths`)
  }
  console.log("  ✓ admin paths not hardcoded in shell components")

  assertIncludes("components/growth/shell/growth-topbar.tsx", "md:hidden", "Growth topbar must include mobile menu")
  assertIncludes("components/workspace/global-search-panel.tsx", "hidden md:block", "search hidden on mobile like Core")
  assertIncludes("components/growth/shell/growth-sidebar.tsx", "hidden md:flex", "desktop sidebar hidden on mobile")
  console.log("  ✓ responsive layout assertions")

  console.log("\nGrowth workspace modernization audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_MODERNIZATION_QA_MARKER,
        sidebar_items: navItems.length,
        search_categories: GROWTH_WORKSPACE_SEARCH_CATEGORIES.length,
        shared_primitives: [
          "WorkspaceShellBrand",
          "WorkspaceSwitcher",
          "WorkspaceSearch",
          "WorkspaceContainer",
        ],
      },
      null,
      2,
    ),
  )
}

runAudit()
