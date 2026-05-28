/**
 * Voice realtime media streaming + transcript infrastructure — Phase 1F regression checks.
 * Run: pnpm test:voice-media-streaming-phase-1f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "../lib/voice/media-streaming/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"
import { parseTwilioMediaStreamMessage } from "../lib/voice/media-streaming/twilio-media-parser"
import {
  acquireVoiceMediaStreamOwnership,
  releaseVoiceMediaStreamOwnership,
  resetVoiceMediaStreamOwnershipForTests,
} from "../lib/voice/media-streaming/stream-session-registry"
import { VOICE_CALL_TIMELINE_EVENT_LABELS } from "../lib/voice/browser-calling/status-mapping"
import {
  createVoiceTranscriptProvider,
} from "../lib/voice/transcripts/providers/registry"
import { resolveConfiguredTranscriptProviderKind } from "../lib/voice/transcripts/providers/types"

assert.equal(VOICE_MEDIA_STREAMING_QA_MARKER, "voice-media-streaming-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v16")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270616120000_voice_compliance_orchestration_phase_4c")

resetVoiceMediaStreamOwnershipForTests()
const first = acquireVoiceMediaStreamOwnership({
  connectionId: "conn-1",
  organizationId: "org-1",
  mediaSessionId: "session-1",
  providerStreamSid: "MZ123",
})
assert.equal(first.ok, true)
assert.equal(first.duplicate, false)

const duplicate = acquireVoiceMediaStreamOwnership({
  connectionId: "conn-1",
  organizationId: "org-1",
  mediaSessionId: "session-1",
  providerStreamSid: "MZ123",
})
assert.equal(duplicate.duplicate, true)

const reconnect = acquireVoiceMediaStreamOwnership({
  connectionId: "conn-2",
  organizationId: "org-1",
  mediaSessionId: "session-1",
  providerStreamSid: "MZ123",
  allowReconnect: true,
})
assert.equal(reconnect.ok, true)
assert.equal(reconnect.duplicate, true)
assert.equal(reconnect.reason, "reconnect")
releaseVoiceMediaStreamOwnership("conn-2")

const startFrame = parseTwilioMediaStreamMessage(
  JSON.stringify({
    event: "start",
    start: { streamSid: "MZ123", callSid: "CA123", tracks: ["inbound", "outbound"] },
  }),
)
assert.equal(startFrame?.event, "start")

const mediaFrame = parseTwilioMediaStreamMessage(
  JSON.stringify({ event: "media", media: { track: "inbound", chunk: "1", timestamp: "100" } }),
)
assert.equal(mediaFrame?.event, "media")

const provider = createVoiceTranscriptProvider("stub")
const normalized = provider.normalizeTranscriptEvent({
  speaker: "customer",
  transcript_text: "Hello there",
  is_final: true,
  confidence_score: 0.91,
})
assert.ok(normalized)
assert.equal(normalized?.speakerType, "customer")
assert.equal(normalized?.transcriptText, "Hello there")

assert.equal(typeof resolveConfiguredTranscriptProviderKind(), "string")

for (const eventType of [
  "stream_start",
  "stream_stop",
  "stream_reconnect",
  "transcript_segment_append",
  "media_interruption_mark",
]) {
  assert.equal(typeof VOICE_CALL_TIMELINE_EVENT_LABELS[eventType], "string")
}

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270606120000_voice_media_streaming_phase_1f.sql"),
  "utf8",
)
for (const object of [
  "voice_media_sessions",
  "voice_media_participants",
  "voice_transcript_sessions",
  "voice_transcript_segments",
  "voice_media_timeline_events",
  "voice_stream_status",
  "voice_transcript_provider_kind",
]) {
  assert.match(migration, new RegExp(object))
}

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_media_sessions/)
assert.match(schemaHealth, /voice_transcript_segments/)

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/media-session-service.ts"),
  "utf8",
)
assert.match(serviceSource, /processTwilioMediaStreamMessage/)
assert.match(serviceSource, /startVoiceMediaStreamSession/)
assert.match(serviceSource, /ingestVoiceTranscriptProviderEvent/)

const parserSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/twilio-media-parser.ts"),
  "utf8",
)
assert.match(parserSource, /parseTwilioMediaStreamMessage/)

const wsHandler = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/twilio-websocket-handler.ts"),
  "utf8",
)
assert.match(wsHandler, /attachTwilioMediaWebSocketConnection/)

const twilioRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/media/twilio/route.ts"),
  "utf8",
)
assert.match(twilioRoute, /parseTwilioMediaStreamMessage/)

const transcriptRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/transcripts/route.ts"),
  "utf8",
)
assert.match(transcriptRoute, /fetchVoiceCallTranscriptSnapshot/)

const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
assert.match(workspace, /VOICE_MEDIA_STREAMING_QA_MARKER/)
assert.match(workspace, /voiceLiveTranscript/)

const transcriptPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-live-transcript-panel.tsx"),
  "utf8",
)
assert.match(transcriptPanel, /GrowthCallWorkspaceLiveTranscriptPanel/)
assert.match(transcriptPanel, /connectionStatusLabel/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Media streaming readiness/)
assert.match(settingsPanel, /mediaStreamingReadiness/)
assert.match(settingsPanel, /Stream diagnostics/)

const eventEngine = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/media-event-engine.ts"),
  "utf8",
)
assert.match(eventEngine, /emitDeterministicMediaEvent/)

console.log("voice-media-streaming-phase-1f checks passed")
