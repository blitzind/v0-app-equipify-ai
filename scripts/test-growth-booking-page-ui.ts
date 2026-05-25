/**
 * Regression checks for Growth booking page UI v4.
 * Run: pnpm test:growth-booking-page-ui
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  calendarDateToSlotKey,
  formatDateKeyLabel,
  groupSlotsByDateKey,
  validateBookingAvailabilityWindows,
} from "../lib/growth/booking/booking-availability-ui"
import { buildGoogleCalendarUrl } from "../lib/growth/booking/booking-public-calendar-links"
import { GROWTH_BOOKING_PAGE_UI_QA_MARKER, weeklyScheduleToWindows, windowsToWeeklySchedule } from "../lib/growth/booking/booking-page-ui-types"
import { resolvePublicBookingLocationFromPage } from "../lib/growth/booking/booking-public-display"
import { resolveVisitorTimezone, visitorTimezoneHelperCopy } from "../lib/growth/booking/booking-public-timezone"

assert.equal(GROWTH_BOOKING_PAGE_UI_QA_MARKER, "booking-page-ui-v4")

const schedule = windowsToWeeklySchedule([{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }])
assert.equal(schedule.filter((day) => day.enabled).length, 1)
const windows = weeklyScheduleToWindows(schedule)
assert.equal(validateBookingAvailabilityWindows(windows).ok, true)
assert.equal(validateBookingAvailabilityWindows([]).ok, false)

const slots = [
  { startAt: "2026-05-20T14:00:00.000Z", endAt: "2026-05-20T14:30:00.000Z" },
  { startAt: "2026-05-21T15:00:00.000Z", endAt: "2026-05-21T15:30:00.000Z" },
]
const grouped = groupSlotsByDateKey(slots, "UTC")
assert.ok(grouped.size >= 1)

const key = calendarDateToSlotKey(new Date("2026-05-20T12:00:00.000Z"), "UTC")
assert.match(key, /^\d{4}-\d{2}-\d{2}$/)
assert.match(formatDateKeyLabel(key, "UTC"), /May/)

const resolvedTimezone = resolveVisitorTimezone("Pacific/Kiritimati")
assert.ok(resolvedTimezone.length > 0)
assert.match(visitorTimezoneHelperCopy(resolvedTimezone), /Times shown in your timezone/)

assert.match(
  buildGoogleCalendarUrl({
    title: "Demo",
    description: "Equipify demo",
    location: "Google Meet",
    startAtIso: "2026-05-20T14:00:00.000Z",
    endAtIso: "2026-05-20T14:30:00.000Z",
  }),
  /calendar\.google\.com/,
)

const zoomLocation = resolvePublicBookingLocationFromPage({
  locationType: "google_meet",
  meetingProviderOverride: "zoom",
  customLocation: null,
  manualMeetingUrl: "https://zoom.us/j/demo",
})
assert.equal(zoomLocation.url, "https://zoom.us/j/demo")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270306120000_growth_engine_booking_page_ui_v2.sql"),
  "utf8",
)
assert.match(migrationSource, /page_title/)
assert.match(migrationSource, /accent_color/)
assert.match(migrationSource, /hero_image_url/)

const publicPage = fs.readFileSync(path.join(process.cwd(), "components/growth/public-booking-page.tsx"), "utf8")
assert.match(publicPage, /data-qa-marker=\{GROWTH_BOOKING_PAGE_UI_QA_MARKER\}/)
assert.match(publicPage, /max-w-\[1440px\]/)
assert.match(publicPage, /Select a date/)
assert.match(publicPage, /Select a time/)
assert.match(publicPage, /Change date/)
assert.match(publicPage, /Your details/)
assert.match(publicPage, /Schedule Demo/)
assert.match(publicPage, /PublicBookingBrandPanel/)
assert.match(publicPage, /PublicBookingStepProgress/)
assert.match(publicPage, /step === "date"/)
assert.match(publicPage, /step === "time"/)
assert.match(publicPage, /step === "details"/)

const successPage = fs.readFileSync(path.join(process.cwd(), "components/growth/public-booking/public-booking-success.tsx"), "utf8")
assert.match(successPage, /Add to calendar/)
assert.match(successPage, /Book another/)
assert.match(successPage, /dark:/)

const adminPanel = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-booking-pages-panel.tsx"), "utf8")
assert.match(adminPanel, /GrowthBookingAvailabilityEditor/)
assert.match(adminPanel, /accentColor/)
assert.match(adminPanel, /Copy Link/)

console.log("growth-booking-page-ui: all checks passed")
