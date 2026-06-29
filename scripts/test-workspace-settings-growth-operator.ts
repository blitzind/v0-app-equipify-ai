/**
 * GE-SET-3 — Workspace Settings Growth Operator panel lift verification (local only).
 *
 * Usage: pnpm test:workspace-settings-growth-operator
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS } from "../lib/growth/settings/growth-workspace-settings-types"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import {
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER,
  WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS,
  getWorkspaceSettingsGrowthOperatorSection,
  listWorkspaceSettingsGrowthOperatorSectionIds,
  workspaceSettingsGrowthOperatorLegacyHref,
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
  assert.equal(sectionIds.length, 6)
  assert.deepEqual(sectionIds, [...GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS])
  console.log("  ✓ Growth Operator manifest defines all 6 persisted sections")

  const expectedLabels = [
    "Profile",
    "Notifications",
    "Personal Preferences",
    "Sidebar Preferences",
    "Default Views",
    "AI Teammate",
  ]
  assert.deepEqual(WORKSPACE_SETTINGS_GROWTH_OPERATOR_SECTIONS.map((section) => section.label), expectedLabels)
  console.log("  ✓ navigation labels match expected Growth Operator IA")

  for (const id of sectionIds) {
    const section = getWorkspaceSettingsGrowthOperatorSection(id)
    assert.ok(section, `missing growth-operator section: ${id}`)
    assert.equal(section.href, `${GROWTH_WORKSPACE_BASE_PATH}/settings/${id}`)
    assert.equal(workspaceSettingsGrowthOperatorLegacyHref(id), `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${id}`)
  }
  console.log("  ✓ every section resolves to canonical /growth/settings/* route")

  const growthOperatorGroup = WORKSPACE_SETTINGS_GENERAL_GROUPS.find((group) => group.id === "general-growth-operator")
  assert.equal(growthOperatorGroup, undefined)
  console.log("  ✓ Workspace Settings nav no longer duplicates Growth Operator routes")

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
  assert.equal(growthOperatorNav, undefined)
  console.log("  ✓ Growth Operator group removed from Core settings nav")

  const workspacePageSrc = readFileSync(
    "app/(dashboard)/settings/growth-operator/[sectionId]/page.tsx",
    "utf8",
  )
  assert.match(workspacePageSrc, /redirect\(/)
  assert.match(workspacePageSrc, /GROWTH_WORKSPACE_BASE_PATH/)
  assert.doesNotMatch(workspacePageSrc, /WorkspaceSettingsGrowthOperatorSectionPage/)
  console.log("  ✓ workspace growth-operator pages redirect to canonical Growth settings")

  const workspaceIndexSrc = readFileSync("app/(dashboard)/settings/growth-operator/page.tsx", "utf8")
  assert.match(workspaceIndexSrc, /redirect\(/)
  assert.match(workspaceIndexSrc, /\/settings\/profile/)
  console.log("  ✓ growth-operator index redirects to /growth/settings/profile")

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
    if (id === "ai-teammate") {
      assert.match(growthPageSrc, /GrowthAiTeammateSettingsPanel|GrowthSettingsSectionPage/)
      continue
    }
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

  console.log("\nWorkspace Settings GE-SET-3 verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: WORKSPACE_SETTINGS_GROWTH_OPERATOR_QA_MARKER,
        sections: sectionIds.length,
        canonical_routes: sectionIds.map((id) => `${GROWTH_WORKSPACE_BASE_PATH}/settings/${id}`),
        legacy_routes: sectionIds.map((id) => `${WORKSPACE_SETTINGS_GROWTH_OPERATOR_BASE}/${id}`),
        default_section: WORKSPACE_SETTINGS_GROWTH_OPERATOR_DEFAULT_SECTION_ID,
        redirects_introduced: true,
        auth_changes: false,
        org_rbac_deferred: true,
      },
      null,
      2,
    ),
  )
}

runAudit()
