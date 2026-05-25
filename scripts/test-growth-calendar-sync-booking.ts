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
  isSlotStillAvailable,
  resolveBookingAvailabilityWindows,
} from "../lib/growth/booking/booking-availability"
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
  daysAhead: 7,
})
assert.ok(Array.isArray(slots))

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

const bookingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-booking-pages-panel.tsx"),
  "utf8",
)
assert.match(bookingPanel, /Booking Pages/)

console.log("growth-calendar-sync-booking: all checks passed")
