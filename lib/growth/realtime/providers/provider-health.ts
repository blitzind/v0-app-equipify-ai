import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchRealtimeProviderConnectionInternal,
  updateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { fetchGrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/live-coaching-settings-repository"
import { createRealtimeProviderInstance } from "@/lib/growth/realtime/providers/provider-registry"
import type {
  RealtimeProviderHealthStatus,
  RealtimeProviderRuntimeConfig,
} from "@/lib/growth/realtime/providers/provider-types"

export async function probeRealtimeProviderHealth(
  admin: SupabaseClient,
  connectionId: string,
): Promise<{ healthStatus: RealtimeProviderHealthStatus; latencyMs: number; message: string }> {
  const connection = await fetchRealtimeProviderConnectionInternal(admin, connectionId)
  if (!connection) throw new Error("not_found")

  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const runtimeConfig: RealtimeProviderRuntimeConfig = {
    connectionId: connection.id,
    providerId: connection.provider,
    configJson: connection.configJson,
    credentials: connection.credentialsEncrypted
      ? (await import("@/lib/growth/outbound/credentials-crypto")).decryptGrowthProviderCredentials(
          connection.credentialsEncrypted,
        )
      : null,
    speakerSeparationEnabled: settings.speakerSeparationEnabled,
    keywordEventsEnabled: settings.keywordEventsEnabled,
    confidenceThreshold: settings.transcriptConfidenceThreshold,
    customKeywords: settings.customKeywords,
    industryProfile: settings.industryProfile,
  }

  const provider = createRealtimeProviderInstance(connection.provider)
  const health = await provider.health(runtimeConfig)
  const healthStatus: RealtimeProviderHealthStatus = health.ok
    ? health.latencyMs && health.latencyMs > 500
      ? "degraded"
      : "healthy"
    : "unhealthy"

  const averageLatencyMs = health.latencyMs
    ? Math.round((connection.averageLatencyMs + health.latencyMs) / 2)
    : connection.averageLatencyMs

  await updateRealtimeProviderConnection(admin, connectionId, {
    healthStatus,
    lastHealthCheck: new Date().toISOString(),
    lastError: health.ok ? null : health.message,
    capabilitySnapshot: health.capabilities ?? connection.capabilitySnapshot,
    averageLatencyMs,
    status: health.ok ? "connected" : "error",
  })

  return { healthStatus, latencyMs: health.latencyMs ?? 0, message: health.message }
}

import { computeTranscriptQualityScore } from "@/lib/growth/realtime/providers/transcript-quality"