import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptGrowthProviderCredentials } from "@/lib/growth/outbound/credentials-crypto"
import {
  fetchRealtimeProviderConnection,
  fetchRealtimeProviderConnectionInternal,
  incrementRealtimeProviderMetric,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { fetchGrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/live-coaching-settings-repository"
import { createRealtimeProviderInstance } from "@/lib/growth/realtime/providers/provider-registry"
import type {
  RealtimeProviderRouteResult,
  RealtimeProviderRuntimeConfig,
  RealtimeTranscriptProvider,
} from "@/lib/growth/realtime/providers/provider-types"

function buildRuntimeConfig(input: {
  connectionId: string
  providerId: string
  configJson: RealtimeProviderRuntimeConfig["configJson"]
  credentialsEncrypted: string | null
  settings: Awaited<ReturnType<typeof fetchGrowthLiveCoachingSettings>>
}): RealtimeProviderRuntimeConfig {
  return {
    connectionId: input.connectionId,
    providerId: input.providerId as RealtimeProviderRuntimeConfig["providerId"],
    configJson: input.configJson,
    credentials: decryptGrowthProviderCredentials(input.credentialsEncrypted),
    speakerSeparationEnabled: input.settings.speakerSeparationEnabled,
    keywordEventsEnabled: input.settings.keywordEventsEnabled,
    confidenceThreshold: input.settings.transcriptConfidenceThreshold,
    customKeywords: input.settings.customKeywords,
    industryProfile: input.settings.industryProfile,
  }
}

export async function resolveRealtimeProviderRoute(
  admin: SupabaseClient,
): Promise<RealtimeProviderRouteResult> {
  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const fallbackId = settings.fallbackProvider || "stub"

  if (!settings.activeProviderConnectionId) {
    const provider = createRealtimeProviderInstance(fallbackId)
    return {
      provider,
      providerId: fallbackId,
      connectionId: null,
      transcriptSource: fallbackId === "stub" ? "stub" : "manual",
      failoverApplied: false,
    }
  }

  const connection = await fetchRealtimeProviderConnectionInternal(admin, settings.activeProviderConnectionId)
  if (!connection || connection.status === "error" || connection.healthStatus === "unhealthy") {
    if (connection) {
      await incrementRealtimeProviderMetric(admin, connection.id, "failover")
    }
    const provider = createRealtimeProviderInstance(fallbackId)
    return {
      provider,
      providerId: fallbackId,
      connectionId: connection?.id ?? null,
      transcriptSource: "stub",
      failoverApplied: true,
    }
  }

  const runtimeConfig = buildRuntimeConfig({
    connectionId: connection.id,
    providerId: connection.provider,
    configJson: connection.configJson,
    credentialsEncrypted: connection.credentialsEncrypted,
    settings,
  })

  const provider = createRealtimeProviderInstance(connection.provider)
  const health = await provider.health(runtimeConfig)
  if (!health.ok) {
    await incrementRealtimeProviderMetric(admin, connection.id, "failover")
    const fallback = createRealtimeProviderInstance(fallbackId)
    return {
      provider: fallback,
      providerId: fallbackId,
      connectionId: connection.id,
      transcriptSource: "stub",
      failoverApplied: true,
    }
  }

  return {
    provider,
    providerId: connection.provider,
    connectionId: connection.id,
    transcriptSource: "provider",
    failoverApplied: false,
  }
}

export async function buildProviderRuntimeConfigForConnection(
  admin: SupabaseClient,
  connectionId: string,
): Promise<{ provider: RealtimeTranscriptProvider; runtimeConfig: RealtimeProviderRuntimeConfig } | null> {
  const connection = await fetchRealtimeProviderConnectionInternal(admin, connectionId)
  if (!connection) return null
  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const runtimeConfig = buildRuntimeConfig({
    connectionId: connection.id,
    providerId: connection.provider,
    configJson: connection.configJson,
    credentialsEncrypted: connection.credentialsEncrypted,
    settings,
  })
  return {
    provider: createRealtimeProviderInstance(connection.provider),
    runtimeConfig,
  }
}

export async function attemptProviderRecovery(
  admin: SupabaseClient,
  connectionId: string,
): Promise<boolean> {
  const connection = await fetchRealtimeProviderConnection(admin, connectionId)
  if (!connection) return false
  await incrementRealtimeProviderMetric(admin, connectionId, "recovery_attempt")
  const built = await buildProviderRuntimeConfigForConnection(admin, connectionId)
  if (!built) return false
  const health = await built.provider.health(built.runtimeConfig)
  if (health.ok) {
    await incrementRealtimeProviderMetric(admin, connectionId, "recovery_success")
    return true
  }
  return false
}
