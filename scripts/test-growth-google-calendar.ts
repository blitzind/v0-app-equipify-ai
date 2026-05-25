/**
 * Regression checks for Growth Engine Google Calendar integration (slice 6.27A).
 * Run: pnpm test:growth-google-calendar
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_GOOGLE_CALENDAR_QA_MARKER,
  GROWTH_CALENDAR_SYNC_STATUSES,
} from "../lib/growth/calendar/google-calendar-types"
import {
  assertGrowthMeetingScheduleTimes,
  isValidGrowthCalendarTimezone,
  resolveGrowthMeetingTimezone,
} from "../lib/growth/calendar/calendar-timezone"
import {
  signGrowthCalendarOAuthState,
  verifyGrowthCalendarOAuthState,
} from "../lib/growth/calendar/calendar-oauth-state"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"
import { growthGoogleCalendarOAuthConfigured } from "../lib/growth/calendar/google-calendar-env"

process.env.INTEGRATION_OAUTH_STATE_SECRET = process.env.INTEGRATION_OAUTH_STATE_SECRET ?? "test-oauth-state-secret-32chars"
process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_ID = process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_ID ?? "test-client-id"
process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_SECRET = process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_SECRET ?? "test-client-secret"
process.env.GROWTH_GOOGLE_CALENDAR_REDIRECT_URI =
  process.env.GROWTH_GOOGLE_CALENDAR_REDIRECT_URI ?? "http://localhost:3000/api/platform/growth/calendar/callback"

assert.equal(GROWTH_GOOGLE_CALENDAR_QA_MARKER, "google-calendar-v1")
assert.deepEqual(GROWTH_CALENDAR_SYNC_STATUSES, ["pending", "synced", "failed", "conflict"])

assert.equal(isValidGrowthCalendarTimezone("America/New_York"), true)
assert.equal(isValidGrowthCalendarTimezone("Not/A_Timezone"), false)
assert.equal(resolveGrowthMeetingTimezone("Europe/London"), "Europe/London")
assert.equal(resolveGrowthMeetingTimezone("bad"), "UTC")

const schedule = assertGrowthMeetingScheduleTimes({
  startAt: "2026-05-18T15:00:00.000Z",
  endAt: "2026-05-18T15:30:00.000Z",
})
assert.ok(schedule.startAt)
assert.ok(schedule.endAt)

assert.throws(() =>
  assertGrowthMeetingScheduleTimes({
    startAt: "2026-05-18T15:30:00.000Z",
    endAt: "2026-05-18T15:00:00.000Z",
  }),
)

const state = signGrowthCalendarOAuthState({
  userId: "11111111-1111-4111-8111-111111111111",
  returnTo: "/admin/growth/settings",
  ts: Date.now(),
})
assert.ok(state)
const verified = verifyGrowthCalendarOAuthState(state!, 60_000)
assert.ok(verified)

assert.equal(growthGoogleCalendarOAuthConfigured(), true)

const oauthSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/calendar/google-calendar-oauth.ts"),
  "utf8",
)
assert.match(oauthSource, /access_type", "offline"/)
assert.match(oauthSource, /refreshGrowthGoogleCalendarAccessToken/)

for (const type of ["calendar_sync_failed", "meeting_synced", "meeting_conflict"] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270303120000_growth_engine_google_calendar.sql"),
  "utf8",
)
assert.match(migrationSource, /calendar_provider_connections/)
assert.match(migrationSource, /calendar_sync_status/)

const pushRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/[meetingId]/calendar/push/route.ts"),
  "utf8",
)
assert.match(pushRoute, /confirm: z\.literal\(true\)/)
assert.match(pushRoute, /requireGrowthEnginePlatformAccess/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-google-calendar-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /No auto-scheduling/)
assert.match(settingsPanel, /Human confirm required/)

const drawerSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-intelligence.tsx"),
  "utf8",
)
assert.match(drawerSource, /Confirm & sync to Google Calendar/)

console.log("growth-google-calendar: all checks passed")
