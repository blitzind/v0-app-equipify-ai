/**
 * Regression checks for Growth Engine AssemblyAI Browser Audio Streaming (slice 6.12D).
 * Run: pnpm test:growth-assemblyai-browser-streaming
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBrowserAudioProviderErrorCode,
  mapBrowserAudioProviderError,
  ProviderAuthError,
  ProviderDisconnectedError,
  UnsupportedAudioFormatError,
} from "../lib/growth/realtime/browser-audio/browser-audio-provider-errors"
import { evaluateBrowserAudioCaptureCapability } from "../lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import { GROWTH_BROWSER_AUDIO_STORAGE_ENABLED } from "../lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import { providerSupportsBrowserAudioStreaming } from "../lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  buildAssemblyAiListenUrl,
  isAssemblyAiBrowserAudioEncodingSupported,
  resolveAssemblyAiApiKey,
} from "../lib/growth/realtime/providers/assemblyai-browser-audio-config"
import {
  mapAssemblyAiProviderError,
  parseAssemblyAiLiveTranscriptMessage,
  parseAssemblyAiProviderErrorMessage,
} from "../lib/growth/realtime/providers/assemblyai-live-message-parser"
import { mapLiveProviderStreamError } from "../lib/growth/realtime/providers/live-provider-stream-error-mapper"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import type { GrowthRealtimeCallSession } from "../lib/growth/realtime/realtime-call-types"
import type { RealtimeProviderRuntimeConfig } from "../lib/growth/realtime/providers/provider-types"

const assemblyai = createRealtimeProviderInstance("assemblyai")
assert.equal(assemblyai.supportsBrowserAudioStreaming(), true)
assert.equal(providerSupportsBrowserAudioStreaming("assemblyai"), true)
assert.equal(providerSupportsBrowserAudioStreaming("openai_realtime"), true)

const runtimeConfig: RealtimeProviderRuntimeConfig = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  providerId: "assemblyai",
  configJson: { model: "universal-streaming-english", region: "us" },
  credentials: { apiKey: "test-key" },
  speakerSeparationEnabled: true,
  keywordEventsEnabled: false,
  confidenceThreshold: 70,
  customKeywords: ["pricing"],
  industryProfile: null,
}

const listenUrl = buildAssemblyAiListenUrl(runtimeConfig)
assert.match(listenUrl, /^wss:\/\/streaming\.assemblyai\.com\/v3\/ws\?/)
assert.match(listenUrl, /speech_model=universal-streaming-english/)
assert.match(listenUrl, /format_turns=true/)

const euUrl = buildAssemblyAiListenUrl({
  ...runtimeConfig,
  configJson: { model: "universal-streaming-english", region: "eu" },
})
assert.match(euUrl, /^wss:\/\/streaming\.eu\.assemblyai\.com\/v3\/ws\?/)

process.env.ASSEMBLYAI_API_KEY = "env-key"
assert.equal(resolveAssemblyAiApiKey({ ...runtimeConfig, credentials: {} }), "env-key")
delete process.env.ASSEMBLYAI_API_KEY

assert.equal(isAssemblyAiBrowserAudioEncodingSupported("audio/webm;codecs=opus"), true)
assert.equal(isAssemblyAiBrowserAudioEncodingSupported("audio/pcm"), true)
assert.equal(isAssemblyAiBrowserAudioEncodingSupported("audio/mpeg"), false)

const finalTurn = parseAssemblyAiLiveTranscriptMessage(
  JSON.stringify({
    type: "Turn",
    transcript: "We need pricing before summer.",
    end_of_turn: true,
    audio_start: 1.2,
    words: [{ text: "pricing", confidence: 0.91, speaker: "A" }],
  }),
  { keywordMatcher: (content) => (content.includes("pricing") ? ["pricing"] : []) },
)
assert.ok(finalTurn)
assert.equal(finalTurn!.content, "We need pricing before summer.")
assert.equal(finalTurn!.isFinal, true)
assert.equal(finalTurn!.speaker, "rep")
assert.deepEqual(finalTurn!.keywords, ["pricing"])

const partialTurn = parseAssemblyAiLiveTranscriptMessage(
  JSON.stringify({
    type: "Turn",
    transcript: "We need pricing",
    end_of_turn: false,
  }),
)
assert.ok(partialTurn)
assert.equal(partialTurn!.isFinal, false)

const legacyFinal = parseAssemblyAiLiveTranscriptMessage(
  JSON.stringify({
    message_type: "FinalTranscript",
    text: "Budget is approved.",
    confidence: 0.88,
    audio_start: 2.5,
  }),
)
assert.ok(legacyFinal)
assert.equal(legacyFinal!.isFinal, true)
assert.equal(legacyFinal!.content, "Budget is approved.")

const legacyPartial = parseAssemblyAiLiveTranscriptMessage(
  JSON.stringify({
    message_type: "PartialTranscript",
    text: "Budget is",
  }),
)
assert.ok(legacyPartial)
assert.equal(legacyPartial!.isFinal, false)

assert.equal(parseAssemblyAiLiveTranscriptMessage(JSON.stringify({ type: "Begin", id: "sess" })), null)
assert.equal(
  parseAssemblyAiLiveTranscriptMessage(JSON.stringify({ type: "Termination", audio_duration_seconds: 1 })),
  null,
)

const parsedProviderError = parseAssemblyAiProviderErrorMessage(
  JSON.stringify({ type: "Error", error: "401 unauthorized" }),
)
assert.ok(parsedProviderError)
assert.equal(parsedProviderError!.code, "provider_auth_failed")

assert.equal(mapAssemblyAiProviderError("429 rate limit exceeded").code, "provider_rate_limited")
assert.equal(mapAssemblyAiProviderError("unsupported encoding").code, "unsupported_audio_format")
assert.equal(mapAssemblyAiProviderError("connection closed").code, "provider_disconnected")
assert.equal(mapAssemblyAiProviderError("service unavailable").code, "provider_unavailable")
assert.equal(mapLiveProviderStreamError("timed out").code, "stream_timeout")

const authMapped = mapBrowserAudioProviderError(new ProviderAuthError())
assert.equal(authMapped.status, 401)
assert.equal(authMapped.code, "provider_auth_failed")

const formatMapped = mapBrowserAudioProviderError(new UnsupportedAudioFormatError())
assert.equal(formatMapped.code, "unsupported_audio_format")

const disconnectMapped = mapBrowserAudioProviderError(new ProviderDisconnectedError())
assert.equal(disconnectMapped.code, "provider_disconnected")

const authError = classifyBrowserAudioProviderErrorCode("401 unauthorized")
assert.ok(authError instanceof ProviderAuthError)

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
const assemblyProviderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/assemblyai-provider.ts"),
  "utf8",
)

assert.match(ingestSource, /ingestBrowserAudioProviderChunk/, "ingest forwards to provider stream")
assert.doesNotMatch(ingestSource, /void input\.payloadBase64/, "audio bytes are forwarded not discarded in ingest")
assert.match(streamManagerSource, /MAX_STREAM_RECONNECT_ATTEMPTS = 3/, "retry guardrails present")
assert.match(streamManagerSource, /closeBrowserAudioProviderStream/, "stream cleanup on close")
assert.match(assemblyProviderSource, /ingestBrowserAudioChunk/, "assemblyai accepts browser chunks")
assert.match(assemblyProviderSource, /closeBrowserAudioStream/, "assemblyai closes browser stream on disconnect")
assert.equal(GROWTH_BROWSER_AUDIO_STORAGE_ENABLED, false, "no audio storage invariant")

for (const relativePath of [
  "lib/growth/realtime/browser-audio/ingest-browser-audio-chunk.ts",
  "lib/growth/realtime/browser-audio/browser-audio-stream-manager.ts",
  "lib/growth/realtime/providers/assemblyai-browser-audio-stream.ts",
]) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
  assert.doesNotMatch(source, /supabase\.storage|\.from\(["'].*storage|S3|upload\(/i, `${relativePath} must not persist audio`)
}

const readinessSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/realtime-provider-readiness-utils.ts"),
  "utf8",
)
assert.match(readinessSource, /assemblyai/, "readiness utils include AssemblyAI browser streaming")

console.log("growth-assemblyai-browser-streaming: all checks passed")
