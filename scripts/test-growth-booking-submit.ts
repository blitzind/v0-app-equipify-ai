/**
 * Regression checks for public booking submit API.
 * Run: pnpm test:growth-booking-submit
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_BOOKING_SUBMIT_API_QA_MARKER,
  PUBLIC_BOOKING_SUBMIT_ROUTE_META,
  normalizeBookingSubmitIso,
  parsePublicBookingSubmitPayload,
} from "../lib/growth/booking/booking-submit-payload"
import { publicBookingErrorMessage } from "../lib/growth/booking/booking-public-errors"

assert.equal(GROWTH_BOOKING_SUBMIT_API_QA_MARKER, "booking-submit-api-v1")
assert.equal(PUBLIC_BOOKING_SUBMIT_ROUTE_META, "public-booking-submit-v1")

assert.equal(normalizeBookingSubmitIso("2026-05-19T14:00:00+00:00"), "2026-05-19T14:00:00.000Z")
assert.equal(normalizeBookingSubmitIso("2026-05-19T14:00:00.000Z"), "2026-05-19T14:00:00.000Z")

const canonical = parsePublicBookingSubmitPayload({
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme",
  phone: "555-0100",
  notes: "Demo please",
  slotStartAt: "2026-05-19T14:00:00.000Z",
  slotEndAt: "2026-05-19T14:30:00.000Z",
})
assert.equal(canonical.ok, true)
if (canonical.ok) {
  assert.equal(canonical.data.email, "jane@example.com")
  assert.equal(canonical.data.slotStartAt, "2026-05-19T14:00:00.000Z")
}

const aliasPayload = parsePublicBookingSubmitPayload({
  name: "Jane Doe",
  email: "jane@example.com",
  selectedSlot: { start: "2026-05-19T14:00:00+00:00", end: "2026-05-19T14:30:00+00:00" },
})
assert.equal(aliasPayload.ok, true)

const missingSlot = parsePublicBookingSubmitPayload({ name: "Jane", email: "jane@example.com" })
assert.equal(missingSlot.ok, false)

const bookRoute = fs.readFileSync(path.join(process.cwd(), "app/api/book/[slug]/book/route.ts"), "utf8")
assert.match(bookRoute, /export const dynamic = "force-dynamic"/)
assert.match(bookRoute, /GROWTH_BOOKING_SUBMIT_API_QA_MARKER/)
assert.match(bookRoute, /PUBLIC_BOOKING_SUBMIT_ROUTE_META/)
assert.match(bookRoute, /parsePublicBookingSubmitPayload/)
assert.match(bookRoute, /submitPublicBooking/)
assert.match(bookRoute, /createServiceRoleClient/)

const bookingService = fs.readFileSync(path.join(process.cwd(), "lib/growth/booking/booking-service.ts"), "utf8")
assert.match(bookingService, /loadOptionalGoogleBusyIntervals/)
assert.match(bookingService, /calendarInvitePending/)
assert.doesNotMatch(bookingService, /if \(!connection\) \{\s*return \{ ok: false, code: "calendar_unavailable"/s)

const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")
assert.match(middlewareSource, /\/api\/book/)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270304120000_growth_engine_calendar_sync_booking.sql"),
  "utf8",
)
assert.match(migration, /booking_page_bookings/)
assert.match(migration, /booking_pages/)

assert.equal(publicBookingErrorMessage("calendar_unavailable"), "Booking is temporarily unavailable. Please try again later.")
assert.equal(publicBookingErrorMessage("invalid_form"), "Please check your booking details and try again.")

console.log("growth-booking-submit: all checks passed")
