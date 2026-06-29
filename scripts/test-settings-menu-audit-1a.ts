/**
 * SETTINGS-MENU-AUDIT-1A — Core vs Growth settings menu separation certification.
 *
 * Run: pnpm test:settings-menu-audit-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import {
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  buildWorkspaceSettingsRootCategories,
  listWorkspaceSettingsDataAdminSectionIds,
} from "../lib/settings/workspace-settings-navigation"

export const SETTINGS_MENU_AUDIT_1A_QA_MARKER = "settings-menu-audit-1a-v1" as const

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function pageExistsForHref(href: string): boolean {
  if (href.startsWith("/settings/")) {
    const segment = href.replace(/^\/settings\/?/, "")
    const exact = path.join(ROOT, "app/(dashboard)/settings", segment, "page.tsx")
    if (fs.existsSync(exact)) return true

    const parts = segment.split("/")
    if (parts.length >= 2) {
      const parent = parts.slice(0, -1).join("/")
      const sectionId = parts.at(-1)!
      const dynamic = path.join(ROOT, "app/(dashboard)/settings", parent, "[sectionId]", "page.tsx")
      if (fs.existsSync(dynamic) && listWorkspaceSettingsDataAdminSectionIds().includes(sectionId)) {
        return true
      }
    }
    return false
  }
  if (href.startsWith("/growth/settings/")) {
    const segment = href.replace(/^\/growth\/settings\/?/, "")
    return fs.existsSync(path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx"))
  }
  return true
}

function collectCoreNavHrefs(): string[] {
  const categories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: true,
    },
  })
  return categories.flatMap((category) => category.groups.flatMap((group) => group.items.map((item) => item.href)))
}

function collectGrowthNavHrefs(): string[] {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
}

function main(): void {
  console.log(`\n=== SETTINGS-MENU-AUDIT-1A (${SETTINGS_MENU_AUDIT_1A_QA_MARKER}) ===\n`)

  assert.equal(
    WORKSPACE_SETTINGS_GENERAL_GROUPS.some((group) => group.id === "general-growth-operator"),
    false,
    "Core settings must not include Growth Operator group",
  )
  console.log("  ✓ Core settings nav excludes Growth Operator group")

  const coreCategories = buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: true,
    },
  })
  assert.equal(
    coreCategories.some((category) => category.id === "growth_engine"),
    false,
    "Core settings must not include Growth Engine category",
  )
  console.log("  ✓ Core settings nav excludes Growth Engine category")

  const coreHrefs = collectCoreNavHrefs()
  const growthHrefsInCore = coreHrefs.filter((href) => href.includes("/growth/settings"))
  assert.deepEqual(growthHrefsInCore, [], `Core nav must not link to Growth settings: ${growthHrefsInCore.join(", ")}`)
  console.log("  ✓ Core settings nav contains no /growth/settings hrefs")

  for (const href of coreHrefs) {
    assert.ok(href.startsWith("/settings/"), `Core nav href must stay under /settings/*: ${href}`)
    assert.ok(pageExistsForHref(href), `Core nav item missing page: ${href}`)
  }
  console.log(`  ✓ ${coreHrefs.length} visible Core nav items resolve to /settings/* pages`)

  const growthSectionIds = listGrowthWorkspaceSettingsSectionIds()
  for (const requiredId of [
    "profile",
    "notifications",
    "communications",
    "mailboxes",
    "ai-teammate",
    "ai-preferences",
    "autonomy",
    "compliance",
    "calling-preferences",
    "calendar-preferences",
  ]) {
    assert.ok(growthSectionIds.includes(requiredId), `Growth nav missing section: ${requiredId}`)
  }
  console.log("  ✓ Growth settings nav includes canonical Growth/AI OS sections")

  const growthHrefs = collectGrowthNavHrefs()
  for (const href of growthHrefs) {
    assert.ok(
      href.startsWith("/growth/settings"),
      `Growth nav href must stay under /growth/settings/*: ${href}`,
    )
    assert.ok(pageExistsForHref(href), `Growth nav item missing page: ${href}`)
  }
  console.log(`  ✓ ${growthHrefs.length} visible Growth nav items resolve to /growth/settings/* pages`)

  for (const coreRoute of ["general", "permissions", "api"]) {
    assert.ok(pageExistsForHref(`/settings/${coreRoute}`), `expected Core route: /settings/${coreRoute}`)
  }
  for (const growthRoute of ["profile", "communications", "ai-teammate"]) {
    assert.ok(pageExistsForHref(`/growth/settings/${growthRoute}`), `expected Growth route: /growth/settings/${growthRoute}`)
  }
  console.log("  ✓ canonical Core + Growth settings routes exist")

  const growthOperatorSectionPage = read("app/(dashboard)/settings/growth-operator/[sectionId]/page.tsx")
  assert.match(growthOperatorSectionPage, /redirect\(/)
  assert.match(growthOperatorSectionPage, /GROWTH_WORKSPACE_BASE_PATH/)
  assert.doesNotMatch(growthOperatorSectionPage, /WorkspaceSettingsGrowthOperatorSectionPage/)
  console.log("  ✓ legacy /settings/growth-operator/* redirects to /growth/settings/*")

  const growthEngineSectionPage = read("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.match(growthEngineSectionPage, /redirect\(/)
  assert.match(growthEngineSectionPage, /growthEngineCustomerSettingsHref/)
  console.log("  ✓ legacy /settings/growth-engine/* redirects to canonical Growth settings")

  const callingPreferencesPage = read("app/(growth)/growth/settings/calling-preferences/page.tsx")
  assert.match(callingPreferencesPage, /sectionId="calling-preferences"/)
  console.log("  ✓ calling-preferences Growth settings page registered")

  console.log("\nSETTINGS-MENU-AUDIT-1A verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: SETTINGS_MENU_AUDIT_1A_QA_MARKER,
        core_nav_items: coreHrefs.length,
        growth_nav_items: growthHrefs.length,
      },
      null,
      2,
    ),
  )
}

main()
