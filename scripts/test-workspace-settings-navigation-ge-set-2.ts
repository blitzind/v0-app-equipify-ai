/**
 * GE-SET-2 — Workspace Settings consolidation Phase 1 verification (local only).
 *
 * Usage: pnpm test:workspace-settings-navigation-ge-set-2
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getEquipifyPlanDisplayName } from "../lib/billing/get-equipify-plan-display-name"
import { getOrganizationPlanDisplay } from "../lib/billing/get-organization-plan-display"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import {
  WORKSPACE_SETTINGS_DATA_ADMIN_BASE,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE,
  WORKSPACE_SETTINGS_NAV_QA_MARKER,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID,
  WORKSPACE_SETTINGS_DATA_ADMIN_DEFAULT_SECTION_ID,
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  buildWorkspaceSettingsRootCategories,
  getWorkspaceSettingsGrowthEngineSection,
  getWorkspaceSettingsDataAdminSection,
  listWorkspaceSettingsGrowthEngineSectionIds,
  listWorkspaceSettingsDataAdminSectionIds,
} from "../lib/settings/workspace-settings-navigation"
import {
  resolveWorkspaceSettingsDataAdminPlaceholderCopy,
} from "../lib/settings/workspace-settings-data-admin-placeholder"
import {
  isDataAdministrationSettingsNavVisible,
  isGrowthEngineSettingsNavVisible,
  isGrowthEngineEnabledClient,
} from "../lib/settings/workspace-settings-visibility"

function ownerCtx(overrides: Partial<Parameters<typeof buildWorkspaceSettingsRootCategories>[0]["ctx"]> = {}) {
  return {
    permissions: getOrgPermissionsForRole("owner"),
    growthEngineNavVisible: false,
    dataAdministrationNavVisible: false,
    ...overrides,
  }
}

function runAudit(): void {
  console.log(`\n=== Workspace Settings GE-SET-2 (${WORKSPACE_SETTINGS_NAV_QA_MARKER}) ===\n`)

  const growthSections = listWorkspaceSettingsGrowthEngineSectionIds()
  assert.ok(growthSections.length >= 33, "expected Growth Engine legacy manifest to define sections")
  console.log(`  ✓ Growth Engine legacy manifest defines ${growthSections.length} sections`)

  const dataAdminSections = listWorkspaceSettingsDataAdminSectionIds()
  assert.equal(dataAdminSections.length, 5)
  console.log("  ✓ Data & Administration manifest defines 5 sections")

  for (const id of growthSections) {
    const section = getWorkspaceSettingsGrowthEngineSection(id)
    assert.ok(section, `missing growth-engine section: ${id}`)
    assert.ok(section.href.startsWith("/growth/settings") || section.href.startsWith("/settings/growth-engine"), `unexpected href for ${id}: ${section.href}`)
  }
  console.log("  ✓ every Growth Engine legacy section has canonical redirect target")

  for (const id of dataAdminSections) {
    const section = getWorkspaceSettingsDataAdminSection(id)
    assert.ok(section, `missing data-admin section: ${id}`)
    assert.equal(section.href, `${WORKSPACE_SETTINGS_DATA_ADMIN_BASE}/${id}`)
    assert.ok(section.existingConfigHref, `missing existingConfigHref for ${id}`)
  }
  console.log("  ✓ every Data & Administration section has route + deep link")

  assert.equal(getOrganizationPlanDisplay({ planId: "scale" }), "Equipify Scale")
  assert.equal(getOrganizationPlanDisplay({ planId: "growth" }), "Equipify Growth")
  assert.equal(getOrganizationPlanDisplay({ planId: "solo" }), "Equipify Solo")
  assert.equal(getEquipifyPlanDisplayName({ planId: "enterprise" }), "Equipify Enterprise")
  console.log("  ✓ dynamic plan labels resolve via existing helpers")

  const soloNoGrowth = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Solo",
    ctx: ownerCtx({ growthEngineNavVisible: false, dataAdministrationNavVisible: false }),
  })
  assert.deepEqual(
    soloNoGrowth.map((category) => category.label),
    ["General", "Equipify Solo"],
  )
  console.log("  ✓ Solo without Growth shows General + Equipify Solo only")

  const scaleWithGrowth = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: ownerCtx({ growthEngineNavVisible: true, dataAdministrationNavVisible: true }),
  })
  assert.deepEqual(
    scaleWithGrowth.map((category) => category.label),
    ["General", "Equipify Scale", "Data & Administration"],
  )
  assert.equal(scaleWithGrowth.some((category) => category.id === "growth_engine"), false)
  console.log("  ✓ Scale + platform admin shows Core categories only (Growth Engine removed from Core nav)")

  const layoutSrc = readFileSync("app/(dashboard)/settings/layout.tsx", "utf8")
  assert.match(layoutSrc, /WorkspaceSettingsNav/)
  assert.doesNotMatch(layoutSrc, /const NAV_ITEMS/)
  console.log("  ✓ settings layout uses grouped WorkspaceSettingsNav")

  const nextConfig = readFileSync("next.config.mjs", "utf8")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_ENGINE_ENABLED/)
  console.log("  ✓ NEXT_PUBLIC_GROWTH_ENGINE_ENABLED exposed for client gating")

  const placeholderSrc = readFileSync("components/settings/workspace-settings-phase-placeholder.tsx", "utf8")
  assert.match(placeholderSrc, /Coming in \{phaseLabel\}/)
  assert.match(placeholderSrc, /Open existing configuration/)
  assert.match(placeholderSrc, /variant === "admin"/)
  console.log("  ✓ placeholder shell supports phased copy + existing config CTA")

  const dataAdminSectionPageSrc = readFileSync("components/settings/workspace-settings-section-page.tsx", "utf8")
  assert.match(dataAdminSectionPageSrc, /variant="admin"/)
  assert.doesNotMatch(dataAdminSectionPageSrc, /Coming in Phase/)
  console.log("  ✓ Data & Administration section page uses admin placeholder variant")

  const dataAdminPlaceholderSrc = readFileSync(
    "lib/settings/workspace-settings-data-admin-placeholder.ts",
    "utf8",
  )
  assert.match(dataAdminPlaceholderSrc, /Administrative Tools/)
  assert.match(dataAdminPlaceholderSrc, /deliverability-operations/)
  assert.doesNotMatch(dataAdminPlaceholderSrc, /Coming in Phase/)
  for (const id of dataAdminSections) {
    const copy = resolveWorkspaceSettingsDataAdminPlaceholderCopy(id)
    assert.doesNotMatch(copy.title, /Coming in Phase/i)
    assert.doesNotMatch(copy.description, /migrate in later phases/i)
    assert.doesNotMatch(copy.description, /migration completes/i)
  }
  const deliverabilityCopy = resolveWorkspaceSettingsDataAdminPlaceholderCopy("deliverability-operations")
  assert.equal(deliverabilityCopy.title, "Deliverability Operations")
  assert.match(deliverabilityCopy.description, /sender health, deliverability diagnostics/)
  assert.equal(
    resolveWorkspaceSettingsDataAdminPlaceholderCopy("governance-exports").title,
    "Administrative Tools",
  )
  console.log("  ✓ Data & Administration placeholders use admin/support copy without phase language")

  const growthPageSrc = readFileSync(
    "app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx",
    "utf8",
  )
  assert.match(growthPageSrc, /growthEngineCustomerSettingsHref/)
  assert.match(growthPageSrc, /redirect\(/)
  assert.doesNotMatch(growthPageSrc, /fetch\(/)
  console.log("  ✓ growth-engine legacy routes redirect to canonical Growth settings")

  const dataAdminPageSrc = readFileSync(
    "app/(dashboard)/settings/data-administration/[sectionId]/page.tsx",
    "utf8",
  )
  assert.match(dataAdminPageSrc, /WorkspaceSettingsSectionPage/)
  assert.match(dataAdminPageSrc, /sectionId=\{sectionId\}/)
  assert.doesNotMatch(dataAdminPageSrc, /section=\{section\}/)
  console.log("  ✓ data-administration pages pass sectionId only (no RSC icon serialization)")

  assert.equal(
    `${WORKSPACE_SETTINGS_GROWTH_ENGINE_BASE}/${WORKSPACE_SETTINGS_GROWTH_ENGINE_DEFAULT_SECTION_ID}`,
    "/settings/growth-engine/connected-mailboxes",
  )
  assert.equal(
    `${WORKSPACE_SETTINGS_DATA_ADMIN_BASE}/${WORKSPACE_SETTINGS_DATA_ADMIN_DEFAULT_SECTION_ID}`,
    "/settings/data-administration/governance-exports",
  )
  console.log("  ✓ default section redirects resolve")

  process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED = "true"
  assert.equal(isGrowthEngineEnabledClient(), true)
  assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: true }), true)
  assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: false }), false)
  process.env.NEXT_PUBLIC_GROWTH_ENGINE_ENABLED = "false"
  assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: true }), true)
  assert.equal(isGrowthEngineSettingsNavVisible({ isPlatformAdmin: false }), false)
  assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: true }), true)
  assert.equal(isDataAdministrationSettingsNavVisible({ isPlatformAdmin: false }), false)
  console.log("  ✓ visibility gating helpers behave as expected (platform admin only, not env flag)")

  const growthOperatorGroup = WORKSPACE_SETTINGS_GENERAL_GROUPS.find((group) => group.id === "general-growth-operator")
  assert.equal(growthOperatorGroup, undefined)
  console.log("  ✓ Growth Operator removed from Core settings nav (canonical: /growth/settings/*)")

  console.log("\nWorkspace Settings GE-SET-2 verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: WORKSPACE_SETTINGS_NAV_QA_MARKER,
        growth_engine_sections: growthSections.length,
        data_admin_sections: dataAdminSections.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
