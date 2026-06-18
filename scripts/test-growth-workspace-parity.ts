/**
 * Growth workspace shell parity certification (Phase 6B.1 — local only).
 *
 * Usage: pnpm test:growth-workspace-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_ADMIN_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_WORKSPACE_PARITY_QA_MARKER,
  WORKSPACE_SHELL_SHARED_NAV_TOKENS,
  WORKSPACE_SHELL_SHARED_PRIMITIVES,
  WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS,
} from "../lib/workspace/workspace-shell-parity"
import {
  WORKSPACE_SEARCH_INTERACTION_QA_MARKER,
  WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE,
  WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH,
} from "../lib/workspace/workspace-search-interactions"
import { WORKSPACE_SEARCH_DEBOUNCE_MS } from "../components/workspace/global-search-panel"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const CORE_SHELL_FILES = {
  topbar: "components/app-topbar.tsx",
  pageShell: "components/page-shell.tsx",
  sidebar: "components/app-sidebar.tsx",
} as const

const GROWTH_SHELL_FILES = {
  topbar: "components/growth/shell/growth-topbar.tsx",
  workspaceShell: "components/growth/shell/growth-workspace-shell.tsx",
  sidebar: "components/growth/shell/growth-sidebar.tsx",
  sidebarNav: "components/growth/shell/growth-sidebar-nav-content.tsx",
  mobileDrawer: "components/growth/shell/growth-mobile-nav-drawer.tsx",
} as const

const PRIMITIVE_FILES = {
  WorkspaceShellBrand: "components/workspace/workspace-shell-brand.tsx",
  WorkspaceSidebarOrganizationCard: "components/workspace/workspace-sidebar-organization-card.tsx",
  WorkspaceSwitcher: "components/workspace/workspace-switcher.tsx",
  WorkspaceSearch: "components/workspace/workspace-search.tsx",
  WorkspaceContainer: "components/workspace/workspace-container.tsx",
  GlobalSearchPanel: "components/workspace/global-search-panel.tsx",
  WorkspaceTopbarAccountControls: "components/workspace/workspace-topbar-account-controls.tsx",
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

function assertBothInclude(token: string, message: string): void {
  assertIncludes(CORE_SHELL_FILES.topbar, token, `${message} (Core topbar)`)
  assertIncludes(GROWTH_SHELL_FILES.topbar, token, `${message} (Growth topbar)`)
}

function assertGrowthNavTokens(): void {
  for (const token of WORKSPACE_SHELL_SHARED_NAV_TOKENS) {
    assertIncludes(GROWTH_SHELL_FILES.sidebarNav, token, `Growth sidebar nav must use ${token}`)
  }
  assertIncludes(CORE_SHELL_FILES.sidebar, "NAV_ROW_ACTIVE_SIDEBAR", "Core sidebar must use shared nav tokens")
  assertIncludes(CORE_SHELL_FILES.sidebar, "NAV_SIDEBAR_ACTIVE_INDICATOR", "Core sidebar must use orange active rail")
}

function assertSharedTokenConsumption(): void {
  assertIncludes(CORE_SHELL_FILES.topbar, "WORKSPACE_SHELL_TOPBAR", "Core topbar must consume WORKSPACE_SHELL_TOPBAR")
  assertIncludes(GROWTH_SHELL_FILES.topbar, "WORKSPACE_SHELL_TOPBAR", "Growth topbar must consume WORKSPACE_SHELL_TOPBAR")

  assertIncludes(CORE_SHELL_FILES.pageShell, "WORKSPACE_SHELL_MAIN_INNER", "Core page shell must consume container token")
  assertIncludes(GROWTH_SHELL_FILES.workspaceShell, "WorkspaceContainer", "Growth shell must consume WorkspaceContainer")

  assertIncludes(CORE_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY", "Core sidebar must share collapse storage key")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY", "Growth sidebar must share collapse storage key")

  assertIncludes(CORE_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_WIDTH_EXPANDED", "Core sidebar expanded width token")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_WIDTH_EXPANDED", "Growth sidebar expanded width token")
  assertIncludes(CORE_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_WIDTH_COLLAPSED", "Core sidebar collapsed width token")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_WIDTH_COLLAPSED", "Growth sidebar collapsed width token")

  assertIncludes(CORE_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Core sidebar surface token")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Growth sidebar surface token")

  for (const token of WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS) {
    assert.ok(
      fs.existsSync(path.join(ROOT, "lib/workspace/workspace-shell-tokens.ts")),
      "workspace-shell-tokens.ts must exist",
    )
    assertIncludes("lib/workspace/workspace-shell-tokens.ts", token, `shell tokens must export ${token}`)
  }
}

function assertSharedPrimitiveConsumption(): void {
  for (const primitive of WORKSPACE_SHELL_SHARED_PRIMITIVES) {
    assert.ok(fs.existsSync(path.join(ROOT, PRIMITIVE_FILES[primitive])), `${primitive} file must exist`)
  }

  assertIncludes(CORE_SHELL_FILES.sidebar, "WorkspaceShellBrand", "Core sidebar must consume WorkspaceShellBrand")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WorkspaceShellBrand", "Growth sidebar must consume WorkspaceShellBrand")
  assertIncludes(GROWTH_SHELL_FILES.mobileDrawer, "WorkspaceShellBrand", "Growth mobile drawer must consume WorkspaceShellBrand")
  assertIncludes(CORE_SHELL_FILES.sidebar, "WorkspaceSidebarOrganizationCard", "Core sidebar must consume shared org card")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WorkspaceSidebarOrganizationCard", "Growth sidebar must consume shared org card")
  assertIncludes(GROWTH_SHELL_FILES.mobileDrawer, "WorkspaceSidebarOrganizationCard", "Growth mobile drawer must consume shared org card")

  assertIncludes(CORE_SHELL_FILES.topbar, "WorkspaceSwitcher", "Core topbar must consume WorkspaceSwitcher")
  assertIncludes(GROWTH_SHELL_FILES.topbar, "WorkspaceSwitcher", "Growth topbar must consume WorkspaceSwitcher")

  assertIncludes(CORE_SHELL_FILES.topbar, "GlobalSearchHeader", "Core topbar must route search through GlobalSearchHeader wrapper")
  assertIncludes("components/global-search-header.tsx", "WorkspaceSearch", "GlobalSearchHeader must delegate to WorkspaceSearch")
  assertIncludes(GROWTH_SHELL_FILES.topbar, 'workspace="growth"', "Growth topbar must consume WorkspaceSearch")

  assertIncludes(CORE_SHELL_FILES.topbar, "WorkspaceTopbarAccountControls", "Core topbar must consume shared account controls")
  assertIncludes(GROWTH_SHELL_FILES.topbar, "WorkspaceTopbarAccountControls", "Growth topbar must consume shared account controls")
  assertExcludes(GROWTH_SHELL_FILES.topbar, "initialsFromDisplayLabel", "Growth topbar must not duplicate account identity block")

  assertIncludes(GROWTH_SHELL_FILES.workspaceShell, "WorkspaceContainer", "Growth shell must consume WorkspaceContainer")
}

function assertNoDuplicateImplementations(): void {
  const panelSource = read(PRIMITIVE_FILES.GlobalSearchPanel)
  assert.equal(
    (panelSource.match(/role=\"combobox\"/g) ?? []).length,
    1,
    "GlobalSearchPanel must be the sole workspace search combobox implementation",
  )

  assertExcludes(GROWTH_SHELL_FILES.topbar, "GlobalSearchPanel", "Growth topbar must not import GlobalSearchPanel directly")
  assertExcludes(CORE_SHELL_FILES.topbar, "GlobalSearchPanel", "Core topbar must not import GlobalSearchPanel directly")

  assertExcludes(GROWTH_SHELL_FILES.topbar, "GrowthModuleSwitcher", "Growth topbar must not use legacy GrowthModuleSwitcher")
  assertExcludes(GROWTH_SHELL_FILES.topbar, "sessionIdentity?.displayName", "Growth topbar must not render standalone account text")
  assert.equal(
    (read(PRIMITIVE_FILES.WorkspaceTopbarAccountControls).match(/export function WorkspaceTopbarAccountControls/g) ?? [])
      .length,
    1,
    "WorkspaceTopbarAccountControls must have a single export",
  )
  assertExcludes(GROWTH_SHELL_FILES.sidebar, "bg-[#13233F]", "Growth sidebar must not use legacy custom active fill")
  assertExcludes(GROWTH_SHELL_FILES.sidebarNav, "text-[#6EA8FF]", "Growth sidebar must not use legacy custom active text")
}

function assertSidebarParity(): void {
  assertIncludes(GROWTH_SHELL_FILES.workspaceShell, "WORKSPACE_SHELL_VIEWPORT_ROOT", "Growth shell must use viewport-height root")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "WORKSPACE_SIDEBAR_NAV_ROW", "Growth nav row height/padding must use shared token")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "WORKSPACE_SIDEBAR_NAV_ICON", "Growth nav icon size must use shared token")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "overflow-y-auto", "Growth sidebar nav must scroll")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "ChevronDown", "Growth sidebar groups must collapse like Core")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "WORKSPACE_GROWTH_SIDEBAR_SECTIONS_STORAGE_KEY", "Growth section collapse persistence key")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Growth sidebar collapse animation via shared surface token")
  assertIncludes(CORE_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_SURFACE", "Core sidebar collapse animation via shared surface token")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "WORKSPACE_SIDEBAR_GROWTH_ORGANIZATION_PROPS", "Growth sidebar org card uses Growth label props")
  assertIncludes("lib/workspace/workspace-shell-tokens.ts", "WORKSPACE_SIDEBAR_GROWTH_ENGINE_LABEL", "Growth Engine label token exported")
  assertIncludes("lib/workspace/workspace-shell-tokens.ts", "WORKSPACE_SIDEBAR_SCALE_ACCENT_COLOR", "Scale accent token exported")
  assertIncludes(GROWTH_SHELL_FILES.sidebarNav, "NAV_PRIMARY_ROW_MOTION", "Growth nav must use shared motion token")
  assertIncludes(GROWTH_SHELL_FILES.sidebar, "localStorage.setItem", "Growth sidebar must persist collapse state")
  assertIncludes(CORE_SHELL_FILES.sidebar, "localStorage.setItem", "Core sidebar must persist collapse state")
  console.log("  ✓ sidebar parity (tokens, row geometry, scroll, collapse persistence)")
}

function assertHeaderParity(): void {
  assertBothInclude("WORKSPACE_SHELL_TOPBAR", "topbar must share WORKSPACE_SHELL_TOPBAR")
  assertBothInclude("WorkspaceSwitcher", "topbar must share WorkspaceSwitcher")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "hidden md:block", "search bar hidden on mobile in shared panel")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "max-w-sm", "search bar width constrained consistently")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "text-sm", "search typography uses shared text-sm input")
  console.log("  ✓ header parity (height, padding, switcher, search dimensions, responsive)")
}

function assertSearchCertification(): void {
  assert.equal(WORKSPACE_SEARCH_DEBOUNCE_MS, 280, "debounce must remain 280ms")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "WORKSPACE_SEARCH_DEBOUNCE_MS", "debounce exported from shared panel")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, 'e.key === "Escape"', "Escape closes search panel")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "usePathname", "route change closes search panel")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "ArrowDown", "keyboard navigation supports ArrowDown")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "ArrowUp", "keyboard navigation supports ArrowUp")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "keyboardShortcutEnabled", "Cmd/Ctrl+K shortcut is configurable")
  assertIncludes(PRIMITIVE_FILES.WorkspaceSearch, "WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE", "Core enables Cmd/Ctrl+K focus")
  assertIncludes(PRIMITIVE_FILES.WorkspaceSearch, "WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH", "Growth disables Cmd/Ctrl+K search focus")
  assert.equal(WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_CORE, true)
  assert.equal(WORKSPACE_SEARCH_KEYBOARD_SHORTCUT_ENABLED_GROWTH, false)
  assertIncludes("components/growth/growth-navigation-provider.tsx", 'event.key.toLowerCase() !== "k"', "Growth Cmd+K reserved for command palette")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "data-workspace-search-interaction", "search interaction QA marker present")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "WorkspaceSearchResultsSkeleton", "search loading skeletons present")
  assertIncludes(PRIMITIVE_FILES.GlobalSearchPanel, "Recent searches", "recent searches support present")
  assertIncludes("lib/workspace/growth-workspace-search-providers.ts", "Promise.allSettled", "growth search tolerates partial provider failures")
  assertIncludes("lib/workspace/run-growth-workspace-search-client.ts", "runGrowthWorkspaceSearchProviders", "growth search client delegates to providers")
  console.log("  ✓ search certification (debounce, escape, route close, keyboard nav, Cmd/Ctrl+K contract)")
}

function assertContainerSpacingCertification(): void {
  assertIncludes(CORE_SHELL_FILES.pageShell, "WORKSPACE_SHELL_MAIN_INNER", "Core uses shared main inner container token")
  assertIncludes(PRIMITIVE_FILES.WorkspaceContainer, "WORKSPACE_SHELL_MAIN_INNER", "WorkspaceContainer applies shared rhythm")
  assertIncludes("components/growth/shell/growth-breadcrumbs.tsx", "WORKSPACE_SHELL_HORIZONTAL_PADDING", "Growth breadcrumbs use shared horizontal padding")
  assertIncludes("components/growth/shell/growth-workspace-page-content.tsx", "GROWTH_WORKSPACE_PAGE_STACK", "Growth page content uses shared page stack token")
  assertIncludes("lib/workspace/workspace-shell-tokens.ts", "max-w-[1440px]", "shared max width token")
  assertIncludes("lib/workspace/workspace-shell-tokens.ts", "p-3 sm:p-6", "shared horizontal/vertical padding breakpoints")
  assertIncludes("lib/workspace/workspace-shell-tokens.ts", "pb-24 lg:pb-6", "shared mobile bottom clearance rhythm")
  assertExcludes("app/(growth)/growth/page.tsx", "max-w-7xl", "Growth dashboard must not double-narrow with legacy max-w-7xl wrapper")
  console.log("  ✓ container spacing certification (max width, padding, breakpoints)")
}

function assertNoAdminRegressions(): void {
  for (const file of [
    ...Object.values(GROWTH_SHELL_FILES),
    ...Object.values(PRIMITIVE_FILES),
  ]) {
    assertExcludes(file, GROWTH_ADMIN_BASE_PATH, `${file} must not hardcode admin paths`)
  }
  console.log("  ✓ no admin path regressions in shell/search primitives")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace shell parity certification (${GROWTH_WORKSPACE_PARITY_QA_MARKER}) ===\n`)

  assertSharedTokenConsumption()
  console.log("  ✓ Core and Growth consume same shell layout tokens")

  assertGrowthNavTokens()
  console.log("  ✓ navigation chrome tokens shared between Core and Growth sidebars")

  assertSharedPrimitiveConsumption()
  console.log("  ✓ shared shell primitives consumed by Core and Growth")

  assertNoDuplicateImplementations()
  console.log("  ✓ no duplicated workspace search/switcher/sidebar brand implementations")

  assertSidebarParity()
  assertHeaderParity()
  assertSearchCertification()
  assertContainerSpacingCertification()
  assertNoAdminRegressions()

  console.log("\nGrowth workspace shell parity certification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_PARITY_QA_MARKER,
        shared_primitives: WORKSPACE_SHELL_SHARED_PRIMITIVES,
        shell_tokens: WORKSPACE_SHELL_SHARED_TOKEN_IMPORTS,
        nav_tokens: WORKSPACE_SHELL_SHARED_NAV_TOKENS,
        search_interaction_marker: WORKSPACE_SEARCH_INTERACTION_QA_MARKER,
      },
      null,
      2,
    ),
  )
}

runAudit()
