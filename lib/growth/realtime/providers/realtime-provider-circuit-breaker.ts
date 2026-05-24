import type { RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"
import {
  REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
  REALTIME_PROVIDER_CIRCU_OPEN_MS,
  type RealtimeProviderReadinessStatus,
} from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"

export function isRealtimeProviderCircuitOpen(connection: RealtimeProviderConnection): boolean {
  if (!connection.circuitOpen) return false
  if (!connection.circuitOpenUntil) return true
  return new Date(connection.circuitOpenUntil).getTime() > Date.now()
}

export function isRealtimeProviderValidationCooldownActive(connection: RealtimeProviderConnection): boolean {
  if (!connection.nextValidationAllowedAt) return false
  return new Date(connection.nextValidationAllowedAt).getTime() > Date.now()
}

export function realtimeProviderValidationCooldownRemainingMs(connection: RealtimeProviderConnection): number {
  if (!connection.nextValidationAllowedAt) return 0
  return Math.max(0, new Date(connection.nextValidationAllowedAt).getTime() - Date.now())
}

export function computeRealtimeProviderReliabilityScore(connection: RealtimeProviderConnection): number {
  let score = 100
  score -= Math.min(40, connection.validationFailureCount * 5)
  score -= Math.min(30, connection.streamFailureCount * 3)
  score -= Math.min(20, connection.rateLimitEventCount * 10)
  if (isRealtimeProviderCircuitOpen(connection)) score -= 30
  if (connection.temporarilyDegraded) score -= 15
  if (connection.healthStatus === "unhealthy") score -= 20
  if (connection.healthStatus === "degraded") score -= 10
  if (!connection.authConfigured) score -= 25
  return Math.max(0, Math.min(100, score))
}

export function resolveRealtimeProviderReadinessStatus(
  connection: RealtimeProviderConnection,
): RealtimeProviderReadinessStatus {
  if (isRealtimeProviderCircuitOpen(connection)) return "circuit_open"
  if (connection.temporarilyDegraded) return "degraded"
  if (!connection.authConfigured) return "not_ready"
  if (connection.healthStatus === "unhealthy" || connection.status === "error") return "not_ready"
  if (connection.healthStatus === "healthy" || connection.healthStatus === "degraded") return "ready"
  return "not_ready"
}

export function shouldOpenRealtimeProviderCircuit(connection: RealtimeProviderConnection): boolean {
  return (
    connection.validationFailureCount >= REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD ||
    connection.streamFailureCount >= REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD * 2
  )
}

export function nextRealtimeProviderCircuitOpenUntil(): string {
  return new Date(Date.now() + REALTIME_PROVIDER_CIRCU_OPEN_MS).toISOString()
}

export function isRealtimeProviderFallbackEligible(connection: RealtimeProviderConnection): boolean {
  if (!connection.authConfigured) return false
  if (isRealtimeProviderCircuitOpen(connection)) return false
  if (connection.healthStatus === "unhealthy") return false
  return connection.capabilitySnapshot.realtime
}
