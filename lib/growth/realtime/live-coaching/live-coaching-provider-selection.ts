import { REALTIME_PROVIDER_LABELS } from "@/lib/growth/realtime/browser-audio/provider-labels"
import { BROWSER_AUDIO_TROUBLESHOOTING } from "@/lib/growth/realtime/browser-audio/browser-audio-troubleshooting"
import {
  isRealtimeProviderCircuitOpen,
  isRealtimeProviderValidationCooldownActive,
  realtimeProviderValidationCooldownRemainingMs,
} from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import {
  resolveRealtimeProviderBrowserMicSupported,
  resolveRealtimeProviderLiveGuidanceCompatible,
  resolveRealtimeProviderLiveTranscriptSupported,
} from "@/lib/growth/realtime/providers/realtime-provider-capability-defaults"
import type { RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"

export type LiveCoachingProviderReadinessSummary = {
  connectionId: string
  label: string
  provider: string
  providerLabel: string
  configured: boolean
  validated: boolean
  browserMicSupported: boolean
  liveTranscriptSupported: boolean
  liveGuidanceCompatible: boolean
  degraded: boolean
  circuitOpen: boolean
  readinessStatus: string
  averageTranscriptLatencyMs: number
  reliabilityScore: number
  validationCooldownActive: boolean
  eligibleForRecommendation: boolean
}

export type LiveCoachingProviderComparisonRow = LiveCoachingProviderReadinessSummary & {
  recommended: boolean
  active: boolean
}

export type LiveCoachingProviderRecommendation = {
  connectionId: string | null
  label: string | null
  reason: string | null
}

export function buildLiveCoachingProviderReadiness(
  connection: RealtimeProviderConnection,
): LiveCoachingProviderReadinessSummary {
  const circuitOpen = isRealtimeProviderCircuitOpen(connection)
  const validated = Boolean(connection.lastValidationSuccessAt)
  const browserMicSupported = resolveRealtimeProviderBrowserMicSupported({
    providerId: connection.provider,
    capabilitySnapshot: connection.capabilitySnapshot,
  })
  const liveTranscriptSupported = resolveRealtimeProviderLiveTranscriptSupported({
    providerId: connection.provider,
    capabilitySnapshot: connection.capabilitySnapshot,
  })
  const liveGuidanceCompatible = resolveRealtimeProviderLiveGuidanceCompatible({
    providerId: connection.provider,
    capabilitySnapshot: connection.capabilitySnapshot,
  })
  const degraded =
    connection.temporarilyDegraded ||
    connection.readinessStatus === "degraded" ||
    connection.healthStatus === "degraded"
  const eligibleForRecommendation =
    connection.authConfigured &&
    validated &&
    browserMicSupported &&
    liveTranscriptSupported &&
    !circuitOpen &&
    connection.readinessStatus !== "not_ready" &&
    connection.readinessStatus !== "circuit_open"

  return {
    connectionId: connection.id,
    label: connection.label,
    provider: connection.provider,
    providerLabel: REALTIME_PROVIDER_LABELS[connection.provider] ?? connection.provider,
    configured: connection.authConfigured,
    validated,
    browserMicSupported,
    liveTranscriptSupported,
    liveGuidanceCompatible,
    degraded,
    circuitOpen,
    readinessStatus: connection.readinessStatus,
    averageTranscriptLatencyMs: connection.averageLatencyMs,
    reliabilityScore: connection.reliabilityScore,
    validationCooldownActive: isRealtimeProviderValidationCooldownActive(connection),
    eligibleForRecommendation,
  }
}

export function recommendLiveCoachingProvider(
  connections: RealtimeProviderConnection[],
): LiveCoachingProviderRecommendation {
  const summaries = connections.map(buildLiveCoachingProviderReadiness)
  const eligible = summaries
    .filter((entry) => entry.eligibleForRecommendation)
    .sort((left, right) => {
      if (left.averageTranscriptLatencyMs !== right.averageTranscriptLatencyMs) {
        return left.averageTranscriptLatencyMs - right.averageTranscriptLatencyMs
      }
      if (left.reliabilityScore !== right.reliabilityScore) {
        return right.reliabilityScore - left.reliabilityScore
      }
      return left.label.localeCompare(right.label)
    })

  const top = eligible[0]
  if (!top) {
    return {
      connectionId: null,
      label: null,
      reason: "No provider is ready for browser mic coaching. Configure credentials and run Test Connection.",
    }
  }

  return {
    connectionId: top.connectionId,
    label: top.label,
    reason: `${top.providerLabel} is ready with the lowest recent transcript latency and highest reliability among eligible providers.`,
  }
}

export function buildLiveCoachingProviderComparisonRows(input: {
  connections: RealtimeProviderConnection[]
  activeProviderConnectionId: string | null
  recommendedConnectionId: string | null
}): LiveCoachingProviderComparisonRow[] {
  return input.connections.map((connection) => {
    const summary = buildLiveCoachingProviderReadiness(connection)
    return {
      ...summary,
      recommended: summary.connectionId === input.recommendedConnectionId,
      active: summary.connectionId === input.activeProviderConnectionId,
    }
  })
}

export function explainLiveCoachingProviderFallback(input: {
  activeProviderConnectionId: string | null
  connections: RealtimeProviderConnection[]
}): string {
  if (!input.activeProviderConnectionId) {
    return BROWSER_AUDIO_TROUBLESHOOTING.fallbackManualMode
  }

  const active = input.connections.find((connection) => connection.id === input.activeProviderConnectionId)
  if (!active) {
    return "The selected provider connection is missing. Manual transcript mode is active until you select a valid provider."
  }

  const readiness = buildLiveCoachingProviderReadiness(active)
  if (readiness.circuitOpen) {
    return BROWSER_AUDIO_TROUBLESHOOTING.providerCircuitOpen
  }
  if (!readiness.configured) {
    return BROWSER_AUDIO_TROUBLESHOOTING.providerNotConfigured
  }
  if (readiness.validationCooldownActive) {
    const remainingMs = realtimeProviderValidationCooldownRemainingMs(active)
    const seconds = Math.max(1, Math.ceil(remainingMs / 1000))
    return `${BROWSER_AUDIO_TROUBLESHOOTING.retryCooldownActive} (${seconds}s remaining)`
  }
  if (readiness.degraded) {
    return BROWSER_AUDIO_TROUBLESHOOTING.providerDegraded
  }
  if (!readiness.browserMicSupported) {
    return BROWSER_AUDIO_TROUBLESHOOTING.providerUnavailable
  }
  if (readiness.readinessStatus === "not_ready") {
    return BROWSER_AUDIO_TROUBLESHOOTING.providerUnavailable
  }

  return BROWSER_AUDIO_TROUBLESHOOTING.providerUnavailable
}

export function countLiveCoachingReadyProviders(connections: RealtimeProviderConnection[]): number {
  return connections
    .map(buildLiveCoachingProviderReadiness)
    .filter((entry) => entry.eligibleForRecommendation).length
}
