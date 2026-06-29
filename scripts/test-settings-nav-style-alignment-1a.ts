/**
 * SETTINGS-NAV-STYLE-ALIGNMENT-1A — Core + Growth settings nav visual parity certification.
 *
 * Run: pnpm test:settings-nav-style-alignment-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  SETTINGS_NAV_ACTIVE_ROW,
  SETTINGS_NAV_SIDEBAR_CONTAINER,
} from "../lib/settings/settings-nav-chrome"
import {
  GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR,
} from "../lib/growth/settings/growth-workspace-settings-shell-tokens"
import {
  WORKSPACE_SETTINGS_SHELL_SIDEBAR_DESKTOP,
} from "../lib/settings/workspace-settings-shell-tokens"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  isGrowthWorkspaceSettingsNavItemActive,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import {
  isWorkspaceSettingsNavItemActive,
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
} from "../lib/settings/workspace-settings-navigation"

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function workspaceItem(id: string) {
  for (const group of WORKSPACE_SETTINGS_GENERAL_GROUPS) {
    const item = group.items.find((entry) => entry.id === id)
    if (item) return item
  }
  throw new Error(`missing workspace settings nav item: ${id}`)
}

function growthItem(id: string) {
  for (const group of GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === id)
    if (item) return item
  }
  throw new Error(`missing growth settings nav item: ${id}`)
}

function main(): void {
  console.log("\n=== SETTINGS-NAV-STYLE-ALIGNMENT-1A (structure) ===\n")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR, SETTINGS_NAV_SIDEBAR_CONTAINER)
  assert.equal(WORKSPACE_SETTINGS_SHELL_SIDEBAR_DESKTOP, SETTINGS_NAV_SIDEBAR_CONTAINER)
  assert.match(SETTINGS_NAV_SIDEBAR_CONTAINER, /rounded-xl/)
  assert.match(SETTINGS_NAV_SIDEBAR_CONTAINER, /bg-card/)
  assert.match(SETTINGS_NAV_ACTIVE_ROW, /border-primary/)
  assert.match(SETTINGS_NAV_ACTIVE_ROW, /font-semibold text-foreground/)
  console.log("  ✓ shared settings nav shell + active row tokens")

  const growthShell = read("components/growth/settings/growth-settings-shell.tsx")
  const workspaceNav = read("components/settings/workspace-settings-nav.tsx")
  const navItemLink = read("components/settings/settings-nav-item-link.tsx")

  for (const source of [growthShell, workspaceNav, navItemLink]) {
    assert.match(source, /SettingsNavItemLink|settings-nav-chrome/)
    assert.doesNotMatch(source, /NAV_ROW_ACTIVE_SIDEBAR/)
  }

  assert.match(growthShell, /SettingsNavItemLink/)
  assert.match(workspaceNav, /SettingsNavItemLink/)
  assert.match(workspaceNav, /SETTINGS_NAV_SIDEBAR_CONTAINER/)
  assert.match(navItemLink, /aria-current=\{active \? "page" : undefined\}/)
  assert.match(navItemLink, /NAV_SIDEBAR_ACTIVE_INDICATOR/)
  assert.match(navItemLink, /settingsNavRowClassName/)
  console.log("  ✓ Growth + Core nav use shared item link + card active styling")

  const generalItem = workspaceItem("general")
  const permissionsItem = workspaceItem("permissions")
  const apiItem = workspaceItem("api-developers")
  const profileItem = growthItem("profile")

  assert.equal(isWorkspaceSettingsNavItemActive("/settings/general", generalItem), true)
  assert.equal(isWorkspaceSettingsNavItemActive("/settings/permissions", permissionsItem), true)
  assert.equal(isWorkspaceSettingsNavItemActive("/settings/api", apiItem), true)
  assert.equal(isGrowthWorkspaceSettingsNavItemActive("/growth/settings/profile", profileItem), true)
  console.log("  ✓ active route helpers for /settings/general, permissions, api, /growth/settings/profile")

  console.log("\nSETTINGS-NAV-STYLE-ALIGNMENT-1A structure certification passed.\n")
}

main()
