import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import {
  isRealtimeProviderCircuitOpen,
  resolveRealtimeProviderReadinessStatus,
} from "@/lib/growth/realtime/providers/realtime-provider-circuit-breaker"
import { createRealtimeProviderInstance } from "@/lib/growth/realtime/providers/provider-registry"
import type {
  RealtimeProviderCapabilityMatrix,
  RealtimeProviderConfigurationWarning,
} from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"
import type { RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"

export function buildRealtimeProviderCapabilityMatrix(
  connection: RealtimeProviderConnection,
): RealtimeProviderCapabilityMatrix {
  const provider = createRealtimeProviderInstance(connection.provider)
  return {
    realtime: provider.supportsRealtime(),
    speakerDetection: provider.supportsSpeakerDetection(),
    keywordEvents: provider.supportsKeywordEvents(),
    browserAudioStreaming: provider.supportsBrowserAudioStreaming(),
  }
}

export function buildRealtimeProviderConfigurationWarnings(
  connection: RealtimeProviderConnection,
): RealtimeProviderConfigurationWarning[] {
  const warnings: RealtimeProviderConfigurationWarning[] = []
  const matrix = buildRealtimeProviderCapabilityMatrix(connection)

  if (!connection.authConfigured) {
    warnings.push({
      code: "auth_missing",
      message: "Provider credentials are not configured.",
      severity: "critical",
    })
  }

  if (connection.provider === "custom" && !connection.configJson.endpoint) {
    warnings.push({
      code: "custom_endpoint_missing",
      message: "Custom provider requires an endpoint in configuration.",
      severity: "critical",
    })
  }

  if (
    connection.provider === "deepgram" &&
    !providerSupportsBrowserAudioStreaming(connection.provider)
  ) {
    warnings.push({
      code: "browser_stream_unsupported",
      message: "Browser audio streaming is not available for this provider.",
      severity: "warning",
    })
  }

  if (isRealtimeProviderCircuitOpen(connection)) {
    warnings.push({
      code: "circuit_open",
      message: "Provider circuit is open due to repeated failures. Retry after cooldown.",
      severity: "critical",
    })
  }

  if (connection.temporarilyDegraded) {
    warnings.push({
      code: "degraded_mode",
      message: connection.degradedReason ?? "Provider is temporarily degraded.",
      severity: "warning",
    })
  }

  if (connection.healthStatus === "degraded") {
    warnings.push({
      code: "high_latency",
      message: "Provider health is degraded due to elevated latency.",
      severity: "warning",
    })
  }

  if (resolveRealtimeProviderReadinessStatus(connection) === "not_ready" && connection.authConfigured) {
    warnings.push({
      code: "not_ready",
      message: "Provider is not ready for live coaching.",
      severity: "warning",
    })
  }

  return warnings
}
