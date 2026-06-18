/**
 * GE-SET-3 — Workspace Settings Growth Operator panel lift verification (local only).
 *
 * Usage: pnpm test:workspace-settings-growth-operator
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS } from "../lib/growth/settings/growth-workspace-settings-types"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import {
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS,
  getWorkspaceSettingsGrowthOperatorSection,
  listWorkspaceSettingsGrowthOperatorSectionIds,
} from "../lib/settings/workspace-settings-growth-operator"
import {
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  buildWorkspaceSettingsRootCategories,
} from "../lib/settings/workspace-settings-navigation"

const API_ENDPOINTS = [
  "/api/growth/workspace/settings/profile",
  "/api/growth/workspace/settings/notifications",
  "/api/growth/workspace/settings/personal-preferences",
  "/api/growth/workspace/settings/sidebar-preferences",
  "/api/growth/workspace/settings/default-views",
] as const

const PANEL_COMPONENTS = [
  "GrowthSettingsProfilePanel",
  "GrowthSettingsNotificationsPanel",
  "GrowthSettingsPersonalPreferencesPanel",
  "GrowthSettingsSidebarPreferencesPanel",
  "GrowthSettingsDefaultViewsPanel",
] as const

function runAudit(): void {
  console.log(`\n=== Workspace Settings GE-SET-3 (${WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER}) ===\n`)

  const sectionIds = listWorkspaceSettingsGrowthOperatorSectionIds()
  assert.equal(sectionIds.length, 5)
  assert.deepEqual(sectionIds, [...GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS])
  console.log("  ✓ Growth Operator manifest defines all 5 persisted sections")

  const expectedLabels = ["Profile", "Notifications", "Personal Preferences", "Sidebar Preferences", "Default Views"]
  assert.deepEqual(WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS.map((section) => section.label), expectedLabels)
  console.log("  ✓ navigation labels match expected Growth Operator IA")

  for (const id of sectionIds) {
    const section = getWorkspaceSettingsGrowthOperatorSection(id)
    assert.ok(section, `missing growth-operator section: ${id}`)
    assert.equal(section.href, `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${id}`)
  }
  console.log("  ✓ every section resolves to /settings/growth-operator/* route")

  const growthOperatorGroup = WORKSPACE_SETTINGS_GENERAL_GROUPS.find((group) => group.id === "general-growth-operator")
  assert.ok(growthOperatorGroup)
  assert.equal(growthOperatorGroup.items.length, 5)
  assert.deepEqual(growthOperatorGroup.items.map((item) => item.label), expectedLabels)
  for (const item of growthOperatorGroup.items) {
    assert.ok(item.href.startsWith(`${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/`))
    assert.equal(item.existingConfigHref, undefined, `${item.id} must not use Phase 1 placeholder CTA`)
  }
  console.log("  ✓ Workspace Settings nav points to lifted routes (no placeholder CTAs)")

  const categories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Growth",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: false,
    },
  })
  const general = categories.find((category) => category.id === "general")
  const growthOperatorNav = general?.groups.find((group) => group.id === "general-growth-operator")
  assert.ok(growthOperatorNav)
  assert.equal(growthOperatorNav.items.length, 5)
  console.log("  ✓ Growth Operator group visible when Growth Engine nav is enabled")

  const workspacePageSrc = readFileSync(
    "app/(dashboard)/settings/growth-operator/[sectionId]/page.tsx",
    "utf8",
  )
  assert.match(workspacePageSrc, /WorkspaceSettingsGrowthOperatorSectionPage/)
  assert.doesNotMatch(workspacePageSrc, /WorkspaceSettingsPhasePlaceholder/)
  assert.doesNotMatch(workspacePageSrc, /redirect\(/)
  console.log("  ✓ workspace growth-operator pages render live panels (no placeholders, no redirects)")

  const workspaceIndexSrc = readFileSync("app/(dashboard)/settings/growth-operator/page.tsx", "utf8")
  assert.match(workspaceIndexSrc, /redirect\(/)
  assert.match(workspaceIndexSrc, /WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID/)
  console.log("  ✓ growth-operator index redirects to profile default only")

  const sharedPanelsSrc = readFileSync("components/growth/settings/growth-settings-persisted-panels.tsx", "utf8")
  for (const panel of PANEL_COMPONENTS) {
    assert.match(sharedPanelsSrc, new RegExp(panel))
  }
  console.log("  ✓ shared persisted panel map reuses all 5 existing panel components")

  const growthSectionPageSrc = readFileSync("components/growth/settings/growth-settings-section-page.tsx", "utf8")
  assert.match(growthSectionPageSrc, /GrowthSettingsPersistedPanel/)
  assert.doesNotMatch(growthSectionPageSrc, /WorkspaceSettingsPhasePlaceholder/)
  console.log("  ✓ /growth/settings/* compatibility routes use shared persisted panels")

  for (const id of sectionIds) {
    const growthPageSrc = readFileSync(`app/(growth)/growth/settings/${id}/page.tsx`, "utf8")
    assert.match(growthPageSrc, /GrowthSettingsSectionPage/)
    assert.match(growthPageSrc, new RegExp(`sectionId="${id}"`))
  }
  console.log("  ✓ legacy /growth/settings/* routes remain operational")

  for (const [index, endpoint] of API_ENDPOINTS.entries()) {
    const panelFile = [
      "growth-settings-profile-panel.tsx",
      "growth-settings-notifications-panel.tsx",
      "growth-settings-personal-preferences-panel.tsx",
      "growth-settings-sidebar-preferences-panel.tsx",
      "growth-settings-default-views-panel.tsx",
    ][index]
    const src = readFileSync(`components/growth/settings/${panelFile}`, "utf8")
    assert.match(src, new RegExp(endpoint.replace(/\//g, "\\/")))
  }
  console.log("  ✓ panels still call original Growth workspace settings APIs")

  const sidebarSrc = readFileSync("components/growth/shell/growth-sidebar.tsx", "utf8")
  assert.match(sidebarSrc, /WORKSPACE_SIDEBAR_COLLAPSED_STORAGE_KEY/)
  assert.doesNotMatch(sidebarSrc, /sidebar\.sidebarCollapsed/)
  console.log("  ✓ sidebar localStorage-only collapse behavior unchanged")

  const workspaceOperatorPageSrc = readFileSync(
    "components/settings/workspace-settings-growth-operator-section-page.tsx",
    "utf8",
  )
  assert.doesNotMatch(workspaceOperatorPageSrc, /fetch\(/)
  assert.doesNotMatch(workspaceOperatorPageSrc, /subscribe/)
  assert.doesNotMatch(workspaceOperatorPageSrc, /poll/)
  console.log("  ✓ workspace section page adds no network requests")

  console.log("\nWorkspace Settings GE-SET-3 verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER,
        sections: sectionIds.length,
        routes: sectionIds.map((id) => `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${id}`),
        legacy_routes_preserved: true,
        redirects_introduced: false,
        auth_changes: false,
        org_rbac_deferred: true,
      },
      null,
      2,
    ),
  )
}

runAudit()
