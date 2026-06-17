/**
 * Growth workspace UX parity certification (Phase 6E — local only).
 *
 * Usage: pnpm test:growth-workspace-ux-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_WORKSPACE_UX_PARITY_QA_MARKER,
  WORKSPACE_SHELL_SHARED_NAV_TOKENS,
  WORKSPACE_SHELL_SHARED_PRIMITIVES,
  WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS,
} from "../lib/workspace/workspace-shell-parity"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const CORE = {
  sidebar: "components/app-sidebar.tsx",
  topbar: "components/app-topbar.tsx",
  pageShell: "components/page-shell.tsx",
  globalSearchHeader: "components/global-search-header.tsx",
} as const

const GROWTH = {
  workspaceShell: "components/growth/shell/growth-workspace-shell.tsx",
  sidebar: "components/growth/shell/growth-sidebar.tsx",
  sidebarNav: "components/growth/shell/growth-sidebar-nav-content.tsx",
  topbar: "components/growth/shell/growth-topbar.tsx",
  mobileDrawer: "components/growth/shell/growth-mobile-nav-drawer.tsx",
  breadcrumbs: "components/growth/shell/growth-breadcrumbs.tsx",
} as const

const SHARED = {
  tokens: "lib/workspace/workspace-shell-tokens.ts",
  container: "components/workspace/workspace-container.tsx",
  search: "components/workspace/workspace-search.tsx",
  searchPanel: "components/workspace/global-search-panel.tsx",
  switcher: "components/workspace/workspace-switcher.tsx",
  skipLink: "components/workspace/workspace-shell-skip-link.tsx",
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
  console.log(`\n=== Growth workspace UX parity (${GROWTH_WORKSPACE_UX_PARITY_QA_MARKER}) ===\n`)

  for (const token of WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS) {
    assertIncludes(SHARED.tokens, token, `shell tokens must export ${token}`)
  }
  console.log("  ✓ shared shell layout tokens exported")

  assertIncludes(GROWTH.sidebarNav, "WORKSPACE_SIDEBAR_NAV_ROW", "Growth nav rows must use shared geometry token")
  assertIncludes(GROWTH.sidebarNav, "WORKSPACE_SIDEBAR_NAV_ICON", "Growth nav icons must use shared geometry token")
  assertIncludes(GROWTH.sidebarNav, "WORKSPACE_SIDEBAR_GROUP_HEADER", "Growth group headers must use shared geometry token")
  assertIncludes(CORE.sidebar, "h-10 px-3", "Core nav row geometry reference remains h-10 px-3")
  assertIncludes(CORE.sidebar, "w-[17px] h-[17px]", "Core nav icon geometry reference remains 17px")
  assertIncludes(GROWTH.sidebar, "WORKSPACE_SIDEBAR_WIDTH_EXPANDED", "Growth sidebar expanded width token")
  assertIncludes(GROWTH.sidebar, "WORKSPACE_SIDEBAR_WIDTH_COLLAPSED", "Growth sidebar collapsed width token")
  assertIncludes(GROWTH.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Growth sidebar collapse animation via shared surface token")
  for (const token of WORKSPACE_SHELL_SHARED_NAV_TOKENS) {
    assertIncludes(GROWTH.sidebarNav, token, `Growth sidebar must use ${token}`)
  }
  console.log("  ✓ sidebar geometry and chrome token parity")

  assertIncludes(GROWTH.topbar, "WORKSPACE_SHELL_TOPBAR", "Growth topbar must use shared topbar token")
  assertIncludes(CORE.topbar, "WORKSPACE_SHELL_TOPBAR", "Core topbar must use shared topbar token")
  assertIncludes(GROWTH.topbar, "WorkspaceSwitcher", "Growth topbar must use shared switcher")
  assertIncludes(GROWTH.topbar, "hidden sm:flex shrink-0", "Growth switcher spacing must match Core")
  assertIncludes(GROWTH.topbar, "WorkspaceTopbarAccountControls", "Growth topbar must use shared Core account controls")
  assertIncludes(CORE.topbar, "WorkspaceTopbarAccountControls", "Core topbar must use shared account controls")
  assertIncludes(GROWTH.topbar, "WorkspaceSearch", "Growth topbar must use shared search primitive")
  assertIncludes(CORE.topbar, "GlobalSearchHeader", "Core topbar must route search through GlobalSearchHeader wrapper")
  assertIncludes(CORE.globalSearchHeader, 'workspace="core"', "Core search wrapper must delegate to WorkspaceSearch")
  console.log("  ✓ topbar token and primitive sharing")
  assertIncludes(SHARED.container, "WORKSPACE_SHELL_MAIN_INNER", "WorkspaceContainer must use main inner rhythm token")
  assertIncludes(CORE.pageShell, "WORKSPACE_SHELL_MAIN_INNER", "Core PageShell must use same main inner rhythm token")
  assertIncludes(GROWTH.breadcrumbs, "WORKSPACE_SHELL_HORIZONTAL_PADDING", "Growth breadcrumbs must align horizontal padding token")
  console.log("  ✓ content rhythm tokens aligned")

  assertIncludes(GROWTH.workspaceShell, "WORKSPACE_SHELL_VIEWPORT_ROOT", "Growth shell responsive viewport root")
  assertIncludes(GROWTH.workspaceShell, "WORKSPACE_SHELL_VIEWPORT_BODY", "Growth shell responsive viewport body")
  assertIncludes(SHARED.searchPanel, "hidden md:block", "Search hidden on mobile like Core")
  assertIncludes(SHARED.searchPanel, "max-w-sm", "Search width constrained like Core")
  assertIncludes(GROWTH.sidebar, "hidden md:flex", "Desktop sidebar hidden on mobile")
  assertIncludes(GROWTH.mobileDrawer, "mobile-sidebar-nav", "Mobile drawer exposes Core-compatible nav id")
  console.log("  ✓ responsive shell primitives certified")

  assertIncludes(GROWTH.workspaceShell, "WorkspaceShellSkipLink", "Growth shell must expose skip link like Core")
  assertIncludes(GROWTH.workspaceShell, "WORKSPACE_SHELL_MAIN_CONTENT_ID", "Growth main landmark id must match Core")
  assertIncludes(GROWTH.topbar, "aria-expanded", "Growth mobile menu button must expose expanded state")
  assertIncludes(GROWTH.topbar, "aria-controls", "Growth mobile menu button must target drawer nav id")
  assertIncludes(SHARED.searchPanel, 'role="combobox"', "Shared search combobox semantics")
  assertIncludes(SHARED.searchPanel, "aria-expanded", "Shared search aria-expanded state")
  assertIncludes(SHARED.switcher, "aria-current", "Shared switcher aria-current for active workspace")
  console.log("  ✓ accessibility markers present")

  const primitivePaths: Record<(typeof WORKSPACE_SHELL_SHARED_PRIMITIVES)[number], string> = {
    WorkspaceShellBrand: "components/workspace/workspace-shell-brand.tsx",
    WorkspaceSidebarOrganizationCard: "components/workspace/workspace-sidebar-organization-card.tsx",
    WorkspaceSwitcher: "components/workspace/workspace-switcher.tsx",
    WorkspaceSearch: "components/workspace/workspace-search.tsx",
    WorkspaceContainer: "components/workspace/workspace-container.tsx",
    GlobalSearchPanel: "components/workspace/global-search-panel.tsx",
    WorkspaceTopbarAccountControls: "components/workspace/workspace-topbar-account-controls.tsx",
  }
  for (const primitive of WORKSPACE_SHELL_SHARED_PRIMITIVES) {
    assert.ok(fs.existsSync(path.join(ROOT, primitivePaths[primitive])), `${primitive} shared primitive must exist`)
    if (primitive === "GlobalSearchPanel") {
      assertIncludes(GROWTH.topbar, "WorkspaceSearch", "Growth topbar must consume search via WorkspaceSearch")
    } else if (primitive === "WorkspaceShellBrand") {
      assertIncludes(GROWTH.sidebar, "WorkspaceShellBrand", "Growth sidebar must consume WorkspaceShellBrand")
    } else if (primitive === "WorkspaceSidebarOrganizationCard") {
      assertIncludes(GROWTH.sidebar, "WorkspaceSidebarOrganizationCard", "Growth sidebar must consume shared org card")
      assertIncludes(GROWTH.mobileDrawer, "WorkspaceSidebarOrganizationCard", "Growth mobile drawer must consume shared org card")
      assertIncludes(CORE.sidebar, "WorkspaceSidebarOrganizationCard", "Core sidebar must consume shared org card")
    } else if (primitive === "WorkspaceContainer") {
      assertIncludes(GROWTH.workspaceShell, "WorkspaceContainer", "Growth shell must consume WorkspaceContainer")
    } else if (primitive === "WorkspaceTopbarAccountControls") {
      assertIncludes(GROWTH.topbar, "WorkspaceTopbarAccountControls", "Growth topbar must consume shared account controls")
      assertIncludes(CORE.topbar, "WorkspaceTopbarAccountControls", "Core topbar must consume shared account controls")
    } else {
      assertIncludes(GROWTH.topbar, primitive, `Growth topbar must consume ${primitive}`)
    }
  }
  assert.equal((read(SHARED.searchPanel).match(/export function GlobalSearchPanel/g) ?? []).length, 1, "single GlobalSearchPanel export")
  assert.equal((read(SHARED.switcher).match(/export function WorkspaceSwitcher/g) ?? []).length, 1, "single WorkspaceSwitcher export")
  console.log("  ✓ shared primitives remain singular implementations")

  for (const file of Object.values(GROWTH)) {
    assertExcludes(file, GROWTH_ADMIN_BASE_PATH, `${file} must not hardcode admin routes`)
  }
  assertExcludes("middleware.ts", "growth-workspace-ux-parity", "middleware must not reference UX parity module")
  console.log("  ✓ no admin hardcodes in Growth shell; middleware untouched")

  console.log("\n  Documented intentional deviations:")
  console.log("    - Core mobile drawer uses fixed overlay; Growth uses Sheet with equivalent nav content")
  console.log("    - Growth adds breadcrumb strip; Core uses PageHero on select routes")
  console.log("    - Growth Cmd+K remains command palette; Core Cmd+K focuses shared search")

  console.log("\nGrowth workspace UX parity certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_UX_PARITY_QA_MARKER,
        shared_primitives: WORKSPACE_SHELL_SHARED_PRIMITIVES.length,
        shell_tokens: WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
