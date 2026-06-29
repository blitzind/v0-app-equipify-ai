/**
 * GROWTH-SETTINGS-UX-POLISH-1A — Growth Settings UX consistency certification.
 *
 * Run: pnpm test:growth-settings-ux-polish-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_PAGE_HEADER_ICON,
  GROWTH_SETTINGS_SECTION_GAP,
  GROWTH_SETTINGS_UX_POLISH_QA_MARKER,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"
import {
  GROWTH_WORKSPACE_SETTINGS_SHELL_BODY,
  GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT,
  GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER,
  GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR,
} from "../lib/growth/settings/growth-workspace-settings-shell-tokens"
import { SETTINGS_NAV_GROUPS } from "../lib/settings/settings-nav-chrome"

export { GROWTH_SETTINGS_UX_POLISH_QA_MARKER }

const ROOT = process.cwd()

const PRIMARY_SETTINGS_PAGES: Array<{ segment: string; headerPattern: RegExp }> = [
  { segment: "profile", headerPattern: /GrowthSettingsSectionPage|GrowthSettingsProfilePanel/ },
  { segment: "notifications", headerPattern: /GrowthSettingsSectionPage|GrowthSettingsNotificationsPanel/ },
  { segment: "browser-notifications", headerPattern: /GrowthSettingsBrowserNotificationsPage/ },
  { segment: "personal-preferences", headerPattern: /GrowthSettingsSectionPage|GrowthSettingsPersonalPreferencesPanel/ },
  { segment: "sidebar-preferences", headerPattern: /GrowthSettingsSectionPage|GrowthSettingsSidebarPreferencesPanel/ },
  { segment: "default-views", headerPattern: /GrowthSettingsSectionPage|GrowthSettingsDefaultViewsPanel/ },
  { segment: "communications", headerPattern: /GrowthCommunicationsSettingsHub/ },
  { segment: "signatures", headerPattern: /GrowthWorkspacePageHeader/ },
  { segment: "calling-preferences", headerPattern: /GrowthSettingsCallingPreferencesPage/ },
  { segment: "calendar-preferences", headerPattern: /GrowthSettingsCalendarPreferencesPage/ },
  { segment: "calendar", headerPattern: /GrowthSettingsCalendarPage/ },
  { segment: "ai-teammate", headerPattern: /GrowthAiTeammateSettingsPanel/ },
  { segment: "ai-preferences", headerPattern: /GrowthWorkspacePageHeader/ },
  { segment: "autonomy", headerPattern: /GrowthAutonomyControlCenter/ },
  { segment: "command-center-preferences", headerPattern: /GrowthSettingsCommandCenterPreferencesPage/ },
  { segment: "compliance", headerPattern: /GrowthWorkspacePageHeader/ },
  { segment: "communications/connected-mailboxes", headerPattern: /GrowthCommunicationsSettingsSection/ },
  { segment: "communications/warmup", headerPattern: /GrowthCommunicationsSettingsSection/ },
]

const FORBIDDEN_USER_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /\bLorem\b/i,
  /\bDummy\b/i,
  /not yet implemented/i,
  /\bmigration hub\b/i,
  /canonical migration/i,
  /Admin fallback/i,
  /Growth Engine/i,
  /Growth Operator/i,
  /Growth operator workspace/i,
  /no duplicate forms or APIs/i,
] as const

const SETTINGS_COPY_PATHS = [
  "components/growth/settings",
  "app/(growth)/growth/settings",
] as const

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function listSourceFiles(relativeDir: string): string[] {
  const abs = path.join(ROOT, relativeDir)
  if (!fs.existsSync(abs)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const next = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) results.push(...listSourceFiles(next))
    else if (/\.(tsx|ts)$/.test(entry.name)) results.push(next)
  }
  return results
}

function stripCodeArtifacts(source: string): string {
  return source
    .replace(/placeholder=\{[^}]+\}/g, "")
    .replace(/placeholder="[^"]*"/g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

function assertNoForbiddenUserCopy(): void {
  for (const relativeDir of SETTINGS_COPY_PATHS) {
    for (const file of listSourceFiles(relativeDir)) {
      const source = stripCodeArtifacts(read(file))
      for (const pattern of FORBIDDEN_USER_COPY) {
        assert.doesNotMatch(source, pattern, `${file} must not expose placeholder copy (${pattern})`)
      }
    }
  }
}

function assertRouteExists(segment: string): void {
  const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
  assert.ok(fs.existsSync(pagePath), `Missing settings route: /growth/settings/${segment}`)
}

function main(): void {
  console.log(`\n=== GROWTH-SETTINGS-UX-POLISH-1A (${GROWTH_SETTINGS_UX_POLISH_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SETTINGS_UX_POLISH_QA_MARKER, "growth-settings-ux-polish-1a-v1")
  assert.equal(GROWTH_WORKSPACE_SETTINGS_NAV_QA_MARKER, "growth-workspace-settings-nav-ux-polish-1a-v1")
  assert.equal(GROWTH_SETTINGS_PAGE_HEADER_ICON, "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300")
  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ UX polish QA markers and layout tokens")

  const sectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(sectionIds.length, new Set(sectionIds).size, "Growth nav must not contain duplicate section ids")
  const hrefs = GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))
  assert.equal(hrefs.length, new Set(hrefs).size, "Growth nav must not contain duplicate hrefs")
  console.log("  ✓ No duplicate navigation entries")

  for (const item of GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.flatMap((group) => group.items)) {
    assertRouteExists(item.href.replace(/^\/growth\/settings\/?/, ""))
  }
  console.log("  ✓ All Growth settings nav routes resolve")

  for (const page of PRIMARY_SETTINGS_PAGES) {
    const pageSrc = read(`app/(growth)/growth/settings/${page.segment}/page.tsx`)
    assert.match(pageSrc, page.headerPattern, `${page.segment} must render a consistent settings surface`)
    assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  }
  console.log("  ✓ Primary settings pages render wired surfaces")

  const header = read("components/growth/shell/growth-workspace-page-header.tsx")
  assert.match(header, /GROWTH_SETTINGS_PAGE_HEADER_ICON/)
  assert.match(header, /rounded-2xl border border-border bg-card p-5 shadow-sm/)
  console.log("  ✓ Shared page header structure")

  const card = read("components/growth/growth-settings-ui.tsx")
  assert.match(card, /GrowthSettingsCard/)
  assert.match(card, /DRAWER_NESTED_CARD/)
  assert.match(card, /GrowthSettingsToggleRow/)
  console.log("  ✓ Shared settings card and form row components")

  const formState = read("components/growth/settings/growth-settings-section-form-state.tsx")
  assert.match(formState, /GrowthSettingsSaveStatus/)
  assert.match(formState, /aria-live="polite"/)
  assert.match(formState, /GrowthSettingsField/)
  console.log("  ✓ Shared form field and save status components")

  const shell = read("components/growth/settings/growth-settings-shell.tsx")
  assert.match(shell, /aria-label="Growth settings sections"/)
  assert.match(shell, /SETTINGS_NAV_GROUP_LABEL/)
  assert.match(shell, /SettingsNavItemLink/)
  assert.equal(GROWTH_WORKSPACE_SETTINGS_SHELL_SIDEBAR, "w-full shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm md:sticky md:top-4 md:w-56 md:self-start")
  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_BODY, /flex w-full min-w-0/)
  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_BODY, /md:gap-8/)
  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_CONTENT, /min-w-0/)
  assert.match(GROWTH_WORKSPACE_SETTINGS_SHELL_HEADER, /rounded-2xl/)
  assert.equal(SETTINGS_NAV_GROUPS, "space-y-4")
  console.log("  ✓ Navigation polish, accessibility, and responsive shell tokens")

  const navItemLink = read("components/settings/settings-nav-item-link.tsx")
  assert.match(navItemLink, /aria-current=\{active \? "page" : undefined\}/)
  console.log("  ✓ Nav item active state exposes aria-current")

  assertNoForbiddenUserCopy()
  console.log("  ✓ No placeholder or migration copy in Growth settings surfaces")

  const aiTeammate = read("components/growth/settings/growth-ai-teammate-settings-panel.tsx")
  assert.match(aiTeammate, /Not available yet/)
  assert.match(aiTeammate, /GrowthSettingsCard/)
  assert.doesNotMatch(aiTeammate, /Coming soon/i)
  console.log("  ✓ AI Teammate uses production-quality unavailable messaging")

  const commHub = read("components/growth/settings/growth-communications-settings-hub.tsx")
  assert.doesNotMatch(commHub, /Platform Admin fallback/)
  assert.match(commHub, /GROWTH_SETTINGS_SECTION_GAP/)
  console.log("  ✓ Communications hub copy and spacing polished")

  console.log("\nGROWTH-SETTINGS-UX-POLISH-1A verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_UX_POLISH_QA_MARKER,
        growth_nav_items: sectionIds.length,
        primary_pages_checked: PRIMARY_SETTINGS_PAGES.length,
      },
      null,
      2,
    ),
  )
}

main()
