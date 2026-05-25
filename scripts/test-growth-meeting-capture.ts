/**
 * Regression checks for Growth Engine meeting capture (slice 6.21A).
 * Run: pnpm test:growth-meeting-capture
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { browserAudioCaptureReducer } from "../lib/growth/realtime/browser-audio/browser-audio-capture-reducer"
import { initialBrowserAudioCaptureState } from "../lib/growth/realtime/browser-audio/browser-audio-capture-types"
import {
  GROWTH_BROWSER_AUDIO_STORAGE_ENABLED,
  GROWTH_MEETING_CAPTURE_SAFETY_COPY,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import {
  detectMeetingProviderFromDisplayMedia,
  detectMeetingProviderFromUrl,
  isKnownMeetingProvider,
} from "../lib/growth/realtime/browser-audio/meeting-provider-detection"
import {
  GROWTH_MEETING_CAPTURE_QA_MARKER,
  GROWTH_MEETING_CAPTURE_SOURCE_MODES,
  GROWTH_MEETING_PROVIDERS,
  resolveMeetingCaptureSourceMode,
} from "../lib/growth/realtime/browser-audio/meeting-capture-types"
import { buildSpeakerAttributionPrep } from "../lib/growth/realtime/browser-audio/speaker-attribution-prep"
import { buildLiveCoachingSessionInsightsRollup } from "../lib/growth/realtime/live-coaching/session-insights-rollup"
import { buildDeterministicSessionTimelineEventId } from "../lib/growth/realtime/live-coaching/session-timeline-event-id"
import type { LiveCoachingSessionTimelineEvent } from "../lib/growth/realtime/live-coaching/session-timeline-types"
import { LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES } from "../lib/growth/realtime/live-coaching/session-timeline-types"

assert.equal(GROWTH_MEETING_CAPTURE_QA_MARKER, "meeting-capture-v1")
assert.equal(GROWTH_BROWSER_AUDIO_STORAGE_ENABLED, false)
assert.match(GROWTH_MEETING_CAPTURE_SAFETY_COPY, /not stored/i)

assert.equal(detectMeetingProviderFromUrl("https://meet.google.com/abc-defg-hij"), "google_meet")
assert.equal(detectMeetingProviderFromUrl("https://us06web.zoom.us/j/123456789"), "zoom_web")
assert.equal(detectMeetingProviderFromUrl("https://teams.microsoft.com/l/meetup-join/19%3a"), "microsoft_teams_web")
assert.equal(detectMeetingProviderFromUrl("https://example.com/meeting"), "generic_browser_audio")

assert.equal(
  detectMeetingProviderFromDisplayMedia({ label: "Google Meet - Weekly sync", displaySurface: "browser" }),
  "google_meet",
)
assert.equal(
  detectMeetingProviderFromDisplayMedia({ label: "Zoom Meeting", displaySurface: "browser" }),
  "zoom_web",
)
assert.equal(
  detectMeetingProviderFromDisplayMedia({ label: "Microsoft Teams", displaySurface: "browser" }),
  "microsoft_teams_web",
)
assert.ok(isKnownMeetingProvider("google_meet"))
assert.equal(isKnownMeetingProvider("generic_browser_audio"), false)

assert.equal(
  resolveMeetingCaptureSourceMode({ uiMode: "microphone", includeMicrophone: false }),
  "microphone",
)
assert.equal(
  resolveMeetingCaptureSourceMode({ uiMode: "meeting_mode", includeMicrophone: true }),
  "mixed_audio",
)
assert.equal(
  resolveMeetingCaptureSourceMode({ uiMode: "meeting_mode", includeMicrophone: false }),
  "meeting_mode",
)

let state = initialBrowserAudioCaptureState()
state = browserAudioCaptureReducer(state, {
  type: "set_capture_source",
  captureSourceMode: "mixed_audio",
  mixedAudioEnabled: true,
})
assert.equal(state.captureSourceMode, "mixed_audio")
assert.equal(state.mixedAudioEnabled, true)
state = browserAudioCaptureReducer(state, {
  type: "meeting_context",
  meetingProvider: "google_meet",
  meetingAudioActive: true,
  microphoneActive: true,
  mixedAudioActive: true,
})
assert.equal(state.meetingProvider, "google_meet")
assert.equal(state.mixedAudioActive, true)

const speakerPrep = buildSpeakerAttributionPrep({
  captureSourceMode: "mixed_audio",
  meetingProvider: "zoom_web",
  mixedAudioEnabled: true,
})
assert.equal(speakerPrep.speakerSource, "unknown")
assert.equal(speakerPrep.mixedAudioEnabled, true)

const sessionId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"
const meetingEvents: LiveCoachingSessionTimelineEvent[] = [
  {
    id: buildDeterministicSessionTimelineEventId({ sessionId, sequenceNumber: 0, eventType: "session_started" }),
    leadId,
    sessionId,
    sequenceNumber: 0,
    eventType: "session_started",
    severity: "info",
    providerId: "deepgram",
    detail: {},
    createdAt: "2026-05-18T12:00:00.000Z",
  },
  {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: 1,
      eventType: "meeting_capture_started",
    }),
    leadId,
    sessionId,
    sequenceNumber: 1,
    eventType: "meeting_capture_started",
    severity: "info",
    providerId: "deepgram",
    detail: { captureSourceMode: "mixed_audio", meetingProvider: "google_meet", mixedAudioEnabled: true },
    createdAt: "2026-05-18T12:00:05.000Z",
  },
  {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: 2,
      eventType: "meeting_provider_detected",
    }),
    leadId,
    sessionId,
    sequenceNumber: 2,
    eventType: "meeting_provider_detected",
    severity: "info",
    providerId: "deepgram",
    detail: { meetingProvider: "google_meet" },
    createdAt: "2026-05-18T12:00:06.000Z",
  },
  {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: 3,
      eventType: "mixed_audio_enabled",
    }),
    leadId,
    sessionId,
    sequenceNumber: 3,
    eventType: "mixed_audio_enabled",
    severity: "info",
    providerId: "deepgram",
    detail: {},
    createdAt: "2026-05-18T12:00:07.000Z",
  },
  {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: 4,
      eventType: "meeting_audio_permission_denied",
    }),
    leadId,
    sessionId,
    sequenceNumber: 4,
    eventType: "meeting_audio_permission_denied",
    severity: "warning",
    providerId: "deepgram",
    detail: { errorCode: "denied" },
    createdAt: "2026-05-18T12:00:08.000Z",
  },
  {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: 5,
      eventType: "session_completed",
    }),
    leadId,
    sessionId,
    sequenceNumber: 5,
    eventType: "session_completed",
    severity: "info",
    providerId: "deepgram",
    detail: { durationMs: 60000 },
    createdAt: "2026-05-18T12:01:00.000Z",
  },
]

const meetingRollup = buildLiveCoachingSessionInsightsRollup({
  leadId,
  sessionId,
  events: meetingEvents,
})
assert.equal(meetingRollup.meetingModeUsed, true)
assert.equal(meetingRollup.meetingProvider, "google_meet")
assert.equal(meetingRollup.mixedAudioUsed, true)
assert.equal(meetingRollup.meetingCaptureFailures, 1)

const mixerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/browser-audio/browser-audio-mixer.ts"),
  "utf8",
)
assert.match(mixerSource, /createBrowserAudioMixer/)
assert.match(mixerSource, /destroy\(\)/)
assert.match(mixerSource, /audioContext\.close/)
assert.doesNotMatch(mixerSource, /localStorage|indexedDB|Blob\[\]/)

const hookSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/growth/use-growth-browser-audio-capture.ts"),
  "utf8",
)
assert.match(hookSource, /getDisplayMedia/)
assert.match(hookSource, /createBrowserAudioMixer/)
assert.match(hookSource, /mixerRef\.current\?\.destroy/)
assert.match(hookSource, /stopMediaTracks/)
assert.doesNotMatch(hookSource, /localStorage|download/)

const captureRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/browser-audio-capture/route.ts",
  ),
  "utf8",
)
assert.match(captureRoute, /requireGrowthEnginePlatformAccess/)
assert.match(captureRoute, /emitLiveCoachingMeetingCaptureStartedTimeline/)
assert.match(captureRoute, /meeting_audio_permission_denied/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-call-intelligence.tsx"),
  "utf8",
)
assert.match(uiSource, /Meeting Mode/)
assert.match(uiSource, /Share Tab & Start Meeting Capture/)
assert.match(uiSource, /Meeting Audio Active/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270228120000_growth_engine_meeting_capture.sql"),
  "utf8",
)
assert.match(migrationSource, /meeting_capture_started/)
assert.match(migrationSource, /meeting_mode_used/)
assert.match(migrationSource, /meeting_audio/)

for (const eventType of [
  "meeting_capture_started",
  "meeting_capture_stopped",
  "meeting_provider_detected",
  "mixed_audio_enabled",
  "meeting_audio_permission_denied",
  "meeting_capture_failed",
] as const) {
  assert.ok(LIVE_COACHING_SESSION_TIMELINE_EVENT_TYPES.includes(eventType))
}

assert.ok(GROWTH_MEETING_CAPTURE_SOURCE_MODES.includes("meeting_mode"))
assert.ok(GROWTH_MEETING_PROVIDERS.includes("zoom_web"))

console.log("growth-meeting-capture: all checks passed")
