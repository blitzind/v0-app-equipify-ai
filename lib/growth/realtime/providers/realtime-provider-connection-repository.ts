import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  decryptGrowthProviderCredentials,
  encryptGrowthProviderCredentials,
  sanitizeGrowthProviderConfigForApi,
} from "@/lib/growth/outbound/credentials-crypto"
import type {
  RealtimeProviderCapabilitySnapshot,
  RealtimeProviderConfigJson,
  RealtimeProviderConnection,
  RealtimeProviderConnectionStatus,
  RealtimeProviderHealthStatus,
} from "@/lib/growth/realtime/providers/provider-types"

type ConnectionRow = {
  id: string
  provider: string
  label: string
  status: string
  config_json: unknown
  credentials_encrypted: string | null
  health_status: string
  last_health_check: string | null
  last_error: string | null
  capability_snapshot: unknown
  average_latency_ms: number
  transcript_quality_score: number
  provider_failover_count: number
  provider_disconnect_count: number
  provider_recovery_attempt_count: number
  provider_recovery_success_count: number
  auth_configured: boolean
  last_successful_connection_at: string | null
  reliability_score: number
  stream_failure_count: number
  reconnect_count: number
  rate_limit_event_count: number
  last_disconnect_reason: string | null
  temporarily_degraded: boolean
  degraded_reason: string | null
  degraded_until: string | null
  circuit_open: boolean
  circuit_open_until: string | null
  validation_failure_count: number
  last_validation_at: string | null
  last_validation_success_at: string | null
  last_validation_duration_ms: number
  next_validation_allowed_at: string | null
  readiness_status: string
  configuration_warnings: unknown
  created_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, provider, label, status, config_json, credentials_encrypted, health_status, last_health_check, last_error, capability_snapshot, average_latency_ms, transcript_quality_score, provider_failover_count, provider_disconnect_count, provider_recovery_attempt_count, provider_recovery_success_count, auth_configured, last_successful_connection_at, reliability_score, stream_failure_count, reconnect_count, rate_limit_event_count, last_disconnect_reason, temporarily_degraded, degraded_reason, degraded_until, circuit_open, circuit_open_until, validation_failure_count, last_validation_at, last_validation_success_at, last_validation_duration_ms, next_validation_allowed_at, readiness_status, configuration_warnings, created_by, created_at, updated_at"

function table(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_provider_connections")
}

function parseConfig(value: unknown): RealtimeProviderConfigJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  return {
    endpoint: typeof raw.endpoint === "string" ? raw.endpoint : null,
    model: typeof raw.model === "string" ? raw.model : null,
    region: typeof raw.region === "string" ? raw.region : null,
    customKeywords: Array.isArray(raw.customKeywords)
      ? raw.customKeywords.filter((entry): entry is string => typeof entry === "string")
      : [],
    industryProfile:
      raw.industryProfile && typeof raw.industryProfile === "object" && !Array.isArray(raw.industryProfile)
        ? (raw.industryProfile as RealtimeProviderConfigJson["industryProfile"])
        : {},
    notes: typeof raw.notes === "string" ? raw.notes : null,
  }
}

function parseCapabilities(value: unknown): RealtimeProviderCapabilitySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      realtime: false,
      speakerDetection: false,
      keywordEvents: false,
      browserAudioStreaming: false,
      liveTranscriptStreaming: false,
      liveGuidanceCompatible: false,
      latencyMs: 0,
    }
  }
  const raw = value as Record<string, unknown>
  return {
    realtime: Boolean(raw.realtime),
    speakerDetection: Boolean(raw.speakerDetection),
    keywordEvents: Boolean(raw.keywordEvents),
    browserAudioStreaming: Boolean(raw.browserAudioStreaming),
    liveTranscriptStreaming: Boolean(raw.liveTranscriptStreaming ?? raw.browserAudioStreaming),
    liveGuidanceCompatible: Boolean(raw.liveGuidanceCompatible ?? raw.realtime),
    latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : 0,
  }
}

function parseConfigurationWarnings(value: unknown): RealtimeProviderConnection["configurationWarnings"] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const raw = entry as Record<string, unknown>
      return {
        code: typeof raw.code === "string" ? raw.code : "warning",
        message: typeof raw.message === "string" ? raw.message : "Configuration warning",
        severity:
          raw.severity === "critical" || raw.severity === "warning" || raw.severity === "info"
            ? raw.severity
            : "warning",
      }
    })
}

function recoveryRate(attempts: number, successes: number): number {
  if (attempts <= 0) return 0
  return Math.round((successes / attempts) * 100)
}

