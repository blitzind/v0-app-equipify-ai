/**
 * GROWTH-SETTINGS-GENERAL-REFINEMENT-2B — General section UX polish certification.
 *
 * Run: pnpm test:growth-settings-general-refinement-2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_TIMEZONE_LABELS,
  resolveGrowthWorkspaceTimezoneLabel,
} from "../lib/growth/settings/growth-workspace-settings-options"
import { GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS } from "../lib/growth/settings/growth-workspace-settings-types"

export { GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER }

const ROOT = process.cwd()

const GENERAL_NAV_IDS = [
  "profile",
  "notifications",
  "browser-notifications",
  "personal-preferences",
  "sidebar-preferences",
  "default-views",
] as const

const GENERAL_ROUTES: Array<{ segment: string; panelPattern: RegExp }> = [
  { segment: "profile", panelPattern: /GrowthSettingsProfilePanel|GrowthSettingsSectionPage/ },
  { segment: "notifications", panelPattern: /GrowthSettingsNotificationsPanel|GrowthSettingsSectionPage/ },
  { segment: "browser-notifications", panelPattern: /GrowthSettingsBrowserNotificationsPage/ },
  { segment: "personal-preferences", panelPattern: /GrowthSettingsPersonalPreferencesPanel|GrowthSettingsSectionPage/ },
  { segment: "sidebar-preferences", panelPattern: /GrowthSettingsSidebarPreferencesPanel|GrowthSettingsSectionPage/ },
  { segment: "default-views", panelPattern: /GrowthSettingsDefaultViewsPanel|GrowthSettingsSectionPage/ },
]

const GENERAL_PANEL_FILES = [
  "components/growth/settings/growth-settings-profile-panel.tsx",
  "components/growth/settings/growth-settings-notifications-panel.tsx",
  "components/growth/settings/growth-settings-browser-notifications-page.tsx",
  "components/growth/settings/growth-settings-personal-preferences-panel.tsx",
  "components/growth/settings/growth-settings-sidebar-preferences-panel.tsx",
  "components/growth/settings/growth-settings-default-views-panel.tsx",
] as const

const PERSISTENCE_ENDPOINTS = [
  "/api/growth/workspace/settings/profile",
  "/api/growth/workspace/settings/notifications",
  "/api/growth/workspace/settings/personal-preferences",
  "/api/growth/workspace/settings/sidebar-preferences",
  "/api/growth/workspace/settings/default-views",
] as const

const FORBIDDEN_GENERAL_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Growth operator/i,
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function generalNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "general")!
}

function assertRouteExists(segment: string): void {
  const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
  assert.ok(fs.existsSync(pagePath), `Missing General route: /growth/settings/${segment}`)
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-GENERAL-REFINEMENT-2B (${GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER, "growth-settings-general-refinement-2b-v1")
  console.log("  ✓ General refinement QA marker")

  const generalGroup = generalNavGroup()
  assert.deepEqual(
    generalGroup.items.map((item) => item.id),
    [...GENERAL_NAV_IDS],
    "General nav group must remain unchanged",
  )
  console.log("  ✓ General navigation structure unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  for (const route of GENERAL_ROUTES) {
    assertRouteExists(route.segment)
    const pageSrc = read(`app/(growth)/growth/settings/${route.segment}/page.tsx`)
    assert.match(pageSrc, route.panelPattern)
    assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  }
  console.log("  ✓ All General routes load wired panels")

  for (const file of GENERAL_PANEL_FILES) {
    const src = read(file)
    assert.ok(
      src.includes("GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER") ||
        src.includes(GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER),
      `${file} must expose refinement marker`,
    )
    assert.match(src, /GROWTH_SETTINGS_SECTION_GAP/, `${file} must use shared section spacing`)
    assert.match(src, /GrowthWorkspacePageHeader/, `${file} must use shared page header`)
    const hasSaveUx =
      /GrowthSettingsSaveStatus/.test(src) ||
      /GrowthNotificationPushSubscribe/.test(src) ||
      (file.includes("browser-notifications") && /GrowthNotificationPushSubscribe/.test(src))
    assert.ok(hasSaveUx, `${file} must use shared save/status UX`)
    for (const pattern of FORBIDDEN_GENERAL_COPY) {
      assert.doesNotMatch(src, pattern, `${file} must not contain placeholder copy (${pattern})`)
    }
  }
  console.log("  ✓ General panels use consistent spacing, headers, and production copy")

  const profile = read("components/growth/settings/growth-settings-profile-panel.tsx")
  assert.match(profile, /Avatar/)
  assert.match(profile, /Identity/)
  assert.match(profile, /resolveGrowthWorkspaceTimezoneLabel/)
  console.log("  ✓ Profile identity hierarchy and timezone labels")

  const notifications = read("components/growth/settings/growth-settings-notifications-panel.tsx")
  assert.match(notifications, /NOTIFICATION_GROUP_META/)
  assert.match(notifications, /title="Delivery"/)
  assert.match(notifications, /NOTIFICATION_EVENT_LABELS/)
  console.log("  ✓ Notifications grouped by category with readable labels")

  const browserPush = read("components/growth/notifications/growth-notification-push-subscribe.tsx")
  assert.match(browserPush, /StatusRow/)
  assert.match(browserPush, /Current browser/)
  assert.match(browserPush, /Device registration/)
  assert.match(browserPush, /Enable notifications/)
  console.log("  ✓ Browser notifications status summary and primary action")

  const personal = read("components/growth/settings/growth-settings-personal-preferences-panel.tsx")
  assert.match(personal, /title="Appearance"/)
  assert.match(personal, /title="Startup"/)
  console.log("  ✓ Personal preferences organized by appearance and startup")

  const sidebar = read("components/growth/settings/growth-settings-sidebar-preferences-panel.tsx")
  assert.match(sidebar, /Start with sidebar collapsed/)
  assert.match(sidebar, /Resume route/)
  console.log("  ✓ Sidebar preferences wording refined")

  const defaultViews = read("components/growth/settings/growth-settings-default-views-panel.tsx")
  assert.match(defaultViews, /title="Inbox"/)
  assert.match(defaultViews, /title="Calls"/)
  assert.match(defaultViews, /title="Opportunities"/)
  console.log("  ✓ Default views split by module")

  for (const endpoint of PERSISTENCE_ENDPOINTS) {
    assert.ok(
      GENERAL_PANEL_FILES.some((file) => read(file).includes(endpoint)),
      `Persistence endpoint must remain wired: ${endpoint}`,
    )
  }
  assert.deepEqual(
    GROWTH_WORKSPACE_SETTINGS_PERSISTED_SECTION_IDS.filter((id) =>
      (GENERAL_NAV_IDS as readonly string[]).includes(id),
    ),
    ["profile", "notifications", "personal-preferences", "sidebar-preferences", "default-views"],
  )
  console.log("  ✓ Persistence endpoints and section registry unchanged")

  assert.equal(resolveGrowthWorkspaceTimezoneLabel("America/New_York").friendly, "Eastern Time")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_TIMEZONE_LABELS["America/New_York"].iana, "America/New_York")
  console.log("  ✓ Timezone display helpers")

  const navItemLink = read("components/settings/settings-nav-item-link.tsx")
  assert.match(navItemLink, /aria-current=\{active \? "page" : undefined\}/)
  const saveStatus = read("components/growth/settings/growth-settings-section-form-state.tsx")
  assert.match(saveStatus, /aria-live="polite"/)
  console.log("  ✓ Accessibility patterns retained")

  console.log("\nGROWTH-SETTINGS-GENERAL-REFINEMENT-2B verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
        general_routes: GENERAL_ROUTES.length,
        general_nav_items: GENERAL_NAV_IDS.length,
      },
      null,
      2,
    ),
  )
}

main()
