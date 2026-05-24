import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  computeRealtimeProviderReliabilityScore,
  isRealtimeProviderCircuitOpen,
  isRealtimeProviderFallbackEligible,
  isRealtimeProviderValidationCooldownActive,
  realtimeProviderValidationCooldownRemainingMs,
  resolveRealtimeProviderReadinessStatus,
} from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import {
  fetchRealtimeProviderConnection,
  fetchRealtimeProviderConnectionInternal,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import { listRecentRealtimeProviderLifecycleEvents } from "@/lib/growth/realtime/providers/realtime-provider-lifecycle-events"
import type { RealtimeProviderDiagnostics } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import {
  buildRealtimeProviderCapabilityMatrix,
  buildRealtimeProviderConfigurationWarnings,
} from "@/lib/growth/realtime/providers/realtime-provider-readiness-utils"

export async function fetchRealtimeProviderDiagnostics(
  admin: SupabaseClient,
  connectionId: string,
): Promise<RealtimeProviderDiagnostics | null> {
  const connection = await fetchRealtimeProviderConnection(admin, connectionId)
  if (!connection) return null

  const internal = await fetchRealtimeProviderConnectionInternal(admin, connectionId)
  const authConfigured = Boolean(internal?.credentialsEncrypted)

  const capabilityMatrix = buildRealtimeProviderCapabilityMatrix(connection)
  const configurationWarnings = buildRealtimeProviderConfigurationWarnings({
    ...connection,
    authConfigured,
  })

  return {
    connectionId: connection.id,
    provider: connection.provider,
    label: connection.label,
    status: connection.status,
    readinessStatus: resolveRealtimeProviderReadinessStatus({ ...connection, authConfigured }),
    authConfigured,
    browserStreamingSupported: providerSupportsBrowserAudioStreaming(connection.provider),
    lastSuccessfulConnectionAt: connection.lastSuccessfulConnectionAt,
    reliabilityScore: computeRealtimeProviderReliabilityScore({ ...connection, authConfigured }),
    averageTranscriptLatencyMs: connection.averageLatencyMs,
    streamFailures: connection.streamFailureCount,
    reconnectCount: connection.reconnectCount,
    rateLimitEvents: connection.rateLimitEventCount,
    lastDisconnectReason: connection.lastDisconnectReason,
    circuitOpen: isRealtimeProviderCircuitOpen(connection),
    circuitOpenUntil: connection.circuitOpenUntil,
    temporarilyDegraded: connection.temporarilyDegraded,
    degradedUntil: connection.degradedUntil,
    configurationWarnings,
    capabilityMatrix,
    fallbackEligible: isRealtimeProviderFallbackEligible({ ...connection, authConfigured }),
    lastValidationAt: connection.lastValidationAt,
    lastValidationSuccessAt: connection.lastValidationSuccessAt,
    validationCooldownRemainingMs: isRealtimeProviderValidationCooldownActive(connection)
      ? realtimeProviderValidationCooldownRemainingMs(connection)
      : 0,
  }
}

export async function fetchRealtimeProviderDiagnosticsBundle(
  admin: SupabaseClient,
  connectionId: string,
): Promise<{
  diagnostics: RealtimeProviderDiagnostics
  recentEvents: Awaited<ReturnType<typeof listRecentRealtimeProviderLifecycleEvents>>
} | null> {
  const diagnostics = await fetchRealtimeProviderDiagnostics(admin, connectionId)
  if (!diagnostics) return null
  const recentEvents = await listRecentRealtimeProviderLifecycleEvents(admin, {
    connectionId,
    limit: 12,
  })
  return { diagnostics, recentEvents }
}
