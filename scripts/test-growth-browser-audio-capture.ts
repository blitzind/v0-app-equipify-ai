/**
 * Regression checks for Growth Engine Browser Audio Capture (slice 6.12A).
 * Run: pnpm test:growth-browser-audio-capture
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateBrowserAudioCaptureCapability,
  resolveCallSheetMicCaptureHint,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import {
  browserAudioCaptureReducer,
  browserAudioCaptureStatusLabel,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-reducer"
import {
  GROWTH_BROWSER_AUDIO_AUTONOMOUS_ACTIONS,
  GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY,
  GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE,
  GROWTH_BROWSER_AUDIO_STORAGE_ENABLED,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import { initialBrowserAudioCaptureState } from "../lib/growth/realtime/browser-audio/browser-audio-capture-types"
import {
  mapBrowserAudioChunkError,
  ProviderStreamingUnavailableError,
} from "../lib/growth/realtime/browser-audio/browser-audio-chunk-errors"
import type { GrowthRealtimeCallSession } from "../lib/growth/realtime/realtime-call-types"

function sessionFixture(
  overrides: Partial<GrowthRealtimeCallSession> = {},
): GrowthRealtimeCallSession {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    leadId: "22222222-2222-4222-8222-222222222222",
    callCopilotSessionId: null,
    status: "active",
    startedAt: "2026-05-18T12:00:00.000Z",
    endedAt: null,
    liveGuidanceMode: "manual",
    transcriptStatus: "live",
    guidanceEnabled: true,
    riskMonitoringEnabled: true,
    liveSnapshot: null,
    realtimeProviderConnectionId: "33333333-3333-4333-8333-333333333333",
    providerId: "deepgram",
    transcriptSource: "provider",
    transcriptQualityScore: 80,
    guidanceLatencyMs: 120,
    sessionProviderFailoverCount: 0,
    browserAudioCaptureEnabled: false,
    browserAudioCaptureStatus: "inactive",
    browserAudioStartedAt: null,
    browserAudioEndedAt: null,
    browserAudioError: null,
    createdBy: null,
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

let state = initialBrowserAudioCaptureState()
state = browserAudioCaptureReducer(state, { type: "request_permission" })
assert.equal(state.status, "requesting")
state = browserAudioCaptureReducer(state, { type: "capture_active" })
assert.equal(state.status, "active")
state = browserAudioCaptureReducer(state, { type: "chunk_sent", latencyMs: 40 })
state = browserAudioCaptureReducer(state, { type: "chunk_sent", latencyMs: 60 })
assert.equal(state.metrics.chunkCount, 2)
assert.equal(state.metrics.averageChunkSendLatencyMs, 50)
state = browserAudioCaptureReducer(state, { type: "chunk_failed" })
assert.equal(state.metrics.failedChunkCount, 1)
state = browserAudioCaptureReducer(state, { type: "capture_paused" })
assert.equal(state.status, "paused")
state = browserAudioCaptureReducer(state, { type: "capture_stopped" })
assert.equal(state.status, "stopped")
assert.equal(state.muted, false)
assert.equal(browserAudioCaptureStatusLabel("active"), "active")

const providerReady = evaluateBrowserAudioCaptureCapability({ session: sessionFixture() })
assert.equal(providerReady.canStart, true)
assert.equal(providerReady.providerLabel, "Deepgram")

const stubSession = evaluateBrowserAudioCaptureCapability({
  session: sessionFixture({ transcriptSource: "stub", providerId: "stub", transcriptStatus: "live" }),
})
assert.equal(stubSession.canStart, false)
assert.match(stubSession.disabledReason ?? "", /Connect a realtime transcript provider/)

const manualSession = evaluateBrowserAudioCaptureCapability({
  session: sessionFixture({ transcriptSource: "manual", providerId: null, transcriptStatus: "inactive" }),
})
assert.equal(manualSession.canStart, false)

const unhealthyProvider = evaluateBrowserAudioCaptureCapability({
  session: sessionFixture({ transcriptStatus: "failed" }),
})
assert.equal(unhealthyProvider.canStart, false)
assert.equal(unhealthyProvider.disabledReason, GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE)

assert.equal(
  resolveCallSheetMicCaptureHint({
    activeProviderConnectionId: "33333333-3333-4333-8333-333333333333",
    fallbackProvider: "stub",
  }),
  "start_mic_capture",
)
assert.equal(
  resolveCallSheetMicCaptureHint({ activeProviderConnectionId: null, fallbackProvider: "stub" }),
  "manual_transcript_mode",
)
assert.equal(
  resolveCallSheetMicCaptureHint({ activeProviderConnectionId: null, fallbackProvider: "deepgram" }),
  "start_mic_capture",
)

const unavailable = mapBrowserAudioChunkError(new ProviderStreamingUnavailableError())
assert.equal(unavailable.status, 409)
assert.equal(unavailable.error, "provider_streaming_unavailable")

assert.equal(GROWTH_BROWSER_AUDIO_STORAGE_ENABLED, false, "no audio storage invariant")
assert.deepEqual(GROWTH_BROWSER_AUDIO_AUTONOMOUS_ACTIONS, [], "no autonomous action invariant")
assert.match(GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY, /Audio is not stored/)

const browserAudioDir = path.join(process.cwd(), "lib/growth/realtime/browser-audio")
const hookSource = fs.readFileSync(path.join(process.cwd(), "hooks/growth/use-growth-browser-audio-capture.ts"), "utf8")
const ingestSource = fs.readFileSync(path.join(browserAudioDir, "ingest-browser-audio-chunk.ts"), "utf8")
const realtimeUiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-call-intelligence.tsx"),
  "utf8",
)
const callSheetSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-action-sheet.tsx"),
  "utf8",
)

for (const file of fs.readdirSync(browserAudioDir)) {
  const source = fs.readFileSync(path.join(browserAudioDir, file), "utf8")
  assert.doesNotMatch(source, /supabase\.storage|\.from\(["'].*storage|S3|upload\(/i, `${file} must not persist audio`)
}

assert.match(hookSource, /stopMediaTracks/, "hook stops media tracks")
assert.match(hookSource, /cleanupCapture\(\)/, "hook cleans up capture")
assert.match(hookSource, /return \(\) => \{[\s\S]*cleanupCapture/, "hook stops tracks on unmount")
assert.doesNotMatch(hookSource, /localStorage|indexedDB|download/, "hook must not store audio locally")
assert.match(ingestSource, /ingestBrowserAudioProviderChunk/, "ingest forwards browser audio to provider stream")
assert.doesNotMatch(ingestSource, /void input\.payloadBase64/, "ingest must forward audio bytes")
assert.match(realtimeUiSource, /Start Mic Capture/, "realtime card exposes mic capture")
assert.match(realtimeUiSource, /useGrowthBrowserAudioCapture/, "realtime card uses browser audio hook")
assert.match(callSheetSource, /Start Mic Capture/, "call sheet surfaces mic capture when provider ready")
assert.match(callSheetSource, /Manual transcript mode active/, "call sheet manual mode fallback")

console.log("growth-browser-audio-capture: all checks passed")
