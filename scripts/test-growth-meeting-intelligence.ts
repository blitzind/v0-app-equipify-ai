/**
 * Regression checks for Growth Engine meeting intelligence (slice 6.23A).
 * Run: pnpm test:growth-meeting-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEETING_INTELLIGENCE_QA_MARKER,
  GROWTH_MEETING_INBOX_VIEWS,
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_SOURCES,
  GROWTH_MEETING_STATUSES,
} from "../lib/growth/meeting-intelligence/meeting-intelligence-types"
import {
  resolveGrowthCalendarSyncReadiness,
} from "../lib/growth/meeting-intelligence/calendar-sync-readiness"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

assert.equal(GROWTH_MEETING_INTELLIGENCE_QA_MARKER, "meeting-intelligence-v1")
assert.equal(GROWTH_MEETING_STATUSES.length, 5)
assert.equal(GROWTH_MEETING_SOURCES.length, 4)
assert.equal(GROWTH_MEETING_PROVIDERS.length, 5)
assert.ok(GROWTH_MEETING_INBOX_VIEWS.includes("meeting_requests"))

const calendar = resolveGrowthCalendarSyncReadiness()
assert.equal(calendar.ready, false)
assert.match(calendar.setupMessage ?? "", /Connect Google Calendar/)

for (const type of [
  "meeting_requested",
  "meeting_scheduled",
  "meeting_starting_soon",
  "meeting_no_show",
  "post_meeting_followup_due",
  "meeting_outcome_missing",
] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

for (const type of [
  "meeting_created",
  "meeting_scheduled",
  "meeting_completed",
  "meeting_no_show",
  "meeting_canceled",
  "meeting_followup_due",
  "meeting_outcome_recorded",
] as const) {
  assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270230120000_growth_engine_meeting_intelligence.sql"),
  "utf8",
)
assert.match(migrationSource, /create table if not exists growth\.meetings/)
assert.match(migrationSource, /meeting_outcome_recorded/)
assert.match(migrationSource, /idx_growth_meetings_owner_status_start/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)

const processReply = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/process-reply-intelligence.ts"),
  "utf8",
)
assert.match(processReply, /processReplyMeetingIntelligence/)

const drawerSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-intelligence.tsx"),
  "utf8",
)
assert.match(drawerSource, /Schedule meeting/)
assert.match(drawerSource, /no automatic stage movement/i)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-intelligence-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /Meeting requests/)

console.log("growth-meeting-intelligence: all checks passed")
