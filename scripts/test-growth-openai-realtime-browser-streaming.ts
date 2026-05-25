/**
 * Regression checks for Growth Engine OpenAI Realtime Browser Streaming (slice 6.12E).
 * Run: pnpm test:growth-openai-realtime-browser-streaming
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
import { GROWTH_BROWSER_AUDIO_STORAGE_ENABLED } from "../lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import { providerSupportsBrowserAudioStreaming } from "../lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  buildOpenAiRealtimeListenUrl,
  buildOpenAiTranscriptionSessionUpdate,
  isOpenAiBrowserAudioEncodingSupported,
  isOpenAiRealtimeTranscriptionModelSupported,
  resolveOpenAiRealtimeApiKey,
} from "../lib/growth/realtime/providers/openai-realtime-browser-audio-config"
import {
  mapOpenAiRealtimeProviderError,
  parseOpenAiRealtimeLiveTranscriptMessage,
  parseOpenAiRealtimeProviderErrorMessage,
} from "../lib/growth/realtime/providers/openai-realtime-live-message-parser"
import {
  OPENAI_REALTIME_AUTONOMOUS_ACTIONS,
  OPENAI_REALTIME_AUTONOMOUS_AUDIO_FORBIDDEN,
  OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES,
  isOpenAiRealtimeForbiddenOutboundEventType,
} from "../lib/growth/realtime/providers/openai-realtime-transcript-invariants"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import type { GrowthRealtimeCallSession } from "../lib/growth/realtime/realtime-call-types"
import type { RealtimeProviderRuntimeConfig } from "../lib/growth/realtime/providers/provider-types"

const openai = createRealtimeProviderInstance("openai_realtime")
assert.equal(openai.supportsBrowserAudioStreaming(), true)
assert.equal(openai.supportsLiveTranscriptStreaming(), true)
assert.equal(openai.supportsLiveGuidanceCompatible(), true)
assert.equal(providerSupportsBrowserAudioStreaming("openai_realtime"), true)

const runtimeConfig: RealtimeProviderRuntimeConfig = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  providerId: "openai_realtime",
  configJson: { model: "gpt-realtime-whisper" },
  credentials: { apiKey: "test-key" },
  speakerSeparationEnabled: false,
  keywordEventsEnabled: true,
  confidenceThreshold: 70,
  customKeywords: ["pricing"],
  industryProfile: null,
}

const listenUrl = buildOpenAiRealtimeListenUrl(runtimeConfig)
assert.match(listenUrl, /^wss:\/\/api\.openai\.com\/v1\/realtime\?model=gpt-realtime-whisper/)

const sessionUpdate = buildOpenAiTranscriptionSessionUpdate(runtimeConfig)
assert.equal(sessionUpdate.session.type, "transcription")
assert.equal(sessionUpdate.session.audio.input.transcription.model, "gpt-realtime-whisper")
assert.equal(sessionUpdate.session.audio.input.format.rate, 24000)

process.env.OPENAI_API_KEY = "env-key"
assert.equal(resolveOpenAiRealtimeApiKey({ ...runtimeConfig, credentials: {} }), "env-key")
delete process.env.OPENAI_API_KEY

assert.equal(isOpenAiBrowserAudioEncodingSupported("audio/webm;codecs=opus"), true)
assert.equal(isOpenAiBrowserAudioEncodingSupported("audio/pcm"), true)
assert.equal(isOpenAiRealtimeTranscriptionModelSupported("gpt-realtime-whisper"), true)
assert.equal(isOpenAiRealtimeTranscriptionModelSupported("gpt-4o-realtime-preview"), false)

const partial = parseOpenAiRealtimeLiveTranscriptMessage(
  JSON.stringify({
    type: "conversation.item.input_audio_transcription.delta",
    item_id: "item_1",
    delta: "We need ",
  }),
)
assert.ok(partial)
assert.equal(partial!.isFinal, false)
assert.equal(partial!.content, "We need ")

const final = parseOpenAiRealtimeLiveTranscriptMessage(
  JSON.stringify({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "item_1",
    transcript: "We need pricing before summer.",
  }),
  { keywordMatcher: (content) => (content.includes("pricing") ? ["pricing"] : []) },
)
assert.ok(final)
assert.equal(final!.isFinal, true)
assert.equal(final!.content, "We need pricing before summer.")
assert.deepEqual(final!.keywords, ["pricing"])

assert.equal(
  parseOpenAiRealtimeLiveTranscriptMessage(
    JSON.stringify({ type: "response.audio.delta", delta: "ignored" }),
  ),
  null,
)
assert.equal(isOpenAiRealtimeForbiddenOutboundEventType("response.create"), true)
assert.equal(isOpenAiRealtimeForbiddenOutboundEventType("response.audio.delta"), true)

const parsedProviderError = parseOpenAiRealtimeProviderErrorMessage(
  JSON.stringify({ type: "error", error: { message: "401 unauthorized" } }),
)
assert.ok(parsedProviderError)
assert.equal(parsedProviderError!.code, "provider_auth_failed")

assert.equal(mapOpenAiRealtimeProviderError("insufficient_quota").code, "provider_rate_limited")
assert.equal(mapOpenAiRealtimeProviderError("invalid model").code, "unsupported_model")
assert.equal(mapOpenAiRealtimeProviderError("malformed provider event").code, "malformed_provider_event")
assert.equal(mapOpenAiRealtimeProviderError("connection closed").code, "provider_disconnected")
assert.equal(mapOpenAiRealtimeProviderError("timed out").code, "stream_timeout")

const authMapped = mapBrowserAudioProviderError(new ProviderAuthError())
assert.equal(authMapped.code, "provider_auth_failed")
const disconnectMapped = mapBrowserAudioProviderError(new ProviderDisconnectedError())
assert.equal(disconnectMapped.code, "provider_disconnected")
assert.ok(classifyBrowserAudioProviderErrorCode("401 unauthorized") instanceof ProviderAuthError)

assert.equal(OPENAI_REALTIME_AUTONOMOUS_AUDIO_FORBIDDEN, true)
assert.deepEqual(OPENAI_REALTIME_AUTONOMOUS_ACTIONS, [])
assert.ok(OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES.includes("response.create"))
assert.ok(OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES.includes("response.audio.delta"))

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
  providerId: "openai_realtime",
  transcriptSource: "provider",
  transcriptQualityScore: 0,
  guidanceLatencyMs: 0,
  sessionProviderFailoverCount: 0,
  browserAudioCaptureEnabled: false,
  browserAudioCaptureStatus: "inactive",
  browserAudioStartedAt: null,
  browserAudioEndedAt: null,
  browserAudioError: null,
  meetingCaptureMode: null,
  meetingProvider: null,
  mixedAudioEnabled: false,
  meetingAudioActive: false,
  microphoneActive: false,
  createdBy: null,
  createdAt: "2026-05-18T12:00:00.000Z",
  updatedAt: "2026-05-18T12:00:00.000Z",
}

const openaiCapability = evaluateBrowserAudioCaptureCapability({ session })
assert.equal(openaiCapability.canStart, true)
assert.equal(openaiCapability.providerLabel, "OpenAI Realtime")

const streamManagerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/browser-audio/browser-audio-stream-manager.ts"),
  "utf8",
)
const openaiProviderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/openai-realtime-provider.ts"),
  "utf8",
)
const openaiStreamSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/openai-realtime-browser-audio-stream.ts"),
  "utf8",
)

assert.match(streamManagerSource, /MAX_STREAM_RECONNECT_ATTEMPTS = 3/, "reconnect guardrails present")
assert.match(streamManagerSource, /closeBrowserAudioProviderStream/, "stream cleanup on close")
assert.match(openaiProviderSource, /ingestBrowserAudioChunk/, "openai accepts browser chunks")
assert.match(openaiProviderSource, /closeBrowserAudioStream/, "openai closes browser stream on disconnect")
assert.doesNotMatch(openaiStreamSource, /response\.create/, "no autonomous response creation")
assert.doesNotMatch(openaiStreamSource, /output_audio/, "no synthesized audio playback path")
assert.match(openaiStreamSource, /buildOpenAiTranscriptionSessionUpdate/, "transcription-only session enforced")
assert.equal(GROWTH_BROWSER_AUDIO_STORAGE_ENABLED, false, "no audio storage invariant")

for (const relativePath of [
  "lib/growth/realtime/browser-audio/ingest-browser-audio-chunk.ts",
  "lib/growth/realtime/browser-audio/browser-audio-stream-manager.ts",
  "lib/growth/realtime/providers/openai-realtime-browser-audio-stream.ts",
]) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
  assert.doesNotMatch(source, /supabase\.storage|\.from\(["'].*storage|S3|upload\(/i, `${relativePath} must not persist audio`)
}

const readinessSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/realtime-provider-readiness-utils.ts"),
  "utf8",
)
assert.match(readinessSource, /openai_realtime/, "readiness utils include OpenAI Realtime browser streaming")
assert.match(readinessSource, /openai_transcription_only/, "transcription-only warning present")

console.log("growth-openai-realtime-browser-streaming: all checks passed")
