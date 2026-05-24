/** Client-safe realtime provider readiness types (Growth Engine slice 6.12C). */

export const REALTIME_PROVIDER_READINESS_STATUSES = [
  "not_ready",
  "ready",
  "degraded",
  "circuit_open",
] as const

export type RealtimeProviderReadinessStatus = (typeof REALTIME_PROVIDER_READINESS_STATUSES)[number]

export type RealtimeProviderConfigurationWarning = {
  code: string
  message: string
  severity: "info" | "warning" | "critical"
}

export type RealtimeProviderCapabilityMatrix = {
  realtime: boolean
  speakerDetection: boolean
  keywordEvents: boolean
  browserAudioStreaming: boolean
}

export type RealtimeProviderDiagnostics = {
  connectionId: string
  provider: string
  label: string
  status: string
  readinessStatus: RealtimeProviderReadinessStatus
  authConfigured: boolean
  browserStreamingSupported: boolean
  lastSuccessfulConnectionAt: string | null
  reliabilityScore: number
  averageTranscriptLatencyMs: number
  streamFailures: number
  reconnectCount: number
  rateLimitEvents: number
  lastDisconnectReason: string | null
  circuitOpen: boolean
  circuitOpenUntil: string | null
  temporarilyDegraded: boolean
  degradedUntil: string | null
  configurationWarnings: RealtimeProviderConfigurationWarning[]
  capabilityMatrix: RealtimeProviderCapabilityMatrix
  fallbackEligible: boolean
  lastValidationAt: string | null
  lastValidationSuccessAt: string | null
  validationCooldownRemainingMs: number
}

export type RealtimeProviderValidationResult = {
  ok: boolean
  healthStatus: string
  latencyMs: number
  message: string
  durationMs: number
  warnings: RealtimeProviderConfigurationWarning[]
  capabilityMatrix: RealtimeProviderCapabilityMatrix
  readinessStatus: RealtimeProviderReadinessStatus
  cooldownRemainingMs: number
}

export const REALTIME_PROVIDER_VALIDATION_COOLDOWN_MS = 30_000
export const REALTIME_PROVIDER_CIRCUIT_FAILURE_THRESHOLD = 5
export const REALTIME_PROVIDER_CIRCU_OPEN_MS = 5 * 60_000
export const REALTIME_PROVIDER_STUCK_STREAM_MS = 10 * 60_000

export const REALTIME_PROVIDER_LIFECYCLE_EVENT_TYPES = [
  "stream_open",
  "stream_close",
  "reconnect_attempt",
  "provider_failure",
  "provider_recovery",
  "auth_failure",
  "rate_limit",
  "timeout",
  "degraded_mode",
  "validation_success",
  "validation_failure",
  "circuit_open",
  "circuit_close",
  "stale_cleanup",
  "orphan_cleanup",
] as const

export type RealtimeProviderLifecycleEventType = (typeof REALTIME_PROVIDER_LIFECYCLE_EVENT_TYPES)[number]
