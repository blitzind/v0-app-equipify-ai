/**
 * Regression checks for Growth Engine meeting location providers (slice 6.27C).
 * Run: pnpm test:growth-meeting-location-providers
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEETING_LOCATION_HELPER_COPY,
  GROWTH_MEETING_LOCATION_QA_MARKER,
  buildMeetingLocationProviderReadiness,
  legacyBookingLocationToProvider,
  meetingLocationNeedsManualUrl,
} from "../lib/growth/meeting-location/meeting-location-provider-types"
import { resolveMeetingLocation } from "../lib/growth/meeting-location/resolve-meeting-location"

assert.equal(GROWTH_MEETING_LOCATION_QA_MARKER, "meeting-location-v1")
assert.match(GROWTH_MEETING_LOCATION_HELPER_COPY, /Google Meet links are created through Google Calendar/)

const platform = { defaultMeetingProvider: "google_meet" as const, autoCreateMeetingLink: true }

const googleMeetConnected = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "google_meet",
})
assert.equal(googleMeetConnected.includeGoogleMeetOnCalendarCreate, true)
assert.equal(googleMeetConnected.providerConnectionRequired, false)

const googleMeetDisconnected = resolveMeetingLocation({
  platform,
  googleCalendarConnected: false,
  meetingLocationType: "google_meet",
})
assert.equal(googleMeetDisconnected.includeGoogleMeetOnCalendarCreate, false)
assert.equal(googleMeetDisconnected.providerConnectionRequired, true)
assert.match(googleMeetDisconnected.warning ?? "", /Google Calendar/i)

const zoomManual = resolveMeetingLocation({
  platform: { ...platform, autoCreateMeetingLink: false },
  googleCalendarConnected: false,
  meetingLocationType: "zoom",
  manualMeetingUrl: "https://zoom.us/j/123",
})
assert.equal(zoomManual.meetingUrl, "https://zoom.us/j/123")
assert.equal(zoomManual.providerConnectionRequired, false)

const zoomMissing = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "zoom",
})
assert.equal(zoomMissing.providerConnectionRequired, true)
assert.match(zoomMissing.warning ?? "", /Zoom connection required/i)

const teamsManual = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "teams",
  manualMeetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
})
assert.equal(teamsManual.meetingUrl, "https://teams.microsoft.com/l/meetup-join/abc")

const phoneCall = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "phone_call",
  meetingLocationLabel: "Will call attendee",
})
assert.equal(phoneCall.meetingLocationLabel, "Will call attendee")

const customLocation = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "custom_location",
  manualMeetingUrl: "https://example.com/room",
})
assert.equal(customLocation.meetingUrl, "https://example.com/room")

const noAutoLink = resolveMeetingLocation({
  platform,
  googleCalendarConnected: true,
  meetingLocationType: "no_auto_link",
})
assert.equal(noAutoLink.meetingUrl, null)
assert.equal(noAutoLink.autoCreateMeetingLink, true)

const bookingOverride = resolveMeetingLocation({
  platform: { defaultMeetingProvider: "google_meet", autoCreateMeetingLink: true },
  googleCalendarConnected: true,
  bookingOverride: "zoom",
  bookingAutoCreateOverride: false,
  manualMeetingUrl: "https://zoom.us/j/booking",
})
assert.equal(bookingOverride.locationProvider, "zoom")
assert.equal(bookingOverride.autoCreateMeetingLink, false)
assert.equal(bookingOverride.meetingUrl, "https://zoom.us/j/booking")

assert.equal(legacyBookingLocationToProvider("zoom"), "zoom")
assert.equal(meetingLocationNeedsManualUrl("zoom"), true)
assert.equal(meetingLocationNeedsManualUrl("phone_call"), false)

const readiness = buildMeetingLocationProviderReadiness({ googleCalendarConnected: true })
assert.equal(readiness.find((entry) => entry.provider === "google_meet")?.status, "ready")
assert.equal(readiness.find((entry) => entry.provider === "zoom")?.status, "planned")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270305120000_growth_engine_meeting_location_providers.sql"),
  "utf8",
)
assert.match(migrationSource, /default_meeting_provider/)
assert.match(migrationSource, /meeting_provider_override/)
assert.match(migrationSource, /meeting_location_type/)

const syncSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/calendar/sync-meeting-calendar.ts"),
  "utf8",
)
assert.match(syncSource, /meetingLocationType === "google_meet"/)
assert.match(syncSource, /autoCreateMeetingLink/)

const commRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/communication-settings/route.ts"),
  "utf8",
)
assert.match(commRoute, /defaultMeetingProvider/)
assert.match(commRoute, /providerReadiness/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-location-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Meeting Location Providers/)

const bookingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-booking-pages-panel.tsx"),
  "utf8",
)
assert.match(bookingPanel, /meetingProviderOverride/)

const meetingUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-intelligence.tsx"),
  "utf8",
)
assert.match(meetingUi, /meetingLocationType/)
assert.match(meetingUi, /Save location settings/)

console.log("growth-meeting-location-providers: all checks passed")