export function mapRealtimeProviderConnection(row: ConnectionRow): RealtimeProviderConnection {
  return {
    id: row.id,
    provider: row.provider as RealtimeProviderConnection["provider"],
    label: row.label,
    status: row.status as RealtimeProviderConnectionStatus,
    configJson: parseConfig(row.config_json),
    healthStatus: row.health_status as RealtimeProviderHealthStatus,
    lastHealthCheck: row.last_health_check,
    lastError: row.last_error,
    capabilitySnapshot: parseCapabilities(row.capability_snapshot),
    averageLatencyMs: row.average_latency_ms,
    transcriptQualityScore: row.transcript_quality_score,
    providerFailoverCount: row.provider_failover_count,
    providerDisconnectCount: row.provider_disconnect_count,
    providerRecoveryAttemptCount: row.provider_recovery_attempt_count,
    providerRecoverySuccessCount: row.provider_recovery_success_count,
    providerRecoverySuccessRate: recoveryRate(
      row.provider_recovery_attempt_count,
      row.provider_recovery_success_count,
    ),
    authConfigured: row.auth_configured ?? Boolean(row.credentials_encrypted),
    lastSuccessfulConnectionAt: row.last_successful_connection_at ?? null,
    reliabilityScore: row.reliability_score ?? 0,
    streamFailureCount: row.stream_failure_count ?? 0,
    reconnectCount: row.reconnect_count ?? 0,
    rateLimitEventCount: row.rate_limit_event_count ?? 0,
    lastDisconnectReason: row.last_disconnect_reason ?? null,
    temporarilyDegraded: row.temporarily_degraded ?? false,
    degradedReason: row.degraded_reason ?? null,
    degradedUntil: row.degraded_until ?? null,
    circuitOpen: row.circuit_open ?? false,
    circuitOpenUntil: row.circuit_open_until ?? null,
    validationFailureCount: row.validation_failure_count ?? 0,
    lastValidationAt: row.last_validation_at ?? null,
    lastValidationSuccessAt: row.last_validation_success_at ?? null,
    lastValidationDurationMs: row.last_validation_duration_ms ?? 0,
    nextValidationAllowedAt: row.next_validation_allowed_at ?? null,
    readinessStatus: (row.readiness_status ?? "not_ready") as RealtimeProviderConnection["readinessStatus"],
    configurationWarnings: parseConfigurationWarnings(row.configuration_warnings),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function sanitizeRealtimeProviderConnectionForApi(
  connection: RealtimeProviderConnection,
): RealtimeProviderConnection {
  return {
    ...connection,
    configJson: sanitizeGrowthProviderConfigForApi(
      connection.configJson as unknown as Record<string, unknown>,
    ) as unknown as RealtimeProviderConfigJson,
  }
}

export async function listRealtimeProviderConnections(
  admin: SupabaseClient,
): Promise<RealtimeProviderConnection[]> {
  const { data, error } = await table(admin).select(SELECT).order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ConnectionRow[]).map(mapRealtimeProviderConnection)
}

export async function fetchRealtimeProviderConnection(
  admin: SupabaseClient,
  connectionId: string,
): Promise<RealtimeProviderConnection | null> {
  const { data, error } = await table(admin).select(SELECT).eq("id", connectionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRealtimeProviderConnection(data as ConnectionRow)
}

export async function createRealtimeProviderConnection(
  admin: SupabaseClient,
  input: {
    provider: RealtimeProviderConnection["provider"]
    label: string
    configJson?: RealtimeProviderConfigJson
    createdBy?: string | null
  },
): Promise<RealtimeProviderConnection> {
  const { data, error } = await table(admin)
    .insert({
      provider: input.provider,
      label: input.label,
      config_json: input.configJson ?? {},
      created_by: input.createdBy ?? null,
    })
    .select(SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRealtimeProviderConnection(data as ConnectionRow)
}

export async function updateRealtimeProviderConnection(
  admin: SupabaseClient,
  connectionId: string,
  patch: Partial<{
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
    readinessStatus: RealtimeProviderConnection["readinessStatus"]
    configurationWarnings: RealtimeProviderConnection["configurationWarnings"]
  }>,
): Promise<RealtimeProviderConnection> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) update.label = patch.label
  if (patch.status !== undefined) update.status = patch.status
  if (patch.configJson !== undefined) update.config_json = patch.configJson
  if (patch.healthStatus !== undefined) update.health_status = patch.healthStatus
  if (patch.lastHealthCheck !== undefined) update.last_health_check = patch.lastHealthCheck
  if (patch.lastError !== undefined) update.last_error = patch.lastError
  if (patch.capabilitySnapshot !== undefined) update.capability_snapshot = patch.capabilitySnapshot
  if (patch.averageLatencyMs !== undefined) update.average_latency_ms = patch.averageLatencyMs
  if (patch.transcriptQualityScore !== undefined) update.transcript_quality_score = patch.transcriptQualityScore
  if (patch.providerFailoverCount !== undefined) update.provider_failover_count = patch.providerFailoverCount
  if (patch.providerDisconnectCount !== undefined) update.provider_disconnect_count = patch.providerDisconnectCount
  if (patch.providerRecoveryAttemptCount !== undefined) {
    update.provider_recovery_attempt_count = patch.providerRecoveryAttemptCount
  }
  if (patch.providerRecoverySuccessCount !== undefined) {
    update.provider_recovery_success_count = patch.providerRecoverySuccessCount
  }
  if (patch.authConfigured !== undefined) update.auth_configured = patch.authConfigured
  if (patch.lastSuccessfulConnectionAt !== undefined) {
    update.last_successful_connection_at = patch.lastSuccessfulConnectionAt
  }
  if (patch.reliabilityScore !== undefined) update.reliability_score = patch.reliabilityScore
  if (patch.streamFailureCount !== undefined) update.stream_failure_count = patch.streamFailureCount
  if (patch.reconnectCount !== undefined) update.reconnect_count = patch.reconnectCount
  if (patch.rateLimitEventCount !== undefined) update.rate_limit_event_count = patch.rateLimitEventCount
  if (patch.lastDisconnectReason !== undefined) update.last_disconnect_reason = patch.lastDisconnectReason
  if (patch.temporarilyDegraded !== undefined) update.temporarily_degraded = patch.temporarilyDegraded
  if (patch.degradedReason !== undefined) update.degraded_reason = patch.degradedReason
  if (patch.degradedUntil !== undefined) update.degraded_until = patch.degradedUntil
  if (patch.circuitOpen !== undefined) update.circuit_open = patch.circuitOpen
  if (patch.circuitOpenUntil !== undefined) update.circuit_open_until = patch.circuitOpenUntil
  if (patch.validationFailureCount !== undefined) update.validation_failure_count = patch.validationFailureCount
  if (patch.lastValidationAt !== undefined) update.last_validation_at = patch.lastValidationAt
  if (patch.lastValidationSuccessAt !== undefined) {
    update.last_validation_success_at = patch.lastValidationSuccessAt
  }
  if (patch.lastValidationDurationMs !== undefined) {
    update.last_validation_duration_ms = patch.lastValidationDurationMs
  }
  if (patch.nextValidationAllowedAt !== undefined) {
    update.next_validation_allowed_at = patch.nextValidationAllowedAt
  }
  if (patch.readinessStatus !== undefined) update.readiness_status = patch.readinessStatus
  if (patch.configurationWarnings !== undefined) {
    update.configuration_warnings = patch.configurationWarnings
  }

  const { data, error } = await table(admin).update(update).eq("id", connectionId).select(SELECT).single()
  if (error) throw new Error(error.message)
  return mapRealtimeProviderConnection(data as ConnectionRow)
}

export async function upsertRealtimeProviderCredentials(
  admin: SupabaseClient,
  connectionId: string,
  credentials: Record<string, unknown>,
): Promise<void> {
  const encrypted = encryptGrowthProviderCredentials(credentials)
  const { error } = await table(admin)
    .update({
      credentials_encrypted: encrypted,
      auth_configured: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) throw new Error(error.message)
}

export function readRealtimeProviderCredentials(
  connection: RealtimeProviderConnection & { credentialsEncrypted?: string | null },
): Record<string, unknown> | null {
  return decryptGrowthProviderCredentials(connection.credentialsEncrypted ?? null)
}

export async function fetchRealtimeProviderConnectionInternal(
  admin: SupabaseClient,
  connectionId: string,
): Promise<(RealtimeProviderConnection & { credentialsEncrypted: string | null }) | null> {
  const { data, error } = await table(admin).select(SELECT).eq("id", connectionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as ConnectionRow
  return { ...mapRealtimeProviderConnection(row), credentialsEncrypted: row.credentials_encrypted }
}

export async function incrementRealtimeProviderMetric(
  admin: SupabaseClient,
  connectionId: string,
  metric: "failover" | "disconnect" | "recovery_attempt" | "recovery_success",
): Promise<void> {
  const connection = await fetchRealtimeProviderConnection(admin, connectionId)
  if (!connection) return
  const patch: Parameters<typeof updateRealtimeProviderConnection>[2] = {}
  switch (metric) {
    case "failover":
      patch.providerFailoverCount = connection.providerFailoverCount + 1
      break
    case "disconnect":
      patch.providerDisconnectCount = connection.providerDisconnectCount + 1
      break
    case "recovery_attempt":
      patch.providerRecoveryAttemptCount = connection.providerRecoveryAttemptCount + 1
      break
    case "recovery_success":
      patch.providerRecoverySuccessCount = connection.providerRecoverySuccessCount + 1
      break
  }
  await updateRealtimeProviderConnection(admin, connectionId, patch)
}
