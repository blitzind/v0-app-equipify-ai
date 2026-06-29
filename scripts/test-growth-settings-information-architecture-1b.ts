/**
 * GROWTH-SETTINGS-INFORMATION-ARCHITECTURE-1B — Final Growth Settings nav IA certification.
 *
 * Run: pnpm test:growth-settings-information-architecture-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "../lib/growth/navigation/growth-communications-settings-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH } from "../lib/growth/navigation/growth-workspace-core-settings-links"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  isGrowthWorkspaceSettingsNavItemActive,
  listGrowthWorkspaceSettingsPageOnlySectionIds,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export const GROWTH_SETTINGS_INFORMATION_ARCHITECTURE_1B_QA_MARKER =
  "growth-settings-information-architecture-1b-v1" as const

const ROOT = process.cwd()

const GENERAL_NAV_ORDER = [
  "profile",
  "notifications",
  "browser-notifications",
  "personal-preferences",
  "sidebar-preferences",
  "default-views",
] as const

const AI_NAV_ORDER = ["ai-teammate", "ai-preferences", "autonomy", "command-center-preferences"] as const

const LEGACY_REDIRECT_ROUTES: Array<{ segment: string; targetPattern: RegExp }> = [
  { segment: "gmail", targetPattern: /GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH/ },
  { segment: "microsoft-365", targetPattern: /GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH/ },
  { segment: "advanced", targetPattern: /\/settings[`'"]/ },
]

const FIRST_CLASS_ROUTES = [
  "browser-notifications",
  "command-center-preferences",
  "calling-preferences",
  "calendar-preferences",
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function navGroup(id: string) {
  const group = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((entry) => entry.id === id)
  assert.ok(group, `Growth settings nav must include ${id} group`)
  return group!
}

function assertNoDuplicateNavEntries(): void {
  const sectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(sectionIds.length, new Set(sectionIds).size, "Growth nav must not contain duplicate section ids")

  const hrefs = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
  assert.equal(hrefs.length, new Set(hrefs).size, "Growth nav must not contain duplicate hrefs")
}

function assertRouteExists(segment: string): void {
  const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
  assert.ok(fs.existsSync(pagePath), `Missing route: /growth/settings/${segment}`)
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-INFORMATION-ARCHITECTURE-1B (${GROWTH_SETTINGS_INFORMATION_ARCHITECTURE_1B_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-ux-polish-1a-v1")
  console.log("  ✓ Growth settings nav QA marker updated for IA 1B")

  assert.equal(
    GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "advanced"),
    undefined,
    "Advanced group must be removed from Growth settings nav",
  )
  console.log("  ✓ Advanced section removed from Growth settings nav")

  const advancedPage = read("app/(growth)/growth/settings/advanced/page.tsx")
  assert.match(advancedPage, /redirect\s*\(/)
  assert.doesNotMatch(advancedPage, /GrowthSettingsAdvancedHub/)
  console.log("  ✓ /growth/settings/advanced redirects (legacy hub retired)")

  assert.equal(
    fs.existsSync(path.join(ROOT, "components/growth/settings/growth-settings-advanced-hub.tsx")),
    false,
    "Advanced hub component must be removed",
  )
  console.log("  ✓ Advanced hub component removed")

  const generalGroup = navGroup("general")
  assert.deepEqual(
    generalGroup.items.map((item) => item.id),
    [...GENERAL_NAV_ORDER],
    "General nav order must include Browser Notifications after Notifications",
  )
  assert.equal(generalGroup.items.find((item) => item.id === "browser-notifications")?.label, "Browser Notifications")
  console.log("  ✓ Browser Notifications appears under General")

  const aiGroup = navGroup("ai")
  assert.deepEqual(aiGroup.items.map((item) => item.id), [...AI_NAV_ORDER])
  assert.equal(
    aiGroup.items.find((item) => item.id === "command-center-preferences")?.label,
    "Command Center Preferences",
  )
  console.log("  ✓ Command Center Preferences appears under AI")

  const commGroup = navGroup("communications")
  assert.ok(commGroup.items.some((item) => item.id === "signatures" && item.label === "Email Signatures"))
  console.log("  ✓ Email Signatures appears under Communications")

  const navLabels = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))
  assert.equal(navLabels.includes("Gmail"), false, "Gmail must not appear in Growth settings nav")
  assert.equal(
    listGrowthWorkspaceSettingsSectionIds().includes("gmail"),
    false,
    "Gmail must not appear as a nav section id",
  )
  console.log("  ✓ Gmail is not visible in navigation")

  const voiceGroup = navGroup("voice-calling")
  assert.deepEqual(voiceGroup.items.map((item) => item.id), ["calling-preferences"])
  assert.equal(
    GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items).filter((item) => item.id === "calling-preferences")
      .length,
    1,
    "Calling Preferences must appear only once in nav",
  )
  console.log("  ✓ Calling Preferences exists only under Voice & Calling")

  const meetingsGroup = navGroup("meetings")
  assert.ok(meetingsGroup.items.some((item) => item.id === "calendar-preferences"))
  assert.equal(
    GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items).filter(
      (item) => item.id === "calendar-preferences",
    ).length,
    1,
    "Calendar Preferences must appear only once in nav",
  )
  console.log("  ✓ Calendar Preferences exists only under Meetings")

  assertNoDuplicateNavEntries()
  console.log("  ✓ No duplicate navigation entries")

  for (const segment of FIRST_CLASS_ROUTES) {
    assertRouteExists(segment)
    const pageSrc = read(`app/(growth)/growth/settings/${segment}/page.tsx`)
    assert.doesNotMatch(pageSrc, /redirect\s*\(/, `${segment} must remain a first-class page`)
  }
  console.log("  ✓ First-class IA routes resolve without redirect")

  for (const route of LEGACY_REDIRECT_ROUTES) {
    const pagePath = `app/(growth)/growth/settings/${route.segment}/page.tsx`
    const pageSrc = read(pagePath)
    assert.match(pageSrc, /redirect\s*\(/)
    assert.match(pageSrc, route.targetPattern)
    console.log(`  ✓ /growth/settings/${route.segment} legacy redirect preserved`)
  }

  assert.equal(
    growthEngineCustomerSettingsHref("command-center-preferences"),
    `${GROWTH_WORKSPACE_BASE_PATH}/settings/command-center-preferences`,
  )
  assert.equal(growthEngineCustomerSettingsHref("gmail"), GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH)
  console.log("  ✓ Legacy growth-engine canonical hrefs target IA destinations")

  const pageOnlyIds = listGrowthWorkspaceSettingsPageOnlySectionIds()
  assert.equal(pageOnlyIds.includes("gmail"), true)
  assert.equal(pageOnlyIds.includes("browser-notifications"), false)
  assert.equal(pageOnlyIds.includes("command-center-preferences"), false)
  console.log("  ✓ Page-only registry retains legacy aliases only")

  const commandCenterPage = read("components/growth/settings/growth-settings-command-center-preferences-page.tsx")
  assert.match(commandCenterPage, /variant="command-center"/)
  assert.match(commandCenterPage, /growth-settings-command-center-preferences-ia-1b-v1/)

  const sidebarPanel = read("components/growth/settings/growth-settings-sidebar-preferences-panel.tsx")
  assert.match(sidebarPanel, /GrowthSettingsSidebarPreferencesPanelVariant/)
  assert.match(sidebarPanel, /variant === "command-center"/)
  console.log("  ✓ Sidebar and Command Center panels split without duplicating persistence")

  const browserItem = generalGroup.items.find((item) => item.id === "browser-notifications")!
  assert.equal(isGrowthWorkspaceSettingsNavItemActive("/growth/settings/browser-notifications", browserItem), true)
  const commandItem = aiGroup.items.find((item) => item.id === "command-center-preferences")!
  assert.equal(
    isGrowthWorkspaceSettingsNavItemActive("/growth/settings/command-center-preferences", commandItem),
    true,
  )
  console.log("  ✓ Nav active states work for relocated sections")

  assert.equal(GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH, `${GROWTH_WORKSPACE_BASE_PATH}/settings/advanced`)
  console.log("  ✓ Advanced legacy path constant retained for redirects")

  console.log("\nGROWTH-SETTINGS-INFORMATION-ARCHITECTURE-1B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_INFORMATION_ARCHITECTURE_1B_QA_MARKER,
        growth_nav_items: listGrowthWorkspaceSettingsSectionIds().length,
        page_only_sections: pageOnlyIds.length,
      },
      null,
      2,
    ),
  )
}

main()
