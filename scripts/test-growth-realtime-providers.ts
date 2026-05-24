/**
 * Regression checks for Growth Engine Realtime Provider Integration (slice 6.11A).
 * Run: pnpm test:growth-realtime-providers
 */
import assert from "node:assert/strict"
import { computeTranscriptQualityScore } from "../lib/growth/realtime/providers/transcript-quality"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import {
  REALTIME_PROVIDER_AUTONOMOUS_ACTIONS,
  type RealtimeProviderRuntimeConfig,
} from "../lib/growth/realtime/providers/provider-types"

const runtimeConfig: RealtimeProviderRuntimeConfig = {
  connectionId: "test-connection",
  providerId: "deepgram",
  configJson: { customKeywords: ["pricing", "competitor"], industryProfile: { vertical: "field_service" } },
  credentials: null,
  speakerSeparationEnabled: true,
  keywordEventsEnabled: true,
  confidenceThreshold: 70,
  customKeywords: ["budget"],
  industryProfile: { vertical: "field_service", version: 1 },
}

const deepgram = createRealtimeProviderInstance("deepgram")
assert.equal(deepgram.providerId, "deepgram")
assert.equal(deepgram.supportsRealtime(), true)
assert.equal(deepgram.supportsBrowserAudioStreaming(), true)
assert.equal(deepgram.supportsSpeakerDetection(), true)
assert.equal(deepgram.supportsKeywordEvents(), true)

const assembly = createRealtimeProviderInstance("assemblyai")
assert.equal(assembly.supportsKeywordEvents(), false)

const openai = createRealtimeProviderInstance("openai_realtime")
assert.equal(openai.supportsSpeakerDetection(), false)
assert.equal(openai.supportsKeywordEvents(), true)

const custom = createRealtimeProviderInstance("custom")
const stub = createRealtimeProviderInstance("stub")

async function run() {
  const customHealth = await custom.health({
    ...runtimeConfig,
    providerId: "custom",
    configJson: { endpoint: "wss://example.test/stream" },
  })
  assert.equal(customHealth.ok, false)

  const stubHealth = await stub.health(runtimeConfig)
  assert.equal(stubHealth.ok, true)
  assert.equal(stubHealth.mode, "stub")

  const deepgramHealth = await deepgram.health(runtimeConfig)
  assert.equal(typeof deepgramHealth.ok, "boolean")
  assert.ok(deepgramHealth.capabilities)

  const quality = computeTranscriptQualityScore({
    finalChunkCount: 4,
    averageConfidence: 82,
    keywordHitRate: 0.5,
    speakerSeparationEnabled: true,
    speakerLabelsPresent: true,
  })
  assert.ok(quality >= 80 && quality <= 100)

  function pickFallbackProvider(input: { activeHealthy: boolean; fallbackId: string }) {
    return input.activeHealthy ? "provider" : input.fallbackId
  }

  assert.equal(pickFallbackProvider({ activeHealthy: false, fallbackId: "stub" }), "stub")
  assert.equal(pickFallbackProvider({ activeHealthy: true, fallbackId: "stub" }), "provider")

  function recoverySuccessRate(attempts: number, successes: number) {
    if (attempts <= 0) return 0
    return Math.round((successes / attempts) * 100)
  }

  assert.equal(recoverySuccessRate(4, 3), 75)

  assert.deepEqual(REALTIME_PROVIDER_AUTONOMOUS_ACTIONS, [], "no autonomous actions invariant")

  console.log("growth-realtime-providers: all checks passed")
}

void run()
