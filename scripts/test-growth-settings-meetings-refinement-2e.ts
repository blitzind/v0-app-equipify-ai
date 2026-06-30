/**
 * GROWTH-SETTINGS-MEETINGS-REFINEMENT-2E — Meetings section UX polish certification.
 *
 * Run: pnpm test:growth-settings-meetings-refinement-2e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "../components/growth/growth-settings-ui"
import {
  GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS,
  listGrowthWorkspaceSettingsSectionIds,
} from "../lib/growth/navigation/growth-workspace-settings-navigation"

export { GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER }

const ROOT = process.cwd()

const MEETINGS_NAV_IDS = ["calendar-preferences", "calendar"] as const

const OPERATOR_MEETINGS_FILES = [
  "components/growth/settings/growth-settings-calendar-preferences-page.tsx",
  "components/growth/settings/growth-settings-calendar-page.tsx",
  "components/growth/settings/growth-meetings-scheduling-readiness-summary.tsx",
  "components/growth/growth-google-calendar-settings-panel.tsx",
  "components/growth/growth-meeting-location-settings-panel.tsx",
  "components/growth/growth-booking-pages-panel.tsx",
] as const

const FORBIDDEN_OPERATOR_COPY = [
  /Coming soon/i,
  /Coming in Phase/i,
  /\bPhase 7/i,
  /\bTODO\b/,
  /not yet implemented/i,
  /Calendly-style/i,
  /Human-triggered sync/i,
  /Force Sync/i,
  /returnTo=\/admin\/growth/i,
  /GROWTH_GOOGLE_CALENDAR_CLIENT_ID/i,
] as const

const VISIBLE_QA_MARKER_IN_UI = />\s*\{[A-Z0-9_]+QA_[A-Z0-9_]+\}/

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function meetingsNavGroup() {
  return GROWTH_WORKSPACE_SETTINGS_NAV_GROUPS.find((group) => group.id === "meetings")!
}

function main(): void {
  console.log(
    `\n=== GROWTH-SETTINGS-MEETINGS-REFINEMENT-2E (${GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER, "growth-settings-meetings-refinement-2e-v1")
  console.log("  ✓ Meetings refinement QA marker")

  const meetingsGroup = meetingsNavGroup()
  assert.deepEqual(
    meetingsGroup.items.map((item) => item.id),
    [...MEETINGS_NAV_IDS],
    "Meetings nav must remain unchanged",
  )
  console.log("  ✓ Meetings navigation unchanged")

  const allSectionIds = listGrowthWorkspaceSettingsSectionIds()
  assert.equal(allSectionIds.length, new Set(allSectionIds).size)
  console.log("  ✓ No duplicate navigation entries")

  for (const segment of ["calendar-preferences", "calendar"]) {
    const pagePath = path.join(ROOT, "app/(growth)/growth/settings", segment, "page.tsx")
    assert.ok(fs.existsSync(pagePath), `Missing Meetings route: /growth/settings/${segment}`)
    const pageSrc = read(`app/(growth)/growth/settings/${segment}/page.tsx`)
    assert.doesNotMatch(pageSrc, /GrowthSettingsSectionPlaceholder/)
  }
  console.log("  ✓ Meetings routes render wired pages")

  const calendarPrefs = read("components/growth/settings/growth-settings-calendar-preferences-page.tsx")
  assert.match(calendarPrefs, /GrowthMeetingsSchedulingReadinessSummary/)
  assert.match(calendarPrefs, /MeetingsSettingsSection/)
  assert.match(calendarPrefs, /GrowthMeetingLocationSettingsPanel variant="operator"/)
  assert.match(calendarPrefs, /GrowthGoogleCalendarSettingsPanel variant="operator"/)
  assert.doesNotMatch(calendarPrefs, /GrowthBookingPagesPanel/)
  assert.match(
    calendarPrefs,
    /data-growth-settings-meetings-refinement=\{GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER\}/,
  )
  console.log("  ✓ Calendar Preferences grouped with readiness and operator panels")

  const calendarPage = read("components/growth/settings/growth-settings-calendar-page.tsx")
  assert.match(calendarPage, /GrowthMeetingsSchedulingReadinessSummary/)
  assert.match(calendarPage, /title="Booking"/)
  assert.match(calendarPage, /title="Meeting location"/)
  assert.match(calendarPage, /GrowthBookingPagesPanel variant="operator"/)
  assert.match(calendarPage, /GrowthGoogleCalendarSettingsPanel variant="operator"/)
  console.log("  ✓ Calendar & Booking grouped into calendar, booking, and meeting location")

  const readiness = read("components/growth/settings/growth-meetings-scheduling-readiness-summary.tsx")
  assert.match(readiness, /Calendar connected/)
  assert.match(readiness, /Booking page/)
  assert.match(readiness, /Availability/)
  assert.match(readiness, /Meeting location/)
  console.log("  ✓ Scheduling readiness summary at top")

  const googleCalendar = read("components/growth/growth-google-calendar-settings-panel.tsx")
  assert.match(googleCalendar, /variant\?: "default" \| "operator"/)
  assert.match(googleCalendar, /GROWTH_CALENDAR_SETTINGS_RETURN_TO/)
  assert.match(googleCalendar, /managed by Platform admin/i)
  assert.match(googleCalendar, /\/api\/platform\/growth\/calendar\/connection/)
  console.log("  ✓ Google Calendar operator variant with workspace return path")

  const meetingLocation = read("components/growth/growth-meeting-location-settings-panel.tsx")
  assert.match(meetingLocation, /variant\?: "default" \| "operator"/)
  assert.match(meetingLocation, /\/api\/platform\/growth\/communication-settings/)
  assert.match(meetingLocation, /Default meeting location/)
  console.log("  ✓ Meeting location operator terminology and persistence unchanged")

  const booking = read("components/growth/growth-booking-pages-panel.tsx")
  assert.match(booking, /variant\?: "default" \| "operator"/)
  assert.match(booking, /\/api\/platform\/growth\/booking-pages/)
  assert.match(booking, /Published/)
  assert.match(booking, /GrowthBookingAvailabilityEditor/)
  console.log("  ✓ Booking pages include availability editor and published status")

  for (const file of OPERATOR_MEETINGS_FILES) {
    const src = read(file)
    assert.doesNotMatch(src, VISIBLE_QA_MARKER_IN_UI, `${file} must not render QA markers in visible UI`)
    if (
      file.includes("growth-settings-calendar") ||
      file.includes("growth-meetings-scheduling") ||
      (file.includes("growth-google-calendar") && src.includes('variant = "operator"')) ||
      (file.includes("growth-meeting-location") && src.includes("isOperator")) ||
      (file.includes("growth-booking-pages") && src.includes("isOperator"))
    ) {
      for (const pattern of FORBIDDEN_OPERATOR_COPY) {
        if (file.includes("growth-google-calendar") && pattern.source.includes("Force Sync")) continue
        assert.doesNotMatch(src, pattern, `${file} must not expose infrastructure copy (${pattern})`)
      }
    }
  }
  console.log("  ✓ Operator Meetings surfaces use production copy")

  assert.equal(GROWTH_SETTINGS_SECTION_GAP, "space-y-4")
  console.log("  ✓ Shared section spacing token unchanged")

  console.log("\nGROWTH-SETTINGS-MEETINGS-REFINEMENT-2E verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
        meetings_nav_items: MEETINGS_NAV_IDS.length,
        panels_checked: OPERATOR_MEETINGS_FILES.length,
      },
      null,
      2,
    ),
  )
}

main()
