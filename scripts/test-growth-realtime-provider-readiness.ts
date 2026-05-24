/**
 * Regression checks for Growth Engine Realtime Provider Production Readiness (slice 6.12C).
 * Run: pnpm test:growth-realtime-provider-readiness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeRealtimeProviderReliabilityScore,
  isRealtimeProviderCircuitOpen,
  isRealtimeProviderValidationCooldownActive,
  realtimeProviderValidationCooldownRemainingMs,
  resolveRealtimeProviderReadinessStatus,
  shouldOpenRealtimeProviderCircuit,
} from "../lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import { buildRealtimeProviderConfigurationWarnings } from "../lib/growth/realtime/providers/realtime-provider-readiness-utils"
import {
  REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
  REALTIME_PROVIDER_LIFECYCLE_EVENT_TYPES,
  REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS,
} from "../lib/growth/realtime/providers/realtime-provider-readiness-types"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import type { RealtimeProviderConnection } from "../lib/growth/realtime/providers/provider-types"

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
      latencyMs: 120,
    },
    averageLatencyMs: 120,
    transcriptQualityScore: 80,
    providerFailoverCount: 0,
    providerDisconnectCount: 0,
    providerRecoveryAttemptCount: 0,
    providerRecoverySuccessCount: 0,
    providerRecoverySuccessRate: 0,
    authConfigured: true,
    lastSuccessfulConnectionAt: null,
    reliabilityScore: 100,
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
    lastValidationAt: null,
    lastValidationSuccessAt: null,
    lastValidationDurationMs: 0,
    nextValidationAllowedAt: null,
    readinessStatus: "ready",
    configurationWarnings: [],
    createdBy: null,
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

assert.equal(resolveRealtimeProviderReadinessStatus(connectionFixture()), "ready")
assert.equal(
  resolveRealtimeProviderReadinessStatus(connectionFixture({ authConfigured: false })),
  "not_ready",
)
assert.equal(
  resolveRealtimeProviderReadinessStatus(
    connectionFixture({
      circuitOpen: true,
      circuitOpenUntil: new Date(Date.now() + 60_000).toISOString(),
    }),
  ),
  "circuit_open",
)

assert.equal(shouldOpenRealtimeProviderCircuit(connectionFixture({ validationFailureCount: 5 })), true)
assert.equal(isRealtimeProviderCircuitOpen(connectionFixture({ circuitOpen: true, circuitOpenUntil: null })), true)

const cooldownConnection = connectionFixture({
  nextValidationAllowedAt: new Date(Date.now() + 10_000).toISOString(),
})
assert.equal(isRealtimeProviderValidationCooldownActive(cooldownConnection), true)
assert.ok(realtimeProviderValidationCooldownRemainingMs(cooldownConnection) > 0)

const reliability = computeRealtimeProviderReliabilityScore(
  connectionFixture({ streamFailureCount: 3, rateLimitEventCount: 1, healthStatus: "degraded" }),
)
assert.ok(reliability < 100 && reliability >= 40)

const warnings = buildRealtimeProviderConfigurationWarnings(connectionFixture({ authConfigured: false }))
assert.ok(warnings.some((warning) => warning.code === "auth_missing"))

assert.equal(createRealtimeProviderInstance("deepgram").supportsBrowserAudioStreaming(), true)
assert.equal(createRealtimeProviderInstance("assemblyai").supportsBrowserAudioStreaming(), true)
assert.equal(REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS, 30_000)
assert.equal(REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD, 5)
assert.ok(REALTIME_PROVIDER_LIFECYCLE_EVENT_TYPES.includes("stream_open"))
assert.ok(REALTIME_PROVIDER_LIFECYCLE_EVENT_TYPES.includes("orphan_cleanup"))

const lifecycleSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/realtime-provider-lifecycle-events.ts"),
  "utf8",
)
assert.doesNotMatch(lifecycleSource, /credentials_encrypted|apiKey|apiSecret/, "lifecycle logs must not store secrets")

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-providers-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /Test Connection/, "dashboard exposes test connection")
assert.match(dashboardSource, /Capability matrix/, "dashboard renders capability matrix")
assert.match(dashboardSource, /Browser streaming/, "dashboard renders browser streaming visibility")

const operationsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/realtime-provider-operations.ts"),
  "utf8",
)
assert.match(operationsSource, /orphan_cleanup/, "orphan cleanup safeguard exists")
assert.match(operationsSource, /stale_cleanup/, "stale stream cleanup exists")

console.log("growth-realtime-provider-readiness: all checks passed")
