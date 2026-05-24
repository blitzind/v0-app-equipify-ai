import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  appendRealtimeProviderLifecycleEvent,
  type RealtimeProviderLifecycleEventType,
} from "@/lib/growth/realtime/providers/realtime-provider-lifecycle-events"
import {
  fetchRealtimeProviderConnection,
  updateRealtimeProviderConnection,
} from "@/lib/growth/realtime/providers/realtime-provider-connection-repository"
import {
  computeRealtimeProviderReliabilityScore,
  nextRealtimeProviderCircuitOpenUntil,
  shouldOpenRealtimeProviderCircuit,
} from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import { resolveRealtimeProviderReadinessStatus } from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"

export async function recordRealtimeProviderOperationalEvent(
  admin: SupabaseClient,
  input: {
    connectionId: string
    sessionId?: string | null
    eventType: RealtimeProviderLifecycleEventType
    message: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const connection = await fetchRealtimeProviderConnection(admin, input.connectionId)
  if (!connection) return

  const patch: Parameters<typeof updateRealtimeProviderConnection>[2] = {}
  switch (input.eventType) {
    case "stream_open":
      patch.lastSuccessfulConnectionAt = new Date().toISOString()
      break
    case "stream_close":
      patch.reconnectCount = connection.reconnectCount
      break
    case "reconnect_attempt":
      patch.reconnectCount = connection.reconnectCount + 1
      break
    case "provider_failure":
    case "timeout":
      patch.streamFailureCount = connection.streamFailureCount + 1
      patch.lastDisconnectReason = input.message.slice(0, 240)
      break
    case "auth_failure":
      patch.validationFailureCount = connection.validationFailureCount + 1
      patch.lastDisconnectReason = input.message.slice(0, 240)
      break
    case "rate_limit":
      patch.rateLimitEventCount = connection.rateLimitEventCount + 1
      break
    case "degraded_mode":
      patch.temporarilyDegraded = true
      patch.degradedReason = input.message.slice(0, 240)
      break
    case "provider_recovery":
      patch.temporarilyDegraded = false
      patch.degradedReason = null
      patch.circuitOpen = false
      patch.circuitOpenUntil = null
      break
    default:
      break
  }

  const merged = { ...connection, ...patch, authConfigured: connection.authConfigured }
  if (
    input.eventType === "provider_failure" ||
    input.eventType === "auth_failure" ||
    input.eventType === "timeout"
  ) {
    if (shouldOpenRealtimeProviderCircuit(merged)) {
      patch.circuitOpen = true
      patch.circuitOpenUntil = nextRealtimeProviderCircuitOpenUntil()
      patch.readinessStatus = "circuit_open"
    }
  }

  patch.reliabilityScore = computeRealtimeProviderReliabilityScore(merged)
  patch.readinessStatus = resolveRealtimeProviderReadinessStatus(merged)

  await updateRealtimeProviderConnection(admin, input.connectionId, patch)
  await appendRealtimeProviderLifecycleEvent(admin, {
    connectionId: input.connectionId,
    sessionId: input.sessionId ?? null,
    eventType: input.eventType,
    message: input.message,
    metadata: input.metadata,
  })
}
