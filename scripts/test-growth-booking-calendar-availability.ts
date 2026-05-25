/**
 * Regression checks for public booking calendar availability (booking-calendar-availability-v2).
 * Run: pnpm test:growth-booking-calendar-availability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildBookingSlots,
  isSlotStillAvailable,
  resolveBookingAvailabilityWindows,
} from "../lib/growth/booking/booking-availability"
import {
  apiMonthKeyFromDate,
  buildAvailableDateKeys,
  isPublicBookingCalendarDateSelectable,
  resolveBookingCalendarDateKey,
  resolveBookingDisplayDateKey,
} from "../lib/growth/booking/booking-availability-ui"
import {
  GROWTH_BOOKING_CALENDAR_AVAILABILITY_QA_MARKER,
  GROWTH_BOOKING_SLOTS_API_QA_MARKER,
} from "../lib/growth/booking/booking-page-defaults"
import { monthRangeInTimezone } from "../lib/growth/booking/booking-timezone-utils"

assert.equal(GROWTH_BOOKING_CALENDAR_AVAILABILITY_QA_MARKER, "booking-calendar-availability-v2")
assert.equal(GROWTH_BOOKING_SLOTS_API_QA_MARKER, "booking-slots-api-v1")

const hostTimezone = "America/New_York"
const windows = resolveBookingAvailabilityWindows([
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
])

const monthKey = "2026-07"
const monthRange = monthRangeInTimezone(monthKey, hostTimezone)
assert.ok(monthRange, "monthRangeInTimezone must not fail for 2026-07")
assert.equal(monthRange!.endKey, "2026-07-31")
assert.ok(Number.isFinite(monthRange!.rangeEnd.getTime()), "rangeEnd must be a valid Date")

const now = new Date("2026-05-18T12:00:00.000Z")
const rangeStart = monthRange!.rangeStart.getTime() < now.getTime() ? now : monthRange!.rangeStart
const slots = buildBookingSlots({
  timezone: hostTimezone,
  durationMinutes: 30,
  bufferBeforeMinutes: 10,
  bufferAfterMinutes: 10,
  minimumNoticeHours: 0,
  maxMeetingsPerDay: null,
  schedulingHorizonDays: 90,
  availabilityWindows: windows,
  rangeStart,
  rangeEnd: monthRange!.rangeEnd,
  now,
  busyIntervals: [],
  existingBookings: [],
})
assert.ok(slots.length > 0, "fixture must generate slots for July 2026")

const availableDateKeys = buildAvailableDateKeys(slots, hostTimezone, "visitor_local")
const weekdayKeys = [...availableDateKeys].filter((key) => key.startsWith("2026-07-"))
assert.ok(weekdayKeys.length >= 5, "expect at least 5 available weekdays in July 2026")

const mondayKey = weekdayKeys.find((key) => {
  const [year, month, day] = key.split("-").map(Number)
  const probe = new Date(year, month - 1, day)
  return probe.getDay() >= 1 && probe.getDay() <= 5
})
assert.ok(mondayKey, "available keys must include a weekday")

const sampleSlot = slots[0]
const slotKey = resolveBookingDisplayDateKey(sampleSlot.startAt, hostTimezone, "visitor_local")
assert.ok(availableDateKeys.has(slotKey), "canonical slot key must be in available set")

const calendarDay = new Date(2026, 6, 6, 12, 0, 0, 0)
const calendarKey = resolveBookingCalendarDateKey(calendarDay, hostTimezone, "visitor_local")
if (availableDateKeys.has("2026-07-06")) {
  assert.equal(
    isPublicBookingCalendarDateSelectable({
      date: calendarDay,
      displayTimezone: hostTimezone,
      timezoneMode: "visitor_local",
      pageTimezone: hostTimezone,
      todayKey: "2026-05-18",
      horizonEndKey: "2026-08-16",
      loadedMonths: [monthKey],
      loadingMonths: [],
      availableDateKeys,
    }),
    true,
  )
}

const blockedByFreeBusy = buildBookingSlots({
  timezone: hostTimezone,
  durationMinutes: 30,
  bufferBeforeMinutes: 10,
  bufferAfterMinutes: 10,
  availabilityWindows: windows,
  rangeStart,
  rangeEnd: monthRange!.rangeEnd,
  now,
  schedulingHorizonDays: 90,
  busyIntervals: [{ start: slots[0].startAt, end: slots[0].endAt }],
  existingBookings: [],
})
assert.ok(blockedByFreeBusy.length < slots.length, "freeBusy should remove overlapping slots only")
assert.ok(blockedByFreeBusy.length > 0, "freeBusy must not remove every slot")
assert.ok(!blockedByFreeBusy.some((slot) => slot.startAt === slots[0].startAt), "blocked slot must be removed")

assert.equal(
  isSlotStillAvailable(slots[0], [{ start: slots[0].startAt, end: slots[0].endAt }], [], {
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
  }),
  false,
)

const slotsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/book/[slug]/slots/route.ts"),
  "utf8",
)
assert.match(slotsRoute, /availableDateKeys/)
assert.match(slotsRoute, /GROWTH_BOOKING_SLOTS_API_QA_MARKER/)
assert.match(slotsRoute, /public-booking-slots-v1/)

const publicSlotsLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/booking/public-booking-slots.ts"),
  "utf8",
)
assert.match(publicSlotsLib, /availableDateKeys/)
assert.match(publicSlotsLib, /generatedSlotCountBeforeFreeBusy/)
assert.match(publicSlotsLib, /sanitizeBusyIntervals/)

const publicBookingPage = fs.readFileSync(
  path.join(process.cwd(), "components/growth/public-booking-page.tsx"),
  "utf8",
)
assert.match(publicBookingPage, /GROWTH_BOOKING_CALENDAR_AVAILABILITY_QA_MARKER/)
assert.match(publicBookingPage, /Availability could not load/)
assert.match(publicBookingPage, /No available times this month/)
assert.match(publicBookingPage, /buildAvailableDateKeys\(slots, displayTimezone, timezoneMode\)/)

const timezoneUtils = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/booking/booking-timezone-utils.ts"),
  "utf8",
)
assert.match(timezoneUtils, /nextMonthStartKey/)

const publicViewTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/booking/booking-page-types.ts"),
  "utf8",
)
assert.match(publicViewTypes, /availabilityWindows/)

console.log("growth-booking-calendar-availability: all checks passed")
