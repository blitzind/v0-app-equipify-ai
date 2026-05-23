import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthEmailConnectionActiveInPlatformSettings } from "@/lib/growth/communication/settings-repository"
import { parseGrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/capability-snapshot"
import {
  growthProviderHealthReason,
  mapGrowthProviderLegacyStatus,
} from "@/lib/growth/outbound/connection-lifecycle"
import {
  decryptGrowthProviderCredentials,
  encryptGrowthProviderCredentials,
  sanitizeGrowthProviderConfigForApi,
} from "@/lib/growth/outbound/credentials-crypto"
import type {
  GrowthProviderConnectionHealth,
  GrowthProviderConnectionSummary,
  GrowthProviderLifecycleStatus,
} from "@/lib/growth/outbound/provider-types"
import {
  GROWTH_PROVIDER_CREDENTIAL_ROTATION_RECOMMEND_DAYS,
  GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS,
} from "@/lib/growth/outbound/provider-types"
import type { GrowthOutboundProviderFamily } from "@/lib/growth/outbound/types"
import { probeGrowthProviderConnectionSchema } from "@/lib/growth/outbound/provider-schema-health"

export type GrowthProviderConnectionInternal = GrowthProviderConnectionSummary & {
  credentialsEncrypted: string | null
  webhookSecret: string | null
}

type ProviderConnectionRow = {
  id: string
  provider: string
  provider_family: string
  label: string
  status: string
  api_base_url: string | null
  credentials_encrypted: string | null
  webhook_secret: string | null
  config: Record<string, unknown> | null
  last_webhook_at: string | null
  last_error: string | null
  monthly_cost_estimate: number | null
  seat_count: number | null
  notes: string | null
  lifecycle_status: string
  health_reason: string | null
  last_validation_at: string | null
  last_validation_success_at: string | null
  validation_failure_count: number
  last_error_message: string | null
  capability_snapshot: Record<string, unknown> | null
  last_validation_duration_ms: number | null
  average_validation_duration_ms: number | null
  temporarily_degraded: boolean
  degraded_reason: string | null
  degraded_until: string | null
  credential_last_rotated_at: string | null
  credential_rotation_recommended_at: string | null
  next_validation_allowed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: string | null
}

const SELECT_BASE =
  "id, provider, provider_family, label, status, api_base_url, credentials_encrypted, webhook_secret, config, last_webhook_at, last_error, monthly_cost_estimate, seat_count, notes, lifecycle_status, health_reason, last_validation_at, last_validation_success_at, validation_failure_count, last_error_message, capability_snapshot, last_validation_duration_ms, average_validation_duration_ms, temporarily_degraded, degraded_reason, degraded_until, credential_last_rotated_at, credential_rotation_recommended_at, next_validation_allowed_at, created_by, created_at, updated_at"

const SELECT_WITH_SOFT_DELETE = `${SELECT_BASE}, deleted_at, deleted_by`

function connectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_provider_connections")
}

type ConnectionQueryContext = {
  select: string
  softDelete: boolean
}

async function resolveConnectionQueryContext(admin: SupabaseClient): Promise<ConnectionQueryContext> {
  const schema = await probeGrowthProviderConnectionSchema(admin)
  return {
    select: schema.softDelete ? SELECT_WITH_SOFT_DELETE : SELECT_BASE,
    softDelete: schema.softDelete,
  }
}

function scopedConnectionsQuery(admin: SupabaseClient, softDelete: boolean) {
  const query = connectionsTable(admin)
  return softDelete ? query.is("deleted_at", null) : query
}

function mapHealth(row: ProviderConnectionRow): GrowthProviderConnectionHealth {
  return {
    lifecycleStatus: row.lifecycle_status as GrowthProviderLifecycleStatus,
    healthReason: row.health_reason,
    lastValidationAt: row.last_validation_at,
    lastValidationSuccessAt: row.last_validation_success_at,
    validationFailureCount: row.validation_failure_count,
    lastErrorMessage: row.last_error_message ?? row.last_error,
    lastValidationDurationMs: row.last_validation_duration_ms,
    averageValidationDurationMs: row.average_validation_duration_ms,
    temporarilyDegraded: row.temporarily_degraded,
    degradedReason: row.degraded_reason,
    degradedUntil: row.degraded_until,
    credentialLastRotatedAt: row.credential_last_rotated_at,
    credentialRotationRecommendedAt: row.credential_rotation_recommended_at,
    nextValidationAllowedAt: row.next_validation_allowed_at,
    capabilitySnapshot: parseGrowthProviderCapabilitySnapshot(row.capability_snapshot),
  }
}

