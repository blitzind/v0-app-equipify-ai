/**
 * GROWTH-WORKSPACE-SIDEBAR-DISCOVERABILITY-1C — Revenue module sidebar discoverability.
 *
 * Run: pnpm test:growth-workspace-sidebar-discoverability-1c
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SHELL_NAV_GROUPS,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import {
  GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS,
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
  GROWTH_WORKSPACE_SIDEBAR_REVENUE_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER,
  GROWTH_WORKSPACE_SIDEBAR_DISCOVERABLE_REVENUE_MODULES,
} from "../lib/growth/workspace/growth-workspace-sidebar-discoverability"

export { GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER }

const ROOT = process.cwd()

const SIDEBAR_ACTIVE_STATE_CASES: Array<{ pathname: string; activeNavId: string }> = [
  { pathname: "/growth/conversations", activeNavId: "conversations" },
  { pathname: "/growth/opportunities", activeNavId: "opportunities" },
  { pathname: "/growth/opportunities/pipeline", activeNavId: "opportunities" },
  { pathname: "/growth/opportunities/workspace", activeNavId: "opportunities" },
  { pathname: "/growth/opportunities/readiness", activeNavId: "opportunities" },
  { pathname: "/growth/relationships", activeNavId: "relationships" },
]

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runNavRegression(script: string): void {
  execSync(`pnpm ${script}`, { cwd: ROOT, stdio: "inherit" })
}

function main(): void {
  console.log(
    `\n=== GROWTH-WORKSPACE-SIDEBAR-DISCOVERABILITY-1C (${GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER, "growth-workspace-sidebar-discoverability-1c-v1")
  console.log("  ✓ Discoverability marker")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  const navIds = navItems.map((item) => item.id)
  const navHrefs = navItems.map((item) => item.href)

  assert.equal(new Set(navIds).size, navIds.length, "duplicate sidebar nav ids")
  assert.equal(new Set(navHrefs).size, navHrefs.length, "duplicate sidebar nav hrefs")
  console.log("  ✓ No duplicate sidebar entries")

  const revenueGroup = GROWTH_SHELL_NAV_GROUPS.find((group) => group.id === "revenue")
  assert.ok(revenueGroup, "Revenue sidebar group must exist")
  assert.deepEqual(revenueGroup.items.map((item) => item.id), [...GROWTH_WORKSPACE_SIDEBAR_REVENUE_NAV_IDS])
  console.log("  ✓ Revenue group exposes Conversations, Opportunities, Relationships")

  for (const module of GROWTH_WORKSPACE_SIDEBAR_DISCOVERABLE_REVENUE_MODULES) {
    const navItem = navItems.find((item) => item.id === module.id)
    assert.ok(navItem, `${module.label} must appear in Growth sidebar`)
    assert.equal(navItem.label, module.label)
    assert.equal(navItem.href, module.href)
    assert.equal(navItem.registryRouteId, module.registryRouteId)
  }
  console.log("  ✓ Discoverable revenue modules resolve to existing workspace routes")

  const manifestNavIds = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id))
  assert.deepEqual(manifestNavIds, [...GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS])
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_GROUP_IDS.includes("revenue"))
  console.log("  ✓ Sidebar manifest and operator nav ids stay in sync")

  for (const { pathname, activeNavId } of SIDEBAR_ACTIVE_STATE_CASES) {
    const activeItems = navItems.filter((item) => isGrowthShellNavItemActive(pathname, item))
    assert.ok(
      activeItems.some((item) => item.id === activeNavId),
      `expected ${activeNavId} active for ${pathname}, got ${activeItems.map((item) => item.id).join(", ") || "(none)"}`,
    )
    assert.equal(activeItems.length, 1, `expected single active nav item for ${pathname}`)
  }
  console.log("  ✓ Active state works for Conversations, Opportunities, and Relationships")

  const sidebarNav = read("components/growth/shell/growth-sidebar-nav-content.tsx")
  const mobileDrawer = read("components/growth/shell/growth-mobile-nav-drawer.tsx")
  assert.match(sidebarNav, /GROWTH_SHELL_NAV_GROUPS/)
  assert.match(sidebarNav, /isGrowthShellNavItemActive/)
  assert.match(mobileDrawer, /GrowthSidebarNavContent/)
  assert.match(mobileDrawer, /mobile-sidebar-nav/)
  console.log("  ✓ Mobile sidebar still renders shared Growth nav content")

  console.log("\n  Running Growth nav regression suites…\n")
  runNavRegression("test:growth-workspace-sidebar-ia")
  runNavRegression("test:growth-workspace-sidebar-behavior")
  runNavRegression("test:growth-workspace-continuity")

  console.log("\n  Running launch polish + UX certification regression…\n")
  runNavRegression("test:growth-workspace-launch-polish-1b")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\nGROWTH-WORKSPACE-SIDEBAR-DISCOVERABILITY-1C verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SIDEBAR_DISCOVERABILITY_1C_QA_MARKER,
        revenue_modules: GROWTH_WORKSPACE_SIDEBAR_DISCOVERABLE_REVENUE_MODULES.map((entry) => entry.id),
        sidebar_items: navItems.length,
        sidebar_groups: GROWTH_SHELL_NAV_GROUPS.length,
      },
      null,
      2,
    ),
  )
}

main()
