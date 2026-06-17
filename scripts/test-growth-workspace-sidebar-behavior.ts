/**
 * Growth workspace sidebar behavior certification (Phase 6D hotfix — local only).
 *
 * Usage: pnpm test:growth-workspace-sidebar-behavior
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_SHELL_NAV_GROUPS,
  listGrowthWorkspaceShellNavHrefs,
} from "../components/growth/shell/growth-shell-navigation"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY,
  WORKSPACE_CORE_NAV_GROUP_STORAGE_KEY,
} from "../lib/workspace/workspace-sidebar-section-collapse"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

export const GROWTH_WORKSPACE_SIDEBAR_BEHAVIOR_QA_MARKER = "growth-workspace-sidebar-behavior-v1" as const

const FILES = {
  workspaceShell: "components/growth/shell/growth-workspace-shell.tsx",
  sidebar: "components/growth/shell/growth-sidebar.tsx",
  sidebarNav: "components/growth/shell/growth-sidebar-nav-content.tsx",
  mobileDrawer: "components/growth/shell/growth-mobile-nav-drawer.tsx",
  coreSidebar: "components/app-sidebar.tsx",
  sectionCollapse: "lib/workspace/workspace-sidebar-section-collapse.ts",
} as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertIncludes(relativePath: string, needle: string, message: string): void {
  assert.ok(read(relativePath).includes(needle), message)
}

function runAudit(): void {
  console.log(`\n=== Growth workspace sidebar behavior (${GROWTH_WORKSPACE_SIDEBAR_BEHAVIOR_QA_MARKER}) ===\n`)

  assertIncludes(FILES.workspaceShell, "WORKSPACE_SHELL_VIEWPORT_ROOT", "Growth shell must use viewport-height root layout token")
  assertIncludes(FILES.workspaceShell, "WORKSPACE_SHELL_VIEWPORT_BODY", "Growth shell must use viewport body flex wrapper with overflow constraint")
  console.log("  ✓ full-height viewport shell layout matches Core pattern")

  assertIncludes(FILES.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Growth sidebar must use shared surface token")
  assertIncludes(FILES.sidebar, "self-stretch", "Growth sidebar must stretch to shell body height")
  assertIncludes(FILES.sidebarNav, "flex-1 overflow-y-auto", "Growth nav must scroll internally")
  assertIncludes(FILES.sidebarNav, "mt-auto", "Growth footer must pin to bottom via mt-auto")
  console.log("  ✓ sidebar full-height layout with internal nav scroll and bottom-pinned footer")

  assertIncludes(FILES.sidebarNav, "ChevronDown", "Growth nav groups must use Core chevron collapse control")
  assertIncludes(FILES.sidebarNav, "aria-expanded", "Growth nav group headers must expose expanded state")
  assertIncludes(FILES.sidebarNav, "hidden={!collapsed && groupCollapsed}", "Collapsed groups must hide child links")
  assertIncludes(FILES.sidebarNav, "WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY", "Growth section collapse must persist locally")
  assertIncludes(FILES.sectionCollapse, "WORKSPACE_CORE_NAV_GROUP_STORAGE_KEY", "Core section collapse key documented for parity")
  console.log("  ✓ collapsible section groups with Core-matched UX and Growth-specific persistence")

  assert.equal(GROWTH_SHELL_NAV_GROUPS.length, 4, "Growth sidebar must retain four operator groups")
  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 15, "Growth sidebar must retain 15 operator nav items")
  assert.deepEqual(listGrowthWorkspaceShellNavHrefs().length, 15)
  console.log("  ✓ all four groups and 15 nav items remain present")

  assertIncludes(
    FILES.sidebarNav,
    "isGrowthShellNavItemActive(pathname, item)",
    "Active route detection must remain unchanged",
  )
  assertIncludes(FILES.sidebarNav, "next.delete(group.id)", "Active route must auto-expand owning group")
  console.log("  ✓ active routes expand parent groups by default")

  assertIncludes(FILES.mobileDrawer, "GrowthSidebarNavContent", "Mobile drawer must render shared nav content")
  assertIncludes(FILES.mobileDrawer, 'collapsed={false}', "Mobile drawer must expand sidebar rail while keeping group collapse")
  assertIncludes(FILES.mobileDrawer, "flex min-h-0 flex-1 flex-col overflow-hidden", "Mobile drawer nav column must scroll")
  assertIncludes(FILES.mobileDrawer, "WorkspaceSidebarOrganizationCard", "Mobile drawer must render org context under logo")
  console.log("  ✓ mobile drawer renders org card + collapsible groups through shared nav content")

  assertIncludes(FILES.sidebar, "WorkspaceSidebarOrganizationCard", "Growth sidebar must render org context under logo")
  assertIncludes(FILES.sidebar, "WORKSPACE_SIDEBAR_GROWTH_ORGANIZATION_PROPS", "Growth sidebar must use Growth org card props")
  assertIncludes(FILES.coreSidebar, "WorkspaceSidebarOrganizationCard", "Core sidebar must use shared org card primitive")
  console.log("  ✓ organization context card present in Growth + Core sidebars")

  for (const file of [FILES.sidebar, FILES.sidebarNav, FILES.mobileDrawer, FILES.workspaceShell]) {
    assert.ok(!read(file).includes(GROWTH_ADMIN_BASE_PATH), `${file} must not hardcode admin routes`)
  }
  console.log("  ✓ no admin routes surfaced in Growth shell nav")

  assertIncludes(FILES.coreSidebar, NAV_GROUP_STORAGE_KEY_LITERAL(), "Core sidebar must still persist section collapse")
  assertIncludes(FILES.coreSidebar, "flex-1 overflow-y-auto", "Core sidebar nav must still scroll internally")
  console.log("  ✓ Core sidebar section collapse + internal scroll intact (org card shared primitive)")

  console.log("\nGrowth workspace sidebar behavior certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SIDEBAR_BEHAVIOR_QA_MARKER,
        groups: GROWTH_SHELL_NAV_GROUPS.length,
        nav_items: navItems.length,
        growth_section_storage_key: WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY,
      },
      null,
      2,
    ),
  )
}

function NAV_GROUP_STORAGE_KEY_LITERAL(): string {
  return WORKSPACE_CORE_NAV_GROUP_STORAGE_KEY
}

runAudit()
