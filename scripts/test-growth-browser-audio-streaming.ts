/**
 * Regression checks for Growth Engine Browser Audio Streaming Bridge (slice 6.12B).
 * Run: pnpm test:growth-browser-audio-streaming
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBrowserAudioProviderErrorCode,
  mapBrowserAudioProviderError,
  ProviderAuthError,
  ProviderDisconnectedError,
} from "../lib/growth/realtime/browser-audio/browser-audio-provider-errors"
import { evaluateBrowserAudioCaptureCapability } from "../lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import {
  GROWTH_BROWSER_AUDIO_STORAGE_ENABLED,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import {
  growthBrowserAudioStreamStatusLabel,
  providerSupportsBrowserAudioStreaming,
} from "../lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  mapDeepgramProviderError,
  parseDeepgramLiveTranscriptMessage,
} from "../lib/growth/realtime/providers/deepgram-live-message-parser"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import type { GrowthRealtimeCallSession } from "../lib/growth/realtime/realtime-call-types"

const deepgram = createRealtimeProviderInstance("deepgram")
assert.equal(deepgram.supportsBrowserAudioStreaming(), true)
assert.equal(createRealtimeProviderInstance("stub").supportsBrowserAudioStreaming(), false)
assert.equal(providerSupportsBrowserAudioStreaming("deepgram"), true)
assert.equal(providerSupportsBrowserAudioStreaming("assemblyai"), true)

const parsed = parseDeepgramLiveTranscriptMessage(
  JSON.stringify({
    channel: {
      alternatives: [{ transcript: "We need pricing before summer.", confidence: 0.91 }],
    },
    is_final: true,
    speech_final: true,
    start: 1.2,
  }),
  { keywordMatcher: (content) => (content.includes("pricing") ? ["pricing"] : []) },
)
assert.ok(parsed)
assert.equal(parsed!.content, "We need pricing before summer.")
assert.equal(parsed!.speaker, "rep")
assert.equal(parsed!.isFinal, true)
assert.deepEqual(parsed!.keywords, ["pricing"])

const interim = parseDeepgramLiveTranscriptMessage(
  JSON.stringify({
    channel: { alternatives: [{ transcript: "hello" }] },
    is_final: false,
  }),
)
assert.equal(interim, null)

assert.equal(mapDeepgramProviderError("401 unauthorized").code, "provider_auth_failed")
assert.equal(mapDeepgramProviderError("429 rate limit exceeded").code, "provider_rate_limited")
assert.equal(mapDeepgramProviderError("unsupported encoding").code, "unsupported_audio_format")
assert.equal(mapDeepgramProviderError("connection closed").code, "provider_disconnected")

const authMapped = mapBrowserAudioProviderError(new ProviderAuthError())
assert.equal(authMapped.status, 401)
assert.equal(authMapped.code, "provider_auth_failed")

const disconnectMapped = mapBrowserAudioProviderError(new ProviderDisconnectedError())
assert.equal(disconnectMapped.code, "provider_disconnected")

const authError = classifyBrowserAudioProviderErrorCode("401 unauthorized")
assert.ok(authError instanceof ProviderAuthError)

assert.equal(growthBrowserAudioStreamStatusLabel("connecting"), "Connecting provider")
assert.equal(growthBrowserAudioStreamStatusLabel("listening"), "Listening")
assert.equal(growthBrowserAudioStreamStatusLabel("interrupted"), "Stream interrupted, retry available")

const session: GrowthRealtimeCallSession = {
  id: "11111111-1111-4111-8111-111111111111",
  leadId: "22222222-2222-4222-8222-222222222222",
  callCopilotSessionId: null,
  status: "active",
  startedAt: null,
  endedAt: null,
  liveGuidanceMode: "manual",
  transcriptStatus: "live",
  guidanceEnabled: true,
  riskMonitoringEnabled: true,
  liveSnapshot: {
    objections: [],
    buyingSignals: [],
    talkRatio: { repPercent: 50, prospectPercent: 50, goalMet: true },
    discovery: { coveredAreas: [], missingAreas: [], completionPercent: 0 },
    riskFlags: [],
    competitorGuidance: [],
    recommendedNextQuestion: null,
    recommendedResponse: null,
    guidanceTips: [],
    computedAt: "2026-05-18T12:00:00.000Z",
  },
  realtimeProviderConnectionId: null,
  providerId: "assemblyai",
  transcriptSource: "provider",
  transcriptQualityScore: 0,
  guidanceLatencyMs: 0,
  sessionProviderFailoverCount: 0,
  browserAudioCaptureEnabled: false,
  browserAudioCaptureStatus: "inactive",
  browserAudioStartedAt: null,
  browserAudioEndedAt: null,
  browserAudioError: null,
  createdBy: null,
  createdAt: "2026-05-18T12:00:00.000Z",
  updatedAt: "2026-05-18T12:00:00.000Z",
}

const assemblyCapability = evaluateBrowserAudioCaptureCapability({ session })
assert.equal(assemblyCapability.canStart, true)
assert.equal(assemblyCapability.providerLabel, "AssemblyAI")

const ingestSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/browser-audio/ingest-browser-audio-chunk.ts"),
  "utf8",
)
const streamManagerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/browser-audio/browser-audio-stream-manager.ts"),
  "utf8",
)
const deepgramProviderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/deepgram-provider.ts"),
  "utf8",
)

assert.match(ingestSource, /ingestBrowserAudioProviderChunk/, "ingest forwards to provider stream")
assert.doesNotMatch(ingestSource, /void input\.payloadBase64/, "audio bytes are forwarded not discarded in ingest")
assert.match(streamManagerSource, /MAX_STREAM_RECONNECT_ATTEMPTS = 3/, "retry guardrails present")
assert.match(streamManagerSource, /closeBrowserAudioProviderStream/, "stream cleanup on close")
assert.match(deepgramProviderSource, /ingestBrowserAudioChunk/, "deepgram accepts browser chunks")
assert.equal(GROWTH_BROWSER_AUDIO_STORAGE_ENABLED, false, "no audio storage invariant")

for (const relativePath of [
  "lib/growth/realtime/browser-audio/ingest-browser-audio-chunk.ts",
  "lib/growth/realtime/browser-audio/browser-audio-stream-manager.ts",
  "lib/growth/realtime/providers/deepgram-browser-audio-stream.ts",
]) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
  assert.doesNotMatch(source, /supabase\.storage|\.from\(["'].*storage|S3|upload\(/i, `${relativePath} must not persist audio`)
}

console.log("growth-browser-audio-streaming: all checks passed")