export function mapGrowthProviderConnectionSummary(
  row: ProviderConnectionRow,
): GrowthProviderConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    providerFamily: row.provider_family as GrowthOutboundProviderFamily,
    label: row.label,
    status: row.status,
    apiBaseUrl: row.api_base_url,
    config: sanitizeGrowthProviderConfigForApi(row.config ?? {}),
    monthlyCostEstimate: row.monthly_cost_estimate != null ? Number(row.monthly_cost_estimate) : null,
    seatCount: row.seat_count,
    notes: row.notes,
    credentialsConfigured: Boolean(row.credentials_encrypted),
    webhookSecretConfigured: Boolean(row.webhook_secret),
    health: mapHealth(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapInternal(row: ProviderConnectionRow): GrowthProviderConnectionInternal {
  return {
    ...mapGrowthProviderConnectionSummary(row),
    credentialsEncrypted: row.credentials_encrypted,
    webhookSecret: row.webhook_secret,
  }
}

export async function fetchGrowthProviderConnectionInternal(
  admin: SupabaseClient,
  connectionId: string,
): Promise<GrowthProviderConnectionInternal | null> {
  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .select(ctx.select)
    .eq("id", connectionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapInternal(data as ProviderConnectionRow) : null
}

export async function listGrowthProviderConnectionSummaries(
  admin: SupabaseClient,
): Promise<GrowthProviderConnectionSummary[]> {
  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .select(ctx.select)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ProviderConnectionRow[]).map(mapGrowthProviderConnectionSummary)
}

export async function createGrowthProviderConnection(
  admin: SupabaseClient,
  input: {
    provider: string
    providerFamily: GrowthOutboundProviderFamily
    label: string
    apiBaseUrl?: string | null
    config?: Record<string, unknown>
    monthlyCostEstimate?: number | null
    seatCount?: number | null
    notes?: string | null
    createdBy?: string | null
  },
): Promise<GrowthProviderConnectionSummary> {
  const now = new Date().toISOString()
  const rotationRecommended = new Date(
    Date.now() + GROWTH_PROVIDER_CREDENTIAL_ROTATION_RECOMMEND_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await connectionsTable(admin)
    .insert({
      provider: input.provider,
      provider_family: input.providerFamily,
      label: input.label.trim(),
      status: "error",
      api_base_url: input.apiBaseUrl?.trim() || null,
      config: input.config ?? {},
      monthly_cost_estimate: input.monthlyCostEstimate ?? null,
      seat_count: input.seatCount ?? null,
      notes: input.notes?.trim() || null,
      lifecycle_status: "configuring",
      health_reason: "Awaiting validation",
      credential_rotation_recommended_at: rotationRecommended,
      created_by: input.createdBy ?? null,
      updated_at: now,
    })
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export async function updateGrowthProviderConnectionDetails(
  admin: SupabaseClient,
  connectionId: string,
  input: {
    label?: string
    apiBaseUrl?: string | null
    config?: Record<string, unknown>
    monthlyCostEstimate?: number | null
    seatCount?: number | null
    notes?: string | null
    webhookSecret?: string | null
  },
): Promise<GrowthProviderConnectionSummary> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.label !== undefined) patch.label = input.label.trim()
  if (input.apiBaseUrl !== undefined) patch.api_base_url = input.apiBaseUrl?.trim() || null
  if (input.config !== undefined) patch.config = input.config
  if (input.monthlyCostEstimate !== undefined) patch.monthly_cost_estimate = input.monthlyCostEstimate
  if (input.seatCount !== undefined) patch.seat_count = input.seatCount
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.webhookSecret !== undefined) patch.webhook_secret = input.webhookSecret?.trim() || null

  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .update(patch)
    .eq("id", connectionId)
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export async function updateGrowthProviderConnectionCredentials(
  admin: SupabaseClient,
  connectionId: string,
  credentials: Record<string, unknown>,
): Promise<GrowthProviderConnectionSummary> {
  const now = new Date().toISOString()
  const rotationRecommended = new Date(
    Date.now() + GROWTH_PROVIDER_CREDENTIAL_ROTATION_RECOMMEND_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .update({
      credentials_encrypted: encryptGrowthProviderCredentials(credentials),
      credential_last_rotated_at: now,
      credential_rotation_recommended_at: rotationRecommended,
      lifecycle_status: "configuring",
      health_reason: "Awaiting validation",
      updated_at: now,
    })
    .eq("id", connectionId)
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export async function applyGrowthProviderValidationPatch(
  admin: SupabaseClient,
  connectionId: string,
  input: {
    lifecycleStatus: GrowthProviderLifecycleStatus
    healthy: boolean
    warnings: { code: string; message: string }[]
    capabilitySnapshot: Record<string, unknown>
    durationMs: number
    averageDurationMs: number
    temporarilyDegraded: boolean
    degradedReason: string | null
    degradedUntil: string | null
    lastErrorMessage: string | null
    validationFailureCount: number
    seatCount?: number | null
  },
): Promise<GrowthProviderConnectionSummary> {
  const now = new Date().toISOString()
  const nextAllowed = new Date(Date.now() + GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS).toISOString()
  const legacyStatus = mapGrowthProviderLegacyStatus(input.lifecycleStatus)
  const healthReason = growthProviderHealthReason({
    lifecycleStatus: input.lifecycleStatus,
    healthy: input.healthy,
    warnings: input.warnings,
    lastErrorMessage: input.lastErrorMessage,
  })

  const patch: Record<string, unknown> = {
    lifecycle_status: input.lifecycleStatus,
    status: legacyStatus,
    health_reason: healthReason,
    last_validation_at: now,
    validation_failure_count: input.validationFailureCount,
    last_error_message: input.lastErrorMessage,
    last_error: input.lastErrorMessage,
    capability_snapshot: input.capabilitySnapshot,
    last_validation_duration_ms: input.durationMs,
    average_validation_duration_ms: input.averageDurationMs,
    temporarily_degraded: input.temporarilyDegraded,
    degraded_reason: input.degradedReason,
    degraded_until: input.degradedUntil,
    next_validation_allowed_at: nextAllowed,
    updated_at: now,
  }

  if (input.healthy) {
    patch.last_validation_success_at = now
  }

  if (input.seatCount != null) {
    patch.seat_count = input.seatCount
  }

  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .update(patch)
    .eq("id", connectionId)
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export async function disableGrowthProviderConnection(
  admin: SupabaseClient,
  connectionId: string,
): Promise<GrowthProviderConnectionSummary> {
  const now = new Date().toISOString()
  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .update({
      lifecycle_status: "disabled",
      status: "disabled",
      health_reason: "Provider connection disabled",
      temporarily_degraded: false,
      degraded_reason: null,
      degraded_until: null,
      updated_at: now,
    })
    .eq("id", connectionId)
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export async function reconnectGrowthProviderConnection(
  admin: SupabaseClient,
  connectionId: string,
): Promise<GrowthProviderConnectionSummary> {
  const now = new Date().toISOString()
  const ctx = await resolveConnectionQueryContext(admin)
  const { data, error } = await scopedConnectionsQuery(admin, ctx.softDelete)
    .update({
      lifecycle_status: "configuring",
      status: "error",
      health_reason: "Awaiting validation",
      temporarily_degraded: false,
      degraded_reason: null,
      degraded_until: null,
      updated_at: now,
    })
    .eq("id", connectionId)
    .select(ctx.select)
    .single()

  if (error) throw new Error(error.message)
  return mapGrowthProviderConnectionSummary(data as ProviderConnectionRow)
}

export class GrowthProviderConnectionDeleteBlockedError extends Error {
  readonly code = "active_email_provider" as const

  constructor() {
    super("active_email_provider")
  }
}

export async function softDeleteGrowthProviderConnection(
  admin: SupabaseClient,
  input: {
    connectionId: string
    deletedBy: string
  },
): Promise<{ id: string; deletedAt: string }> {
  const existing = await fetchGrowthProviderConnectionInternal(admin, input.connectionId)
  if (!existing) throw new Error("connection_not_found")

  if (await isGrowthEmailConnectionActiveInPlatformSettings(admin, input.connectionId)) {
    throw new GrowthProviderConnectionDeleteBlockedError()
  }

  const ctx = await resolveConnectionQueryContext(admin)
  if (!ctx.softDelete) {
    throw new Error("growth_schema_incomplete_soft_delete")
  }

  const deletedAt = new Date().toISOString()
  const { data, error } = await scopedConnectionsQuery(admin, true)
    .update({
      deleted_at: deletedAt,
      deleted_by: input.deletedBy,
      updated_at: deletedAt,
    })
    .eq("id", input.connectionId)
    .select("id, deleted_at")
    .single()

  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id, deletedAt: (data as { deleted_at: string }).deleted_at }
}

export function readGrowthProviderConnectionCredentials(
  connection: GrowthProviderConnectionInternal,
): Record<string, unknown> | null {
  return decryptGrowthProviderCredentials(connection.credentialsEncrypted)
}

export function isGrowthProviderValidationCooldownActive(connection: GrowthProviderConnectionSummary): boolean {
  const next = connection.health.nextValidationAllowedAt
  if (!next) return false
  return Date.parse(next) > Date.now()
}

export function growthProviderValidationCooldownRemainingMs(
  connection: GrowthProviderConnectionSummary,
): number {
  const next = connection.health.nextValidationAllowedAt
  if (!next) return 0
  return Math.max(0, Date.parse(next) - Date.now())
}
