/**
 * Regression checks for Growth Engine calendar sync + booking pages (slice 6.27B).
 * Run: pnpm test:growth-calendar-sync-booking
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CALENDAR_SYNC_QA_MARKER,
} from "../lib/growth/calendar/calendar-sync-types"
import { GROWTH_BOOKING_PAGES_QA_MARKER } from "../lib/growth/booking/booking-page-types"
import {
  buildBookingSlots,
  countWeekdaySlotsInHorizon,
  isSlotStillAvailable,
  resolveBookingAvailabilityWindows,
} from "../lib/growth/booking/booking-availability"
import {
  apiMonthKeyFromDate,
  buildAvailableDateKeys,
  countAvailableDatesInMonth,
  resolveBookingCalendarDateKey,
} from "../lib/growth/booking/booking-availability-ui"
import {
  GROWTH_BOOKING_AVAILABILITY_RENDER_FIX_QA_MARKER,
  GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER,
  GROWTH_BOOKING_SLOTS_API_QA_MARKER,
  normalizeMaxMeetingsPerDay,
  normalizePublicThemeMode,
  normalizeSchedulingHorizonDays,
} from "../lib/growth/booking/booking-page-defaults"
import {
  parsePublicThemePreviewParam,
  publicBookingColorScheme,
} from "../lib/growth/booking/public-booking-theme"
import {
  isValidBookingPageSlug,
  normalizeBookingPageSlug,
} from "../lib/growth/booking/booking-page-slug"
import { publicBookingErrorMessage } from "../lib/growth/booking/booking-public-errors"
import { zonedLocalToUtc } from "../lib/growth/booking/booking-timezone-utils"

assert.equal(GROWTH_CALENDAR_SYNC_QA_MARKER, "calendar-sync-v1")
assert.equal(GROWTH_BOOKING_PAGES_QA_MARKER, "booking-pages-v1")

assert.equal(normalizeBookingPageSlug("Equipify Demo Call"), "equipify-demo-call")
assert.equal(isValidBookingPageSlug("equipify-demo-call"), true)
assert.equal(isValidBookingPageSlug("bad slug"), false)

const windows = resolveBookingAvailabilityWindows([])
assert.ok(windows.length >= 5)

const slots = buildBookingSlots({
  timezone: "UTC",
  durationMinutes: 30,
  bufferMinutes: 0,
  availabilityWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }],
  now: new Date("2026-05-18T08:00:00.000Z"),
  schedulingHorizonDays: 7,
})
assert.ok(Array.isArray(slots))

const weekdayCount = countWeekdaySlotsInHorizon({
  timezone: "UTC",
  schedulingHorizonDays: 14,
  availabilityWindows: resolveBookingAvailabilityWindows([]),
  now: new Date("2026-05-18T08:00:00.000Z"),
})
assert.equal(weekdayCount, 10)

const nySlot = zonedLocalToUtc({
  dateKey: "2026-05-19",
  hour: 10,
  minute: 0,
  timeZone: "America/New_York",
})
const laParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}).format(nySlot)
assert.match(laParts, /7:00 AM/)

assert.equal(normalizeMaxMeetingsPerDay(0), null)
assert.equal(normalizeSchedulingHorizonDays(null), 90)

const zeroCapSlots = buildBookingSlots({
  timezone: "America/New_York",
  durationMinutes: 30,
  maxMeetingsPerDay: 0,
  availabilityWindows: resolveBookingAvailabilityWindows([]),
  now: new Date("2026-05-18T12:00:00.000Z"),
  schedulingHorizonDays: 14,
})
assert.ok(zeroCapSlots.length > 0, "maxMeetingsPerDay=0 should not block all slots")

const horizonSlots = buildBookingSlots({
  timezone: "America/New_York",
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  availabilityWindows: resolveBookingAvailabilityWindows([]),
  now: new Date("2026-05-18T12:00:00.000Z"),
  schedulingHorizonDays: 90,
})
assert.ok(horizonSlots.length >= 40)

const calendarDay = new Date(2026, 4, 20, 0, 0, 0, 0)
const visitorKey = resolveBookingCalendarDateKey(calendarDay, "America/Los_Angeles", "visitor_local")
assert.equal(visitorKey, "2026-05-20")
const availableKeys = buildAvailableDateKeys(
  [{ startAt: "2026-05-20T16:00:00.000Z", endAt: "2026-05-20T16:30:00.000Z" }],
  "America/Los_Angeles",
)
assert.ok(availableKeys.has(visitorKey))
assert.equal(countAvailableDatesInMonth(availableKeys, "2026-05"), 1)
assert.equal(apiMonthKeyFromDate(new Date(2026, 4, 15), "America/New_York"), "2026-05")
assert.equal(GROWTH_BOOKING_AVAILABILITY_RENDER_FIX_QA_MARKER, "booking-availability-render-fix-v1")
assert.equal(GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER, "booking-public-theme-mode-v1")
assert.equal(normalizePublicThemeMode(null), "system")
assert.equal(normalizePublicThemeMode("light"), "light")
assert.equal(normalizePublicThemeMode("dark"), "dark")
assert.equal(normalizePublicThemeMode("invalid"), "system")
assert.equal(parsePublicThemePreviewParam("dark"), "dark")
assert.equal(parsePublicThemePreviewParam("bogus"), null)
assert.equal(publicBookingColorScheme("light"), "light")
assert.equal(publicBookingColorScheme("dark"), "dark")
assert.equal(publicBookingColorScheme("system"), undefined)

const sampleSlot = { startAt: "2026-05-18T10:00:00.000Z", endAt: "2026-05-18T10:30:00.000Z" }
assert.equal(
  isSlotStillAvailable(sampleSlot, [], [{ startAt: "2026-05-18T10:00:00.000Z", endAt: "2026-05-18T10:30:00.000Z" }], 0),
  false,
)

assert.match(publicBookingErrorMessage("slot_unavailable"), /no longer available/i)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270304120000_growth_engine_calendar_sync_booking.sql"),
  "utf8",
)
assert.match(migrationSource, /calendar_sync_runs/)
assert.match(migrationSource, /booking_pages/)

const horizonMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270310120000_growth_engine_booking_scheduling_horizon_timezone.sql"),
  "utf8",
)
assert.match(horizonMigration, /scheduling_horizon_days/)
assert.match(horizonMigration, /timezone_mode/)

const slotsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/book/[slug]/slots/route.ts"),
  "utf8",
)
assert.match(slotsRoute, /export async function GET/)
assert.match(slotsRoute, /force-dynamic/)
assert.match(slotsRoute, /GROWTH_BOOKING_SLOTS_API_QA_MARKER/)
assert.match(slotsRoute, /public-booking-slots-v1/)
assert.match(slotsRoute, /public-booking-slots/)
assert.match(slotsRoute, /month/)
assert.match(slotsRoute, /horizonEndAt/)
assert.match(slotsRoute, /application\/json/)

const publicSlotsLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/booking/public-booking-slots.ts"),
  "utf8",
)
assert.match(publicSlotsLib, /fetchPublicBookingSlots/)
assert.match(publicSlotsLib, /loadConfirmedBookingsInRange/)

const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")
assert.match(middlewareSource, /\/api\/book/)
assert.match(middlewareSource, /\/book/)

assert.equal(GROWTH_BOOKING_SLOTS_API_QA_MARKER, "booking-slots-api-v1")

const publicBookingPage = fs.readFileSync(
  path.join(process.cwd(), "components/growth/public-booking-page.tsx"),
  "utf8",
)
assert.match(publicBookingPage, /loadSlotsForMonth/)
assert.match(publicBookingPage, /\/api\/book\/\$\{encodeURIComponent\(slug\)\}\/slots\?month=/)
assert.match(publicBookingPage, /horizonEndKey/)
assert.match(publicBookingPage, /GROWTH_BOOKING_AVAILABILITY_RENDER_FIX_QA_MARKER/)
assert.match(publicBookingPage, /No available times this month/)
assert.match(publicBookingPage, /PublicBookingThemeShell/)
assert.match(publicBookingPage, /previewTheme/)
assert.match(publicBookingPage, /PublicBookingThemeShell/)

const themeMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270312120000_growth_engine_booking_public_theme_mode.sql"),
  "utf8",
)
assert.match(themeMigration, /public_theme_mode/)
assert.match(themeMigration, /'system'/)

const themeShell = fs.readFileSync(
  path.join(process.cwd(), "components/growth/public-booking-theme-shell.tsx"),
  "utf8",
)
assert.match(themeShell, /applyPublicBookingDocumentTheme/)
assert.match(themeShell, /data-public-theme-mode/)
assert.match(themeShell, /GROWTH_BOOKING_PUBLIC_THEME_QA_MARKER/)

const bookPageRoute = fs.readFileSync(path.join(process.cwd(), "app/api/book/[slug]/route.ts"), "utf8")
assert.match(bookPageRoute, /toPublicBookingPageView/)

const publicViewTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/booking/booking-page-types.ts"),
  "utf8",
)
assert.match(publicViewTypes, /publicThemeMode/)

const bookingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-booking-pages-panel.tsx"),
  "utf8",
)
assert.match(bookingPanel, /publicThemeMode/)
assert.match(bookingPanel, /Public page theme/)
assert.match(bookingPanel, /previewTheme/)
assert.match(bookingPanel, /GrowthIanaTimezoneSelect/)
assert.match(bookingPanel, /schedulingHorizonPreset/)
assert.match(bookingPanel, /Booking Pages/)

const syncRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calendar/sync/route.ts"),
  "utf8",
)
assert.match(syncRoute, /confirm: z\.literal\(true\)/)
assert.match(syncRoute, /requireGrowthEnginePlatformAccess/)

const bookRoute = fs.readFileSync(path.join(process.cwd(), "app/api/book/[slug]/book/route.ts"), "utf8")
assert.match(bookRoute, /submitPublicBooking/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-google-calendar-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Force Sync/)

console.log("growth-calendar-sync-booking: all checks passed")
