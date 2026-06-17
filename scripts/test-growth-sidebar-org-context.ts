/**
 * Growth sidebar organization context certification (Phase 6G — local only).
 *
 * Usage: pnpm test:growth-sidebar-org-context
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
  WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL,
  WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR,
} from "../lib/workspace/workspace-shell-tokens"

const WORKSPACE_SIDEBAR_ORGANIZATION_CARD_QA_MARKER = "workspace-sidebar-organization-card-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

export const GROWTH_SIDEBAR_ORG_CONTEXT_QA_MARKER = "growth-sidebar-org-context-v1" as const

const FILES = {
  orgCard: "components/workspace/workspace-sidebar-organization-card.tsx",
  coreSidebar: "components/app-sidebar.tsx",
  growthSidebar: "components/growth/shell/growth-sidebar.tsx",
  growthMobileDrawer: "components/growth/shell/growth-mobile-nav-drawer.tsx",
  growthSidebarNav: "components/growth/shell/growth-sidebar-nav-content.tsx",
  tokens: "lib/workspace/workspace-shell-tokens.ts",
} as const

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
  console.log(`\n=== Growth sidebar organization context (${GROWTH_SIDEBAR_ORG_CONTEXT_QA_MARKER}) ===\n`)

  assertIncludes(FILES.orgCard, WORKSPACE_SIDEBAR_ORGANIZATION_CARD_QA_MARKER, "org card must expose QA marker")
  assertIncludes(FILES.orgCard, "useTenant()", "org card must read active workspace from tenant store")
  assertIncludes(FILES.orgCard, "useActiveOrganization()", "org card must read organizations from active org context")
  assertIncludes(FILES.orgCard, "{workspace.name}", "org card must render dynamic organization name")
  assertExcludes(FILES.orgCard, "Precision Biomedical", "org card must not hardcode organization name")
  assertExcludes(FILES.orgCard, "Equipify Demo", "org card must not hardcode organization name")
  console.log("  ✓ shared org card uses tenant + active organization context (no hardcoded org)")

  assert.equal(WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL, "Growth Engine")
  assert.equal(WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR, "var(--plan-scale-accent)")
  assertIncludes(
    FILES.orgCard,
    "WORKSPACE_SIDEBAR_GROWTH_ORGANIZATION_PROPS",
    "Growth org card props must bind Growth Engine label + Scale accent",
  )
  assertIncludes(FILES.orgCard, 'secondaryLabel: WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL', "Growth org card props use Growth Engine label token")
  assertIncludes(FILES.orgCard, "secondaryLabelColor: WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR", "Growth org card props use Scale accent token")
  assertIncludes(FILES.tokens, "WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL", "Growth Engine label token exported")
  assertIncludes(FILES.tokens, "WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR", "Scale accent color token exported")
  console.log("  ✓ Growth Engine label + Scale accent tokens defined")

  assertIncludes(FILES.coreSidebar, "WorkspaceSidebarOrganizationCard", "Core sidebar must consume shared org card")
  assertIncludes(FILES.coreSidebar, "secondaryLabel={planMeta.label}", "Core must pass plan tier as secondary label")
  assertIncludes(FILES.coreSidebar, "secondaryLabelColor={planMeta.color}", "Core must pass plan accent color")
  console.log("  ✓ Core sidebar refactored to shared org card")

  assertIncludes(
    FILES.growthSidebar,
    "WorkspaceSidebarOrganizationCard",
    "Growth sidebar must render org card under logo",
  )
  assertIncludes(
    FILES.growthSidebar,
    "WORKSPACE_SIDEBAR_GROWTH_ORGANIZATION_PROPS",
    "Growth sidebar must use Growth org card props",
  )
  assertIncludes(FILES.growthSidebar, "collapsed={collapsed}", "Growth org card must respect sidebar collapse state")
  assertIncludes(
    FILES.growthMobileDrawer,
    "WorkspaceSidebarOrganizationCard",
    "Growth mobile drawer must render org card under logo",
  )
  assertIncludes(FILES.growthMobileDrawer, 'collapsed={false}', "Mobile drawer org card must stay expanded")
  console.log("  ✓ Growth desktop + mobile render org card below logo")

  const growthSidebar = read(FILES.growthSidebar)
  const brandIndex = growthSidebar.indexOf("WorkspaceShellBrand")
  const orgIndex = growthSidebar.indexOf("WorkspaceSidebarOrganizationCard")
  const navIndex = growthSidebar.indexOf("GrowthSidebarNavContent")
  assert.ok(brandIndex >= 0 && orgIndex > brandIndex, "Org card must appear after logo brand")
  assert.ok(navIndex > orgIndex, "Nav content must appear after org card")
  console.log("  ✓ org card positioned between logo and navigation groups")

  assertIncludes(FILES.orgCard, "truncate", "Org card must preserve name truncation")
  assertIncludes(FILES.orgCard, "rounded-xl", "Org card must match Core border radius")
  assertIncludes(FILES.orgCard, "h-8 w-8", "Org card avatar sizing must match Core")
  assertIncludes(FILES.orgCard, "title={collapsed ? workspace.name : undefined}", "Collapsed org card exposes name tooltip")
  console.log("  ✓ org card styling + collapsed tooltip parity")

  const navItems = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items)
  assert.equal(navItems.length, 15, "Growth sidebar must retain 15 operator nav items")
  assert.equal(listGrowthWorkspaceShellNavHrefs().length, 15)
  assertIncludes(FILES.growthSidebarNav, "flex-1 overflow-y-auto", "Nav scroll region unchanged")
  assertIncludes(FILES.growthSidebarNav, "mt-auto", "Footer pin unchanged")
  console.log("  ✓ 15 nav items + full-height sidebar behavior preserved")

  for (const file of Object.values(FILES)) {
    assertExcludes(file, GROWTH_ADMIN_BASE_PATH, `${file} must not hardcode admin routes`)
  }
  assertExcludes(FILES.growthSidebar, "middleware", "Growth sidebar must not touch middleware")
  console.log("  ✓ no route/auth/middleware/API changes in org context wiring")

  console.log("\n  Mobile behavior note:")
  console.log("    - Core mobile drawer renders SidebarBody (includes org card)")
  console.log("    - Growth mobile drawer renders org card + shared nav content (equivalent)")

  console.log("\nGrowth sidebar organization context certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SIDEBAR_ORG_CONTEXT_QA_MARKER,
        org_card_marker: WORKSPACE_SIDEBAR_ORGANIZATION_CARD_QA_MARKER,
        growth_label: WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL,
        accent_color: WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR,
        nav_items: navItems.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
