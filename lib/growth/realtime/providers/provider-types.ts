/** Client-safe realtime transcript provider types (Growth Engine slice 6.11A). */

export const REALTIME_PROVIDER_IDS = [
  "stub",
  "deepgram",
  "assemblyai",
  "openai_realtime",
  "custom",
] as const

export type RealtimeProviderId = (typeof REALTIME_PROVIDER_IDS)[number]

export const REALTIME_PROVIDER_CONNECTION_STATUSES = [
  "inactive",
  "connecting",
  "connected",
  "error",
] as const

export type RealtimeProviderConnectionStatus =
  (typeof REALTIME_PROVIDER_CONNECTION_STATUSES)[number]

export const REALTIME_PROVIDER_HEALTH_STATUSES = [
  "unknown",
  "healthy",
  "degraded",
  "unhealthy",
] as const

export type RealtimeProviderHealthStatus = (typeof REALTIME_PROVIDER_HEALTH_STATUSES)[number]

export const REALTIME_TRANSCRIPT_SOURCES = ["manual", "stub", "provider", "browser_mic"] as const
export type RealtimeTranscriptSource = (typeof REALTIME_TRANSCRIPT_SOURCES)[number]

export type RealtimeProviderCapabilitySnapshot = {
  realtime: boolean
  speakerDetection: boolean
  keywordEvents: boolean
  browserAudioStreaming: boolean
  liveTranscriptStreaming: boolean
  liveGuidanceCompatible: boolean
  latencyMs: number
}

export type RealtimeProviderIndustryProfile = {
  vertical?: string | null
  segment?: string | null
  version?: number
  metadata?: Record<string, unknown>
}

export type RealtimeProviderConfigJson = {
  endpoint?: string | null
  model?: string | null
  region?: string | null
  customKeywords?: string[]
  industryProfile?: RealtimeProviderIndustryProfile
  notes?: string | null
}

export type RealtimeProviderConnection = {
  id: string
  provider: Exclude<RealtimeProviderId, "stub">
  label: string
  status: RealtimeProviderConnectionStatus
  configJson: RealtimeProviderConfigJson
  healthStatus: RealtimeProviderHealthStatus
  lastHealthCheck: string | null
  lastError: string | null
  capabilitySnapshot: RealtimeProviderCapabilitySnapshot
  averageLatencyMs: number
  transcriptQualityScore: number
  providerFailoverCount: number
  providerDisconnectCount: number
  providerRecoveryAttemptCount: number
  providerRecoverySuccessCount: number
  providerRecoverySuccessRate: number
  authConfigured: boolean
  lastSuccessfulConnectionAt: string | null
  reliabilityScore: number
  streamFailureCount: number
  reconnectCount: number
  rateLimitEventCount: number
  lastDisconnectReason: string | null
  temporarilyDegraded: boolean
  degradedReason: string | null
  degradedUntil: string | null
  circuitOpen: boolean
  circuitOpenUntil: string | null
  validationFailureCount: number
  lastValidationAt: string | null
  lastValidationSuccessAt: string | null
  lastValidationDurationMs: number
  nextValidationAllowedAt: string | null
  readinessStatus: "not_ready" | "ready" | "degraded" | "circuit_open"
  configurationWarnings: Array<{ code: string; message: string; severity: "info" | "warning" | "critical" }>
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type RealtimeProviderRuntimeConfig = {
  connectionId: string
  providerId: RealtimeProviderId
  configJson: RealtimeProviderConfigJson
  credentials: Record<string, unknown> | null
  speakerSeparationEnabled: boolean
  keywordEventsEnabled: boolean
  confidenceThreshold: number
  customKeywords: string[]
  industryProfile: RealtimeProviderIndustryProfile
}

export type RealtimeProviderHealth = {
  ok: boolean
  providerId: RealtimeProviderId
  mode: "stub" | "live"
  message: string
  latencyMs?: number
  capabilities?: RealtimeProviderCapabilitySnapshot
}

export type RealtimeTranscriptChunk = {
  speaker: "rep" | "prospect" | "system"
  content: string
  timestampMs: number
  isFinal: boolean
  confidence?: number
  keywords?: string[]
}

export type RealtimeBrowserAudioChunkInput = {
  encoding: string
  payload: Buffer
  sequenceNumber: number
  timestampMs: number
  durationMs?: number
}

export type RealtimeTranscriptProvider = {
  readonly providerId: RealtimeProviderId
  connect(sessionId: string, config: RealtimeProviderRuntimeConfig): Promise<void>
  disconnect(): Promise<void>
  health(config: RealtimeProviderRuntimeConfig): Promise<RealtimeProviderHealth>
  stream(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<() => void>
  supportsRealtime(): boolean
  supportsSpeakerDetection(): boolean
  supportsKeywordEvents(): boolean
  supportsBrowserAudioStreaming(): boolean
  supportsLiveTranscriptStreaming(): boolean
  supportsLiveGuidanceCompatible(): boolean
  openBrowserAudioStream?(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<void>
  closeBrowserAudioStream?(): Promise<void>
  ingestBrowserAudioChunk?(input: RealtimeBrowserAudioChunkInput): Promise<void>
}

export type RealtimeProviderRouteResult = {
  provider: RealtimeTranscriptProvider
  providerId: RealtimeProviderId
  connectionId: string | null
  transcriptSource: RealtimeTranscriptSource
  failoverApplied: boolean
}

export type GrowthLiveCoachingSettings = {
  activeProviderConnectionId: string | null
  fallbackProvider: RealtimeProviderId
  speakerSeparationEnabled: boolean
  keywordEventsEnabled: boolean
  transcriptConfidenceThreshold: number
  customKeywords: string[]
  industryProfile: RealtimeProviderIndustryProfile
  criticalGuidanceThreshold: number
  normalGuidanceThreshold: number
}

/** Provider orchestration never triggers autonomous actions. */
export const REALTIME_PROVIDER_AUTONOMOUS_ACTIONS: string[] = []
