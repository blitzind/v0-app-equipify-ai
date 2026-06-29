/**
 * GROWTH-SETTINGS-WIRING-1A — Retire Growth Settings placeholder pages by reusing existing implementations.
 *
 * Run: pnpm test:growth-settings-wiring-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH } from "../lib/growth/navigation/growth-communications-settings-navigation"
import { growthEngineCustomerSettingsHref } from "../lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_SETTINGS_WIRING_1A_QA_MARKER = "growth-settings-wiring-1a-v1" as const

const ROOT = process.cwd()

const PLACEHOLDER_MARKERS = [
  /GrowthSettingsSectionPlaceholder/,
  /Coming in Phase 7D\+/i,
  /No persistence is wired/i,
  /establishes navigation only/i,
  /GrowthSettingsSectionPage sectionId=/,
] as const

const WIRED_ROUTES: Array<{
  segment: string
  pageComponent: string
  qaMarker: string
}> = [
  {
    segment: "browser-notifications",
    pageComponent: "GrowthSettingsBrowserNotificationsPage",
    qaMarker: "growth-settings-browser-notifications-wiring-1a-v1",
  },
  {
    segment: "calendar",
    pageComponent: "GrowthSettingsCalendarPage",
    qaMarker: "growth-settings-calendar-wiring-1a-v1",
  },
  {
    segment: "calendar-preferences",
    pageComponent: "GrowthSettingsCalendarPreferencesPage",
    qaMarker: "growth-settings-calendar-preferences-wiring-1a-v1",
  },
  {
    segment: "calling-preferences",
    pageComponent: "GrowthSettingsCallingPreferencesPage",
    qaMarker: "growth-settings-calling-preferences-wiring-1a-v1",
  },
  {
    segment: "command-center-preferences",
    pageComponent: "GrowthSettingsCommandCenterPreferencesPage",
    qaMarker: "growth-settings-command-center-preferences-ia-1b-v1",
  },
]

const REDIRECT_ROUTES: Array<{ segment: string; targetPattern: RegExp }> = [
  { segment: "gmail", targetPattern: /GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH/ },
  { segment: "microsoft-365", targetPattern: /GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH/ },
  { segment: "advanced", targetPattern: /\/settings[`'"]/ },
]

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertNoPlaceholderMarkers(relativePath: string): void {
  const src = read(relativePath)
  for (const pattern of PLACEHOLDER_MARKERS) {
    assert.doesNotMatch(src, pattern, `${relativePath} must not use placeholder shell (${pattern})`)
  }
}

function main(): void {
  console.log(`\n=== GROWTH-SETTINGS-WIRING-1A (${GROWTH_SETTINGS_WIRING_1A_QA_MARKER}) ===\n`)

  for (const route of WIRED_ROUTES) {
    const pagePath = `app/(growth)/growth/settings/${route.segment}/page.tsx`
    const pageSrc = read(pagePath)
    assert.match(pageSrc, new RegExp(route.pageComponent), `${pagePath} must mount ${route.pageComponent}`)
    assertNoPlaceholderMarkers(pagePath)

    const componentPath = `components/growth/settings/growth-settings-${route.segment}-page.tsx`
    const componentSrc = read(componentPath)
    assert.match(componentSrc, new RegExp(route.qaMarker), `${componentPath} must expose wiring QA marker`)
    assert.doesNotMatch(componentSrc, /GrowthSettingsSectionPlaceholder/)
    console.log(`  ✓ /growth/settings/${route.segment} wired (${route.pageComponent})`)
  }

  const browserComponent = read("components/growth/settings/growth-settings-browser-notifications-page.tsx")
  assert.match(browserComponent, /GrowthNotificationPushSubscribe/)
  console.log("  ✓ Browser Notifications mounts GrowthNotificationPushSubscribe")

  const calendarComponent = read("components/growth/settings/growth-settings-calendar-page.tsx")
  assert.match(calendarComponent, /GrowthGoogleCalendarSettingsPanel/)
  assert.match(calendarComponent, /GrowthBookingPagesPanel/)
  assert.match(calendarComponent, /GrowthMeetingLocationSettingsPanel/)
  console.log("  ✓ Calendar composes Google Calendar, meeting location, and booking panels")

  const calendarPrefsComponent = read("components/growth/settings/growth-settings-calendar-preferences-page.tsx")
  assert.match(calendarPrefsComponent, /GrowthMeetingLocationSettingsPanel/)
  assert.match(calendarPrefsComponent, /GrowthGoogleCalendarSettingsPanel/)
  assert.doesNotMatch(calendarPrefsComponent, /GrowthBookingPagesPanel/)
  console.log("  ✓ Calendar Preferences focuses on operator defaults (no booking CRUD)")

  const callingComponent = read("components/growth/settings/growth-settings-calling-preferences-page.tsx")
  assert.match(callingComponent, /GrowthCommunicationSettingsPanel/)
  assert.match(callingComponent, /mode="operator"/)
  assert.match(callingComponent, /GrowthNativeDialerSettingsPanel/)
  assert.match(callingComponent, /GrowthLiveCoachingSettingsPanel/)
  assert.match(callingComponent, /GrowthOperatorAssistPreferencesPanel/)
  assert.doesNotMatch(callingComponent, /GrowthVoiceInfrastructureSettingsPanel/)
  console.log("  ✓ Calling Preferences composes operator panels without voice infrastructure")

  const communicationPanel = read("components/growth/growth-communication-settings.tsx")
  assert.match(communicationPanel, /GrowthCommunicationSettingsPanelMode/)
  assert.match(communicationPanel, /mode = "admin"/)
  assert.match(communicationPanel, /isOperatorMode/)
  console.log("  ✓ GrowthCommunicationSettingsPanel supports operator/admin mode")

  const adminCommunications = read("app/(admin)/admin/growth/settings/communications/page.tsx")
  assert.match(adminCommunications, /GrowthVoiceInfrastructureSettingsPanel/)
  assert.match(adminCommunications, /GrowthCommunicationSettingsPanel/)
  console.log("  ✓ Platform Admin communications still owns voice infrastructure")

  for (const route of REDIRECT_ROUTES) {
    const pagePath = `app/(growth)/growth/settings/${route.segment}/page.tsx`
    const pageSrc = read(pagePath)
    assert.match(pageSrc, /redirect\s*\(/)
    assert.match(pageSrc, route.targetPattern)
    console.log(`  ✓ /growth/settings/${route.segment} redirects (${route.targetPattern})`)
  }

  assert.equal(
    growthEngineCustomerSettingsHref("gmail"),
    GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
    "gmail canonical href must target connected mailboxes",
  )
  assert.equal(
    growthEngineCustomerSettingsHref("microsoft-365"),
    GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_PATH,
    "microsoft-365 canonical href must target connected mailboxes",
  )
  assert.equal(
    growthEngineCustomerSettingsHref("command-center-preferences"),
    "/growth/settings/command-center-preferences",
    "command-center-preferences canonical href must target Command Center Preferences",
  )
  console.log("  ✓ legacy growth-engine canonical hrefs updated for IA destinations")

  assert.equal(
    fs.existsSync(path.join(ROOT, "components/growth/settings/growth-settings-advanced-hub.tsx")),
    false,
    "Advanced hub must be removed after IA 1B",
  )
  console.log("  ✓ Advanced migration hub removed")

  console.log("\nGROWTH-SETTINGS-WIRING-1A verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_WIRING_1A_QA_MARKER,
        wired_routes: WIRED_ROUTES.length,
        redirect_routes: REDIRECT_ROUTES.length,
      },
      null,
      2,
    ),
  )
}

main()
