/**
 * SETTINGS-MENU-COMPLETENESS-AUDIT-1B — Core, Growth, and Platform Admin fallback settings certification.
 *
 * Run: pnpm test:settings-menu-completeness-audit-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { getOrgPermissionsForRole } from "../lib/permissions/model"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsPageOnlySectionIds,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import { GROWTH_NAV_GROUP_DEFS } from "../lib/growth/navigation/growth-navigation-destinations"
import { isGrowthWorkspaceSettingsPersistedSection } from "../lib/growth/settings/growth-workspace-settings-types"
import {
  buildWorkspaceSettingsRootCategories,
  listWorkspaceSettingsDataAdminSectionIds,
  listWorkspaceSettingsGrowthEngineSectionIds,
  WORKSPACE_SETTINGS_GENERAL_GROUPS,
  WORKSPACE_SETTINGS_PLAN_GROUPS,
} from "../lib/settings/workspace-settings-navigation"

export const SETTINGS_MENU_COMPLETENESS_AUDIT_1B_QA_MARKER =
  "settings-menu-completeness-audit-1b-v1" as const

const ROOT = process.cwd()

const CORE_GROWTH_ONLY_LABELS = [
  "AI Teammate",
  "Copilot Preferences",
  "Calling Providers",
  "Connected Mailboxes",
  "Growth Autonomy",
  "Voice & Calling",
  "Growth Engine",
  "Growth Operator",
] as const

const GROWTH_CANONICAL_SECTION_IDS = [
  "profile",
  "notifications",
  "personal-preferences",
  "sidebar-preferences",
  "default-views",
  "communications",
  "mailboxes",
  "sending-domains",
  "deliverability",
  "warmup",
  "sender-pools",
  "reputation",
  "calling-preferences",
  "calendar-preferences",
  "calendar",
  "ai-teammate",
  "ai-preferences",
  "autonomy",
  "compliance",
  "advanced",
] as const

const ADMIN_FALLBACK_NAV_HREFS = [
  "/admin/growth/settings/growth",
  "/admin/growth/settings/communications",
  "/admin/growth/calls/providers",
  "/admin/growth/voice/readiness",
  "/admin/growth/settings/provider-health",
  "/admin/growth/settings/governance",
] as const

const DATA_ADMIN_FALLBACK_HREFS = [
  "/admin/growth/settings/governance",
  "/admin/growth/settings/provider-health",
  "/admin/growth/providers/deliverability-ops",
  "/settings/audit-log",
] as const

type RouteResolution = "page" | "dynamic-section" | "redirect" | "missing"

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function resolveRoute(href: string): RouteResolution {
  if (href.startsWith("/settings/")) {
    const segment = href.replace(/^\/settings\/?/, "")
    const exact = path.join(ROOT, "app/(dashboard)/settings", segment, "page.tsx")
    if (fs.existsSync(exact)) {
      const src = fs.readFileSync(exact, "utf8")
      if (/redirect\s*\(/.test(src)) return "redirect"
      return "page"
    }

    const parts = segment.split("/")
    if (parts.length >= 2) {
      const parent = parts.slice(0, -1).join("/")
      const sectionId = parts.at(-1)!
      const dynamic = path.join(ROOT, "app/(dashboard)/settings", parent, "[sectionId]", "page.tsx")
      if (fs.existsSync(dynamic)) {
        if (listWorkspaceSettingsDataAdminSectionIds().includes(sectionId)) return "dynamic-section"
        if (parent === "growth-engine" || parent === "growth-operator") return "redirect"
      }
    }
    return "missing"
  }

  if (href.startsWith("/growth/settings/")) {
    const segment = href.replace(/^\/growth\/settings\/?/, "")
    const exact = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
    if (!fs.existsSync(exact)) return "missing"
    const src = fs.readFileSync(exact, "utf8")
    if (/redirect\s*\(/.test(src)) return "redirect"
    return "page"
  }

  if (href.startsWith("/admin/")) {
    const exact = path.join(ROOT, "app/(admin)/admin", href.replace(/^\/admin\/?/, ""), "page.tsx")
    return fs.existsSync(exact) ? "page" : "missing"
  }

  return "page"
}

function classifyGrowthPagePlaceholder(sectionId: string, pageSrc: string): boolean {
  if (isGrowthWorkspaceSettingsPersistedSection(sectionId)) return false
  if (sectionId === "ai-preferences" && pageSrc.includes("GrowthAiCopilotSettingsPanel")) return false
  if (sectionId === "autonomy" && pageSrc.includes("GrowthAutonomyControlCenter")) return false
  if (sectionId === "compliance" && pageSrc.includes("GrowthComplianceDashboardPanel")) return false
  if (sectionId === "communications" && pageSrc.includes("GrowthCommunicationsSettingsHub")) return false
  if (sectionId === "advanced" && pageSrc.includes("GrowthSettingsAdvancedHub")) return false
  if (sectionId === "signatures" && pageSrc.includes("GrowthEmailSignaturesPanel")) return false
  if (sectionId === "calling-preferences" && pageSrc.includes("GrowthSettingsCallingPreferencesPage")) return false
  if (sectionId === "calendar-preferences" && pageSrc.includes("GrowthSettingsCalendarPreferencesPage")) return false
  if (sectionId === "calendar" && pageSrc.includes("GrowthSettingsCalendarPage")) return false
  if (sectionId === "browser-notifications" && pageSrc.includes("GrowthSettingsBrowserNotificationsPage")) return false
  if (pageSrc.includes("redirect(")) return false
  if (pageSrc.includes("GrowthCommunicationsSettingsSection")) return false
  if (pageSrc.includes("GrowthSettingsSectionPlaceholder")) return true
  if (pageSrc.includes("GrowthSettingsSectionPage")) return true
  return false
}

function collectCoreNavItems() {
  return buildWorkspaceSettingsRootCategories({
    planCategoryLabel: "Equipify Scale",
    ctx: {
      permissions: getOrgPermissionsForRole("owner"),
      growthEngineNavVisible: true,
      dataAdministrationNavVisible: true,
    },
  }).flatMap((category) =>
    category.groups.flatMap((group) =>
      group.items.map((item) => ({
        group: group.label,
        label: item.label,
        href: item.href,
        resolution: resolveRoute(item.href),
      })),
    ),
  )
}

function collectGrowthNavItems() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => {
      const segment = item.href.replace(/^\/growth\/settings\/?/, "")
      const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
      const pageSrc = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : ""
      return {
        group: group.label,
        label: item.label,
        href: item.href,
        resolution: resolveRoute(item.href),
        placeholder: classifyGrowthPagePlaceholder(item.id, pageSrc),
        adminFallbackHref: item.adminFallbackHref,
      }
    }),
  )
}

function collectAdminFallbackNavItems() {
  const settingsGroup = GROWTH_NAV_GROUP_DEFS.find((group) => group.id === "settings")
  assert.ok(settingsGroup, "Platform Admin settings nav group must exist")
  return settingsGroup.items.map((item) => ({
    area: "Platform Admin → Settings",
    label: item.label,
    href: item.href,
    resolution: resolveRoute(item.href),
  }))
}

function collectPlaceholderInventory() {
  const placeholders: Array<{
    route: string
    menuOwner: string
    evidence: string
    location: string
  }> = []

  for (const item of collectGrowthNavItems()) {
    if (!item.placeholder) continue
    placeholders.push({
      route: item.href,
      menuOwner: "Growth",
      evidence: "GrowthSettingsSectionPage → GrowthSettingsSectionPlaceholder (Phase 7D+ / no persistence)",
      location: `app/(growth)/growth/settings/${item.href.replace(/^\/growth\/settings\/?/, "")}/page.tsx`,
    })
  }

  for (const sectionId of listWorkspaceSettingsDataAdminSectionIds()) {
    placeholders.push({
      route: `/settings/data-administration/${sectionId}`,
      menuOwner: "Core (Data & Administration, platform admin only)",
      evidence: "WorkspaceSettingsPhasePlaceholder variant=admin",
      location: "components/settings/workspace-settings-section-page.tsx",
    })
  }

  for (const sectionId of listGrowthWorkspaceSettingsPageOnlySectionIds()) {
    const route = `/growth/settings/${sectionId}`
    const pagePath = path.join(ROOT, "app/(growth)/growth/settings", sectionId, "page.tsx")
    if (!fs.existsSync(pagePath)) continue
    const src = fs.readFileSync(pagePath, "utf8")
    if (!classifyGrowthPagePlaceholder(sectionId, src)) continue
    placeholders.push({
      route,
      menuOwner: "Growth (Advanced hub / legacy alias, not top-level nav)",
      evidence: "GrowthSettingsSectionPage → GrowthSettingsSectionPlaceholder",
      location: `app/(growth)/growth/settings/${sectionId}/page.tsx`,
    })
  }

  return placeholders
}

function main(): void {
  console.log(`\n=== SETTINGS-MENU-COMPLETENESS-AUDIT-1B (${SETTINGS_MENU_COMPLETENESS_AUDIT_1B_QA_MARKER}) ===\n`)

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

  const coreItems = collectCoreNavItems()
  const coreHrefs = coreItems.map((item) => item.href)
  const growthHrefsInCore = coreHrefs.filter((href) => href.includes("/growth/settings"))
  assert.deepEqual(growthHrefsInCore, [], `Core nav must not link to /growth/settings: ${growthHrefsInCore.join(", ")}`)
  console.log("  ✓ Core settings nav contains no /growth/settings hrefs")

  for (const href of coreHrefs) {
    assert.ok(href.startsWith("/settings/"), `Core nav href must stay under /settings/*: ${href}`)
  }

  const growthOnlyLabelsInCore = coreItems
    .map((item) => item.label)
    .filter((label) => CORE_GROWTH_ONLY_LABELS.includes(label as (typeof CORE_GROWTH_ONLY_LABELS)[number]))
  assert.deepEqual(
    growthOnlyLabelsInCore,
    [],
    `Core nav must not expose Growth/AI OS-only items: ${growthOnlyLabelsInCore.join(", ")}`,
  )
  console.log("  ✓ Core settings nav contains no Growth/AI OS-only items")

  const brokenCore = coreItems.filter((item) => item.resolution === "missing")
  assert.deepEqual(
    brokenCore.map((item) => item.href),
    [],
    `Core nav items must resolve: ${brokenCore.map((item) => item.href).join(", ")}`,
  )
  console.log(`  ✓ ${coreItems.length} visible Core nav items resolve (page, redirect, or dynamic section)`)

  const growthSectionIds = listGrowthWorkspaceSettingsSectionIds()
  for (const requiredId of GROWTH_CANONICAL_SECTION_IDS) {
    assert.ok(growthSectionIds.includes(requiredId), `Growth nav missing canonical section: ${requiredId}`)
  }
  console.log("  ✓ Growth settings nav includes all canonical Growth/AI OS sections")

  const growthItems = collectGrowthNavItems()
  for (const item of growthItems) {
    assert.ok(
      item.href.startsWith("/growth/settings"),
      `Growth nav href must stay under /growth/settings/*: ${item.href}`,
    )
    assert.notEqual(item.resolution, "missing", `Growth nav item missing route: ${item.href}`)
  }
  console.log(`  ✓ ${growthItems.length} visible Growth nav items resolve`)

  for (const href of ADMIN_FALLBACK_NAV_HREFS) {
    assert.notEqual(resolveRoute(href), "missing", `Admin fallback route must exist: ${href}`)
  }
  console.log("  ✓ Platform Admin fallback settings routes are discoverable")

  for (const href of DATA_ADMIN_FALLBACK_HREFS) {
    assert.notEqual(resolveRoute(href), "missing", `Data admin fallback route must exist: ${href}`)
  }
  console.log("  ✓ Core Data & Administration fallback targets resolve")

  const growthEngineIds = listWorkspaceSettingsGrowthEngineSectionIds()
  assert.ok(growthEngineIds.length > 0, "Growth Engine section registry retained for legacy redirects")
  const growthEngineSectionPage = read("app/(dashboard)/settings/growth-engine/[sectionId]/page.tsx")
  assert.match(growthEngineSectionPage, /redirect\(/)
  assert.match(growthEngineSectionPage, /growthEngineCustomerSettingsHref/)
  console.log("  ✓ legacy /settings/growth-engine/* redirects to canonical Growth settings")

  const growthOperatorSectionPage = read("app/(dashboard)/settings/growth-operator/[sectionId]/page.tsx")
  assert.match(growthOperatorSectionPage, /redirect\(/)
  assert.match(growthOperatorSectionPage, /GROWTH_WORKSPACE_BASE_PATH/)
  console.log("  ✓ legacy /settings/growth-operator/* redirects to /growth/settings/*")

  const callingPreferencesPage = read("app/(growth)/growth/settings/calling-preferences/page.tsx")
  assert.match(callingPreferencesPage, /GrowthSettingsCallingPreferencesPage/)
  console.log("  ✓ /growth/settings/calling-preferences resolves (wired operator page, not 404)")

  for (const segment of ["calendar-preferences", "calendar"]) {
    const page = read(`app/(growth)/growth/settings/${segment}/page.tsx`)
    assert.doesNotMatch(page, /GrowthSettingsSectionPage sectionId=/)
    assert.match(page, /GrowthSettingsCalendar/)
  }
  console.log("  ✓ calendar Growth settings routes resolve")

  const planLabels = WORKSPACE_SETTINGS_PLAN_GROUPS.flatMap((group) => group.items.map((item) => item.label))
  assert.ok(!planLabels.includes("Voice & Calling"), "Voice & Calling must not appear in Core plan nav")
  console.log("  ✓ Voice & Calling removed from Core /settings/* nav")

  const adminFallbackItems = collectAdminFallbackNavItems()
  const operatorHrefSet = new Set(growthItems.map((item) => item.href))
  const accidentalAdminDuplicates = adminFallbackItems.filter((item) => operatorHrefSet.has(item.href))
  assert.deepEqual(
    accidentalAdminDuplicates.map((item) => item.href),
    [],
    `Admin fallback nav must not reuse operator Growth settings hrefs: ${accidentalAdminDuplicates.map((item) => item.href).join(", ")}`,
  )
  console.log("  ✓ Platform Admin fallback nav does not reuse operator Growth settings hrefs")

  const placeholders = collectPlaceholderInventory()
  assert.ok(placeholders.length > 0, "Placeholder inventory must be non-empty for audit classification")

  console.log("\nSETTINGS-MENU-COMPLETENESS-AUDIT-1B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: SETTINGS_MENU_COMPLETENESS_AUDIT_1B_QA_MARKER,
        core_nav_items: coreItems.length,
        growth_nav_items: growthItems.length,
        admin_fallback_nav_items: adminFallbackItems.length,
        placeholder_routes: placeholders.length,
        broken_routes: [],
        placeholders,
      },
      null,
      2,
    ),
  )
}

main()
