/**
 * Phase 8B — Growth workspace settings persistence foundation audit.
 *
 * Usage: pnpm test:growth-workspace-settings-persistence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_MIGRATION,
  GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS,
  GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
  isGrowthWorkspaceSettingsPersistedSection,
} from "../lib/growth/settings/growth-workspace-settings-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import {
  assertGrowthCommandPaletteRegistryParity,
  resolveGrowthCommandPaletteHref,
} from "../lib/growth/navigation/growth-command-palette-derivation"

const MODULE_PATHS = [
  "supabase/migrations/20270828120000_growth_operator_workspace_preferences_8b.sql",
  "lib/growth/settings/growth-workspace-settings-types.ts",
  "lib/growth/settings/growth-workspace-settings-options.ts",
  "lib/growth/settings/growth-workspace-settings-repository.ts",
  "lib/growth/settings/growth-workspace-profile-service.ts",
  "lib/growth/settings/growth-workspace-settings-api-access.ts",
  "lib/growth/settings/growth-workspace-settings-schema-health.ts",
  "hooks/growth/use-growth-workspace-settings-resource.ts",
  "components/growth/settings/growth-settings-section-page.tsx",
  "components/growth/settings/growth-settings-section-form-state.tsx",
  "components/growth/settings/growth-settings-profile-panel.tsx",
  "components/growth/settings/growth-settings-notifications-panel.tsx",
  "components/growth/settings/growth-settings-personal-preferences-panel.tsx",
  "components/growth/settings/growth-settings-sidebar-preferences-panel.tsx",
  "components/growth/settings/growth-settings-default-views-panel.tsx",
  "app/api/growth/workspace/settings/profile/route.ts",
  "app/api/growth/workspace/settings/notifications/route.ts",
  "app/api/growth/workspace/settings/personal-preferences/route.ts",
  "app/api/growth/workspace/settings/sidebar-preferences/route.ts",
  "app/api/growth/workspace/settings/default-views/route.ts",
] as const

const API_ROUTES = [
  "profile",
  "notifications",
  "personal-preferences",
  "sidebar-preferences",
  "default-views",
] as const

function runAudit(): void {
  console.log(`\n=== Growth workspace settings persistence audit (${GROWTH_WORKSPACE_SETTINGS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_WORKSPACE_SETTINGS_QA_MARKER, "growth-workspace-settings-persistence-8b-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_MIGRATION, "20270828120000_growth_operator_workspace_preferences_8b.sql")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-1a-v1")
  console.log("  ✓ QA markers + migration id")

  for (const relativePath of MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ foundation module files exist")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS.length, 5)
  for (const sectionId of GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS) {
    assert.ok(isGrowthWorkspaceSettingsPersistedSection(sectionId))
    assert.ok(
      fs.existsSync(path.join(process.cwd(), `app/(growth)/growth/settings/${sectionId}/page.tsx`)),
      `Missing settings page: ${sectionId}`,
    )
  }
  console.log("  ✓ five persisted settings sections declared")

  const sectionPage = fs.readFileSync(
    path.join(process.cwd(), "components/growth/settings/growth-settings-section-page.tsx"),
    "utf8",
  )
  assert.match(sectionPage, /isGrowthWorkspaceSettingsPersistedSection/)
  assert.match(sectionPage, /GrowthSettingsPersistedPanel/)
  assert.match(sectionPage, /GrowthSettingsSectionPlaceholder/)
  console.log("  ✓ section page routes persisted panels; placeholders remain for unmigrated sections")

  const hookSource = fs.readFileSync(
    path.join(process.cwd(), "hooks/growth/use-growth-workspace-settings-resource.ts"),
    "utf8",
  )
  assert.match(hookSource, /setValue\(optimistic\)/)
  assert.match(hookSource, /setValue\(previous\)/)
  console.log("  ✓ optimistic update hook applies rollback on failure")

  for (const route of API_ROUTES) {
    const apiSource = fs.readFileSync(
      path.join(process.cwd(), `app/api/growth/workspace/settings/${route}/route.ts`),
      "utf8",
    )
    assert.match(apiSource, /requireGrowthWorkspaceSettingsAccess/)
    assert.match(apiSource, /export async function GET/)
    assert.match(apiSource, /export async function PATCH/)
  }
  console.log("  ✓ workspace settings APIs expose GET/PATCH behind growth access gate")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270828120000_growth_operator_workspace_preferences_8b.sql"),
    "utf8",
  )
  assert.match(migration, /growth\.operator_workspace_preferences/)
  assert.match(migration, /email_notifications_enabled/)
  console.log("  ✓ migration creates workspace preferences + email notification column")

  const notificationRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-preferences-repository.ts"),
    "utf8",
  )
  assert.match(notificationRepo, /email_notifications_enabled/)
  console.log("  ✓ SN-9 repository reads/writes email notification preference")

  const placeholderSections = listGrowthWorkspaceSettingsSectionIds().filter(
    (id) => !isGrowthWorkspaceSettingsPersistedSection(id),
  )
  assert.equal(placeholderSections.length, 15)
  const communicationsSection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/settings/growth-settings-section-placeholder.tsx"),
    "utf8",
  )
  assert.match(communicationsSection, /adminFallbackHref/)
  console.log("  ✓ fifteen non-persisted nav sections (communications, workspace links, compliance, AI, advanced)")

  const settingsCmdK = resolveGrowthCommandPaletteHref(
    `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    "/admin/growth/settings/growth",
  )
  assert.equal(settingsCmdK, `${GROWTH_WORKSPACE_BASE_PATH}/settings`)
  assertGrowthCommandPaletteRegistryParity()
  console.log("  ✓ Cmd+K rewrites and registry parity unchanged")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_DEFAULT_SECTION_ID, "profile")
  console.log("  ✓ settings index still defaults to profile")

  console.log("\nGrowth workspace settings persistence audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
        nav_qa_marker: GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
        persisted_sections: GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS.length,
        placeholder_sections: placeholderSections.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
