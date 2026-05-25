/**
 * Regression checks for Growth Engine Live Coaching provider selection polish (slice 6.12F).
 * Run: pnpm test:growth-live-coaching-provider-selection
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canStartBrowserAudioCaptureGuard,
  isDuplicateBrowserAudioChunkSequence,
  isStaleBrowserAudioSessionBinding,
} from "../lib/growth/realtime/browser-audio/browser-audio-capture-guards"
import { evaluateBrowserAudioCaptureCapability } from "../lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import { evaluateBrowserAudioCaptureEnvironment } from "../lib/growth/realtime/browser-audio/browser-audio-browser-compat"
import { BROWSER_AUDIO_TROUBLESHOOTING, resolveMicrophonePermissionError } from "../lib/growth/realtime/browser-audio/browser-audio-troubleshooting"
import {
  buildLiveCoachingProviderComparisonRows,
  buildLiveCoachingProviderReadiness,
  countLiveCoachingReadyProviders,
  explainLiveCoachingProviderFallback,
  recommendLiveCoachingProvider,
} from "../lib/growth/realtime/live-coaching/live-coaching-provider-selection"
import {
  buildLiveCoachingQaProofMarker,
  LIVE_COACHING_QA_PROOF_MARKER,
} from "../lib/growth/realtime/live-coaching/live-coaching-production-proof"
import type { RealtimeProviderConnection } from "../lib/growth/realtime/providers/provider-types"
import type { GrowthRealtimeCallSession } from "../lib/growth/realtime/realtime-call-types"

function connectionFixture(overrides: Partial<RealtimeProviderConnection> = {}): RealtimeProviderConnection {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "deepgram",
    label: "Deepgram Prod",
    status: "connected",
    configJson: {},
    healthStatus: "healthy",
    lastHealthCheck: null,
    lastError: null,
    capabilitySnapshot: {
      realtime: true,
      speakerDetection: true,
      keywordEvents: true,
      browserAudioStreaming: true,
      liveTranscriptStreaming: true,
      liveGuidanceCompatible: true,
      latencyMs: 90,
    },
    averageLatencyMs: 90,
    transcriptQualityScore: 80,
    providerFailoverCount: 0,
    providerDisconnectCount: 0,
    providerRecoveryAttemptCount: 0,
    providerRecoverySuccessCount: 0,
    providerRecoverySuccessRate: 0,
    authConfigured: true,
    lastSuccessfulConnectionAt: "2026-05-18T12:00:00.000Z",
    reliabilityScore: 95,
    streamFailureCount: 0,
    reconnectCount: 0,
    rateLimitEventCount: 0,
    lastDisconnectReason: null,
    temporarilyDegraded: false,
    degradedReason: null,
    degradedUntil: null,
    circuitOpen: false,
    circuitOpenUntil: null,
    validationFailureCount: 0,
    lastValidationAt: "2026-05-18T12:00:00.000Z",
    lastValidationSuccessAt: "2026-05-18T12:00:00.000Z",
    lastValidationDurationMs: 120,
    nextValidationAllowedAt: null,
    readinessStatus: "ready",
    configurationWarnings: [],
    createdBy: null,
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

const session: GrowthRealtimeCallSession = {
  id: "22222222-2222-4222-8222-222222222222",
  leadId: "33333333-3333-4333-8333-333333333333",
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
  realtimeProviderConnectionId: "11111111-1111-4111-8111-111111111111",
  providerId: "deepgram",
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

const deepgram = connectionFixture()
const assembly = connectionFixture({
  id: "44444444-4444-4444-8444-444444444444",
  provider: "assemblyai",
  label: "AssemblyAI Prod",
  averageLatencyMs: 140,
  reliabilityScore: 88,
})
const openai = connectionFixture({
  id: "55555555-5555-4555-8555-555555555555",
  provider: "openai_realtime",
  label: "OpenAI Realtime",
  averageLatencyMs: 110,
  reliabilityScore: 92,
})

const recommendation = recommendLiveCoachingProvider([assembly, openai, deepgram])
assert.equal(recommendation.connectionId, deepgram.id)
assert.match(recommendation.reason ?? "", /lowest recent transcript latency/i)

const circuitOpen = connectionFixture({
  circuitOpen: true,
  circuitOpenUntil: new Date(Date.now() + 60_000).toISOString(),
  readinessStatus: "circuit_open",
})
assert.equal(recommendLiveCoachingProvider([circuitOpen]).connectionId, null)

const rows = buildLiveCoachingProviderComparisonRows({
  connections: [deepgram, assembly],
  activeProviderConnectionId: deepgram.id,
  recommendedConnectionId: deepgram.id,
})
assert.equal(rows.length, 2)
assert.equal(rows.find((row) => row.connectionId === deepgram.id)?.recommended, true)
assert.equal(rows.find((row) => row.connectionId === deepgram.id)?.active, true)

const readiness = buildLiveCoachingProviderReadiness(deepgram)
assert.equal(readiness.configured, true)
assert.equal(readiness.validated, true)
assert.equal(readiness.browserMicSupported, true)
assert.equal(readiness.liveTranscriptSupported, true)
assert.equal(readiness.liveGuidanceCompatible, true)
assert.equal(readiness.eligibleForRecommendation, true)

assert.equal(
  explainLiveCoachingProviderFallback({
    activeProviderConnectionId: null,
    connections: [deepgram],
  }),
  BROWSER_AUDIO_TROUBLESHOOTING.fallbackManualMode,
)

assert.equal(
  explainLiveCoachingProviderFallback({
    activeProviderConnectionId: circuitOpen.id,
    connections: [circuitOpen],
  }),
  BROWSER_AUDIO_TROUBLESHOOTING.providerCircuitOpen,
)

assert.equal(countLiveCoachingReadyProviders([deepgram, circuitOpen]), 1)

const proof = buildLiveCoachingQaProofMarker({ providerCount: 2, readyProviderCount: 1 })
assert.equal(proof.marker, LIVE_COACHING_QA_PROOF_MARKER)
assert.equal(proof.verified, true)

const env = evaluateBrowserAudioCaptureEnvironment()
assert.equal(typeof env.supported, "boolean")
assert.equal(typeof env.hasGetUserMedia, "boolean")

assert.equal(canStartBrowserAudioCaptureGuard({ captureStatus: "active", starting: false }).allowed, false)
assert.equal(canStartBrowserAudioCaptureGuard({ captureStatus: "inactive", starting: true }).allowed, false)
assert.equal(canStartBrowserAudioCaptureGuard({ captureStatus: "inactive", starting: false }).allowed, true)

assert.equal(isDuplicateBrowserAudioChunkSequence({ lastSequenceNumber: 3, nextSequenceNumber: 3 }), true)
assert.equal(isDuplicateBrowserAudioChunkSequence({ lastSequenceNumber: 3, nextSequenceNumber: 4 }), false)

assert.equal(
  isStaleBrowserAudioSessionBinding({ boundSessionId: "a", activeSessionId: "b" }),
  true,
)

assert.equal(
  resolveMicrophonePermissionError("Permission denied by system"),
  BROWSER_AUDIO_TROUBLESHOOTING.microphonePermissionDenied,
)

const circuitCapability = evaluateBrowserAudioCaptureCapability({
  session,
  providerConnection: circuitOpen,
})
assert.equal(circuitCapability.canStart, false)
assert.equal(circuitCapability.disabledReason, BROWSER_AUDIO_TROUBLESHOOTING.providerCircuitOpen)

const settingsSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-live-coaching-settings.tsx"),
  "utf8",
)
const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-providers-dashboard.tsx"),
  "utf8",
)
const hookSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/growth/use-growth-browser-audio-capture.ts"),
  "utf8",
)

assert.match(settingsSource, /GrowthLiveCoachingProviderComparisonTable/, "settings renders comparison table")
assert.match(settingsSource, /Use recommended provider/, "settings exposes recommended provider action")
assert.match(dashboardSource, /Provider comparison/, "dashboard renders provider comparison")
assert.match(dashboardSource, /qaProof/, "dashboard renders QA proof marker")
assert.match(hookSource, /canStartBrowserAudioCaptureGuard/, "hook blocks double-start")
assert.match(hookSource, /evaluateBrowserAudioCaptureEnvironment/, "hook checks browser compatibility")
assert.match(hookSource, /BROWSER_AUDIO_TROUBLESHOOTING\.staleSession/, "hook handles stale session")

console.log("growth-live-coaching-provider-selection: all checks passed")
