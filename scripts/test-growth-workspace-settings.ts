/**
 * Growth workspace settings shell audit (Phase 7C — local only).
 *
 * Usage: pnpm test:growth-workspace-settings
 */
import assert from "node:assert/strict"
import {
  GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID,
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"

function runAudit(): void {
  console.log(`\n=== Growth workspace settings audit (${GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER}) ===\n`)

  const sectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(sectionIds.length, 15)
  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.length, 4)
  console.log("  ✓ settings manifest defines 4 groups and 15 sections")

  for (const id of sectionIds) {
    const route = findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/settings/${id}`)
    assert.ok(route, `missing registry route for settings section: ${id}`)
    assert.equal(route.section, "settings")
    assert.equal(route.migrated, true)
  }
  console.log("  ✓ every settings section maps to migrated registry metadata")

  const settingsRoot = findGrowthRouteMetadataByPathname(`${GROWTH_WORKSPACE_BASE_PATH}/settings`)
  assert.ok(settingsRoot)
  assert.equal(settingsRoot.id, "workspace-settings")
  console.log("  ✓ settings root route registered")

  const profileCrumbs = resolveGrowthBreadcrumbs(`${GROWTH_WORKSPACE_BASE_PATH}/settings/profile`)
  assert.deepEqual(profileCrumbs.map((crumb) => crumb.label), ["Growth", "Settings", "Profile"])
  const communicationsCrumbs = resolveGrowthBreadcrumbs(
    `${GROWTH_WORKSPACE_BASE_PATH}/settings/connected-mailboxes`,
  )
  assert.deepEqual(communicationsCrumbs.map((crumb) => crumb.label), [
    "Growth",
    "Settings",
    "Connected Mailboxes",
  ])
  console.log("  ✓ settings breadcrumbs resolve hierarchically")

  const settingsCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    "/admin/growth/settings/growth",
  )
  assert.equal(settingsCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/settings`)

  const communicationsCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    "/admin/growth/settings/communications",
  )
  assert.equal(communicationsCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/settings/connected-mailboxes`)
  console.log("  ✓ Cmd+K rewrites admin settings routes to workspace destinations")

  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K registry parity unchanged")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID, "profile")
  console.log("  ✓ settings index defaults to profile section")

  console.log("\nGrowth workspace settings audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
        groups: GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.length,
        sections: sectionIds.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
