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
import { zonedLocalToUtc } from "../lib/growth/booking/booking-timezone-utils"
import {
  isValidBookingPageSlug,
  normalizeBookingPageSlug,
} from "../lib/growth/booking/booking-page-slug"
import { publicBookingErrorMessage } from "../lib/growth/booking/booking-public-errors"

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
assert.match(slotsRoute, /month/)
assert.match(slotsRoute, /horizonEndAt/)

const publicBookingPage = fs.readFileSync(
  path.join(process.cwd(), "components/growth/public-booking-page.tsx"),
  "utf8",
)
assert.match(publicBookingPage, /loadSlotsForMonth/)
assert.match(publicBookingPage, /horizonEndKey/)

const bookingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-booking-pages-panel.tsx"),
  "utf8",
)
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
