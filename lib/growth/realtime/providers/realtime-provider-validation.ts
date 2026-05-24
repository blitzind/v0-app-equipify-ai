import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  computeRealtimeProviderReliabilityScore,
  isRealtimeProviderValidationCooldownActive,
  nextRealtimeProviderCircuitOpenUntil,
  realtimeProviderValidationCooldownRemainingMs,
  resolveRealtimeProviderReadinessStatus,
  shouldOpenRealtimeProviderCircuit,
} from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import { buildRealtimeProviderConfigurationWarnings } from "@/lib/growth/realtime/providers/realtime-provider-readiness-utils"
import { fetchGrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/live-coaching-settings-repository"
import { appendRealtimeProviderLifecycleEvent } from "@/lib/growth/realtime/providers/realtime-provider-lifecycle-events"
import {
  fetchRealtimeProviderConnectionInternal,
  sanitizeRealtimeProviderConnectionForApi,
  updateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import {
  REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS,
  type RealtimeProviderValidationResult,
} from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import { createRealtimeProviderInstance } from "@/lib/growth/realtime/providers/provider-registry"
import type {
  RealtimeProviderHealthStatus,
  RealtimeProviderRuntimeConfig,
} from "@/lib/growth/realtime/providers/provider-types"
import { decryptGrowthProviderCredentials } from "@/lib/growth/outbound/credentials-crypto"

export class RealtimeProviderValidationCooldownError extends Error {
  readonly remainingMs: number

  constructor(remainingMs: number) {
    super(`validation_cooldown:${remainingMs}`)
    this.remainingMs = remainingMs
  }
}

function buildRuntimeConfig(
  connection: NonNullable<Awaited<ReturnType<typeof fetchRealtimeProviderConnectionInternal>>>,
  settings: Awaited<ReturnType<typeof fetchGrowthLiveCoachingSettings>>,
): RealtimeProviderRuntimeConfig {
  return {
    connectionId: connection.id,
    providerId: connection.provider,
    configJson: connection.configJson,
    credentials: decryptGrowthProviderCredentials(connection.credentialsEncrypted),
    speakerSeparationEnabled: settings.speakerSeparationEnabled,
    keywordEventsEnabled: settings.keywordEventsEnabled,
    confidenceThreshold: settings.transcriptConfidenceThreshold,
    customKeywords: settings.customKeywords,
    industryProfile: settings.industryProfile,
  }
}

export async function validateRealtimeProviderConnection(
  admin: SupabaseClient,
  input: {
    connectionId: string
    actorUserId?: string | null
    force?: boolean
  },
): Promise<{
  connection: ReturnType<typeof sanitizeRealtimeProviderConnectionForApi>
  validation: RealtimeProviderValidationResult
}> {
  const connection = await fetchRealtimeProviderConnectionInternal(admin, input.connectionId)
  if (!connection) throw new Error("not_found")

  const authConfigured = Boolean(connection.credentialsEncrypted)
  const mapped = {
    ...connection,
    authConfigured,
  }

  if (!input.force && isRealtimeProviderValidationCooldownActive(mapped)) {
    throw new RealtimeProviderValidationCooldownError(realtimeProviderValidationCooldownRemainingMs(mapped))
  }

  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const runtimeConfig = buildRuntimeConfig(connection, settings)
  const provider = createRealtimeProviderInstance(connection.provider)
  const started = Date.now()
  const health = await provider.health(runtimeConfig)
  const durationMs = Date.now() - started

  const healthStatus: RealtimeProviderHealthStatus = health.ok
    ? health.latencyMs && health.latencyMs > 500
      ? "degraded"
      : "healthy"
    : "unhealthy"

  const validationFailureCount = health.ok ? 0 : connection.validationFailureCount + 1
  const streamFailureCount = connection.streamFailureCount
  const openCircuit = !health.ok && shouldOpenRealtimeProviderCircuit({
    ...mapped,
    validationFailureCount,
    streamFailureCount,
  })

  const now = new Date().toISOString()
  const nextValidationAllowedAt = new Date(Date.now() + REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS).toISOString()
  const capabilitySnapshot = {
    realtime: health.capabilities?.realtime ?? provider.supportsRealtime(),
    speakerDetection: health.capabilities?.speakerDetection ?? provider.supportsSpeakerDetection(),
    keywordEvents: health.capabilities?.keywordEvents ?? provider.supportsKeywordEvents(),
    browserAudioStreaming: provider.supportsBrowserAudioStreaming(),
    latencyMs: health.latencyMs ?? 0,
  }

  const updatedPatch = {
    healthStatus,
    lastHealthCheck: now,
    lastError: health.ok ? null : health.message,
    capabilitySnapshot,
    averageLatencyMs: health.latencyMs
      ? Math.round((connection.averageLatencyMs + health.latencyMs) / 2)
      : connection.averageLatencyMs,
    status: health.ok ? ("connected" as const) : ("error" as const),
    authConfigured,
    lastValidationAt: now,
    lastValidationSuccessAt: health.ok ? now : connection.lastValidationSuccessAt,
    lastValidationDurationMs: durationMs,
    nextValidationAllowedAt,
    validationFailureCount,
    lastSuccessfulConnectionAt: health.ok ? now : connection.lastSuccessfulConnectionAt,
    temporarilyDegraded: healthStatus === "degraded",
    degradedReason: healthStatus === "degraded" ? "Elevated provider latency detected." : null,
    degradedUntil:
      healthStatus === "degraded"
        ? new Date(Date.now() + REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS).toISOString()
        : null,
    circuitOpen: openCircuit,
    circuitOpenUntil: openCircuit ? nextRealtimeProviderCircuitOpenUntil() : null,
    readinessStatus: resolveRealtimeProviderReadinessStatus({
      ...mapped,
      healthStatus,
      validationFailureCount,
      circuitOpen: openCircuit,
      temporarilyDegraded: healthStatus === "degraded",
      authConfigured,
    }),
    reliabilityScore: 0,
    configurationWarnings: buildRealtimeProviderConfigurationWarnings({
      ...mapped,
      healthStatus,
      capabilitySnapshot,
      circuitOpen: openCircuit,
      temporarilyDegraded: healthStatus === "degraded",
    }),
  }

  updatedPatch.reliabilityScore = computeRealtimeProviderReliabilityScore({
    ...mapped,
    ...updatedPatch,
  })

  const updated = await updateRealtimeProviderConnection(admin, input.connectionId, updatedPatch)

  await appendRealtimeProviderLifecycleEvent(admin, {
    connectionId: connection.id,
    eventType: health.ok ? "validation_success" : "validation_failure",
    message: health.message,
    metadata: {
      durationMs,
      latencyMs: health.latencyMs ?? 0,
      healthStatus,
      browserStreamingSupported: providerSupportsBrowserAudioStreaming(connection.provider),
    },
  })

  if (openCircuit) {
    await appendRealtimeProviderLifecycleEvent(admin, {
      connectionId: connection.id,
      eventType: "circuit_open",
      message: "Provider circuit opened after repeated validation failures.",
      metadata: { validationFailureCount },
    })
  }

  const validation: RealtimeProviderValidationResult = {
    ok: health.ok,
    healthStatus,
    latencyMs: health.latencyMs ?? 0,
    message: health.message,
    durationMs,
    warnings: updated.configurationWarnings,
    capabilityMatrix: {
      realtime: capabilitySnapshot.realtime,
      speakerDetection: capabilitySnapshot.speakerDetection,
      keywordEvents: capabilitySnapshot.keywordEvents,
      browserAudioStreaming: capabilitySnapshot.browserAudioStreaming,
    },
    readinessStatus: updated.readinessStatus,
    cooldownRemainingMs: REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS,
  }

  return {
    connection: sanitizeRealtimeProviderConnectionForApi(updated),
    validation,
  }
}
