import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getTransportAdapter } from "@/lib/growth/providers/adapters/adapter-registry"
import type {
  GrowthDeliveryAttempt,
  GrowthProviderRateLimitRow,
  ProviderAdapterCredentials,
} from "@/lib/growth/providers/adapters/provider-adapter-types"
import { decryptGrowthProviderCredentials } from "@/lib/growth/outbound/credentials-crypto"
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import { refreshMicrosoftMailboxTokensLive } from "@/lib/growth/mailboxes/microsoft-mailbox-live-validation"
import { microsoftProviderOAuthConfigured } from "@/lib/growth/provider-setup/microsoft-oauth"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { getDeliveryProvider, listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import type { DeliveryRouteCandidate } from "@/lib/growth/providers/provider-router"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  defaultRateLimitsForProvider,
  incrementRateLimitCounters,
} from "@/lib/growth/providers/transport/transport-rate-limit"
import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function attemptsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_attempts")
}

function rateLimitsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_rate_limits")
}

function mapAttempt(row: Row): GrowthDeliveryAttempt {
  return {
    id: asString(row.id),
    provider_id: asString(row.provider_id) || null,
    sender_account_id: asString(row.sender_account_id) || null,
    provider_connection_id: asString(row.provider_connection_id) || null,
    outreach_queue_id: asString(row.outreach_queue_id) || null,
    failure_class: asString(row.failure_class) || null,
    latency_ms: row.latency_ms == null ? null : asNumber(row.latency_ms),
    send_plane: (asString(row.send_plane) || "transport") as GrowthDeliveryAttempt["send_plane"],
    lead_id: asString(row.lead_id) || null,
    sequence_enrollment_id: asString(row.sequence_enrollment_id) || null,
    channel: "email",
    status: asString(row.status) as GrowthDeliveryAttempt["status"],
    queued_at: asString(row.queued_at),
    sent_at: asString(row.sent_at) || null,
    failed_at: asString(row.failed_at) || null,
    provider_message_id: asString(row.provider_message_id) || null,
    failure_reason: asString(row.failure_reason) || null,
    retry_count: asNumber(row.retry_count, 0),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
  }
}

function mapRateLimit(row: Row): GrowthProviderRateLimitRow {
  return {
    id: asString(row.id),
    provider_id: asString(row.provider_id),
    minute_cap: asNumber(row.minute_cap, 0),
    hour_cap: asNumber(row.hour_cap, 0),
    day_cap: asNumber(row.day_cap, 0),
    current_minute: asNumber(row.current_minute, 0),
    current_hour: asNumber(row.current_hour, 0),
    current_day: asNumber(row.current_day, 0),
    window_started_at: asString(row.window_started_at),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

export async function listDeliveryAttempts(
  admin: SupabaseClient,
  input?: { limit?: number; status?: string; provider_id?: string },
): Promise<GrowthDeliveryAttempt[]> {
  let query = attemptsTable(admin).select("*").order("queued_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.status) query = query.eq("status", input.status)
  if (input?.provider_id) query = query.eq("provider_id", input.provider_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAttempt(row as Row))
}

export async function getDeliveryAttempt(admin: SupabaseClient, attemptId: string): Promise<GrowthDeliveryAttempt | null> {
  const { data, error } = await attemptsTable(admin).select("*").eq("id", attemptId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapAttempt(data as Row)
}

export async function createDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    provider_id?: string | null
    sender_account_id?: string | null
    lead_id?: string | null
    sequence_enrollment_id?: string | null
    sequence_enrollment_step_id?: string | null
    sequence_execution_job_id?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthDeliveryAttempt> {
  const now = new Date().toISOString()
  const sendPlane = input.metadata?.send_plane === "adapter" ? "adapter" : "transport"
  const row: Record<string, unknown> = {
    lead_id: input.lead_id ?? null,
    sequence_enrollment_id: input.sequence_enrollment_id ?? null,
    sequence_enrollment_step_id: input.sequence_enrollment_step_id ?? null,
    sequence_execution_job_id: input.sequence_execution_job_id ?? null,
    channel: "email",
    status: "queued",
    queued_at: now,
    metadata: input.metadata ?? {},
    created_at: now,
    send_plane: sendPlane,
  }
  if (input.provider_id) row.provider_id = input.provider_id
  if (input.sender_account_id) row.sender_account_id = input.sender_account_id
  if (input.metadata?.provider_connection_id) {
    row.provider_connection_id = input.metadata.provider_connection_id
  }
  if (input.metadata?.outreach_queue_id) {
    row.outreach_queue_id = input.metadata.outreach_queue_id
  }

  const { data, error } = await attemptsTable(admin).insert(row).select("*").single()

  if (error) throw new Error(error.message)
  return mapAttempt(data as Row)
}

export async function updateDeliveryAttempt(
  admin: SupabaseClient,
  attemptId: string,
  updates: Partial<{
    status: GrowthDeliveryAttempt["status"]
    sent_at: string | null
    failed_at: string | null
    provider_message_id: string | null
    failure_reason: string | null
    retry_count: number
    metadata: Record<string, unknown>
  }>,
): Promise<GrowthDeliveryAttempt> {
  const { data, error } = await attemptsTable(admin).update(updates).eq("id", attemptId).select("*").single()
  if (error) throw new Error(error.message)
  const mapped = mapAttempt(data as Row)
  if (updates.status === "sent") {
    const { recordSendAttributionTouchForDeliveryAttempt } = await import(
      "@/lib/growth/revenue-attribution/delivery-attempt-touch-hook"
    )
    await recordSendAttributionTouchForDeliveryAttempt(admin, attemptId).catch(() => undefined)
  }
  return mapped
}

export async function listProviderRateLimits(admin: SupabaseClient): Promise<GrowthProviderRateLimitRow[]> {
  const { data, error } = await rateLimitsTable(admin).select("*").order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRateLimit(row as Row))
}

export async function getProviderRateLimit(
  admin: SupabaseClient,
  providerId: string,
): Promise<GrowthProviderRateLimitRow | null> {
  const { data, error } = await rateLimitsTable(admin).select("*").eq("provider_id", providerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRateLimit(data as Row)
}

export async function ensureProviderRateLimit(
  admin: SupabaseClient,
  providerId: string,
): Promise<GrowthProviderRateLimitRow> {
  const existing = await getProviderRateLimit(admin, providerId)
  if (existing) return existing

  const provider = await getDeliveryProvider(admin, providerId)
  const defaults = defaultRateLimitsForProvider(provider?.max_daily_volume ?? 500)
  const now = new Date().toISOString()

  const { data, error } = await rateLimitsTable(admin)
    .insert({
      provider_id: providerId,
      ...defaults,
      current_minute: 0,
      current_hour: 0,
      current_day: 0,
      window_started_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRateLimit(data as Row)
}

export async function incrementProviderRateLimit(
  admin: SupabaseClient,
  providerId: string,
  volume = 1,
): Promise<GrowthProviderRateLimitRow> {
  const row = await ensureProviderRateLimit(admin, providerId)
  const next = incrementRateLimitCounters(row, volume)
  const { data, error } = await rateLimitsTable(admin)
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq("provider_id", providerId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRateLimit(data as Row)
}

export async function loadRouteCandidatesForSender(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<DeliveryRouteCandidate[]> {
  const routes = await listDeliveryRoutes(admin)
  return routes
    .filter((route) => route.sender_account_id === senderAccountId)
    .map((route) => ({
      route_id: route.id,
      provider_id: route.provider_id,
      provider_name: route.provider_name,
      provider_family: route.provider_family,
      provider_status: "connected" as const,
      provider_health_score: route.health_weight,
      supports_send: true,
      priority: route.priority,
      enabled: route.enabled,
      daily_cap: route.daily_cap,
      current_volume: route.current_volume,
      health_weight: route.health_weight,
      fallback_route_id: route.fallback_route_id,
    }))
}

async function loadMailboxTokensForSender(
  admin: SupabaseClient,
  senderAccountId: string,
  providerFamily?: GrowthDeliveryProviderFamily,
): Promise<{ access_token: string | null; refresh_token: string | null; email_address: string | null }> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id, provider_family, encrypted_access_token, encrypted_refresh_token, email_address, token_expires_at",
    )
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { access_token: null, refresh_token: null, email_address: null }

  const row = data as Row
  const family = (providerFamily ?? asString(row.provider_family)) as GrowthDeliveryProviderFamily
  let accessToken = decryptMailboxToken(asString(row.encrypted_access_token) || null)
  const refreshToken = decryptMailboxToken(asString(row.encrypted_refresh_token) || null)
  const emailAddress = asString(row.email_address) || null

  const encryptedRefresh = asString(row.encrypted_refresh_token) || null
  const expiresAtMs = Date.parse(asString(row.token_expires_at))
  const accessExpired =
    !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000 || !accessToken

  if (accessExpired && encryptedRefresh) {
    const refreshLive =
      family === "google" && googleProviderOAuthConfigured()
        ? await refreshGoogleMailboxTokensLive(encryptedRefresh)
        : family === "microsoft" && microsoftProviderOAuthConfigured()
          ? await refreshMicrosoftMailboxTokensLive(encryptedRefresh)
          : null

    if (refreshLive?.ok) {
      accessToken = refreshLive.accessToken
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        encrypted_access_token: encryptMailboxToken(refreshLive.accessToken),
        token_expires_at: refreshLive.expiresAt,
        last_refresh_attempt: now,
        last_successful_refresh: now,
        updated_at: now,
      }
      if (refreshLive.refreshToken) {
        patch.encrypted_refresh_token = encryptMailboxToken(refreshLive.refreshToken)
      }
      await admin.schema("growth").from("mailbox_connections").update(patch).eq("id", asString(row.id))
    } else if (!refreshLive?.ok && accessToken) {
      accessToken = null
    }
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    email_address: emailAddress,
  }
}

export async function resolveProviderAdapterCredentials(
  admin: SupabaseClient,
  input: { provider_id: string; sender_account_id: string },
): Promise<ProviderAdapterCredentials | null> {
  const provider = await getDeliveryProvider(admin, input.provider_id)
  if (!provider) return null

  const family = provider.provider_family as GrowthDeliveryProviderFamily
  const sender = await getSenderAccount(admin, input.sender_account_id)
  const metadata = provider.metadata ?? {}
  const encryptedCredentials = asString(metadata.encrypted_credentials) || null
  const decrypted = decryptGrowthProviderCredentials(encryptedCredentials) ?? {}
  const mailbox = await loadMailboxTokensForSender(admin, input.sender_account_id, family)

  return {
    provider_family: family,
    access_token: mailbox.access_token ?? (asString(decrypted.accessToken) || null),
    refresh_token: mailbox.refresh_token ?? (asString(decrypted.refreshToken) || null),
    api_key: asString(decrypted.apiKey) || asString(decrypted.api_key) || null,
    smtp_host: asString(decrypted.smtpHost) || asString(decrypted.smtp_host) || null,
    smtp_port: asNumber(decrypted.smtpPort ?? decrypted.smtp_port, 587),
    smtp_user: asString(decrypted.smtpUser) || asString(decrypted.smtp_user) || null,
    smtp_password: asString(decrypted.smtpPassword) || asString(decrypted.smtp_password) || null,
    smtp_secure: Boolean(decrypted.smtpSecure ?? decrypted.smtp_secure),
    aws_access_key_id: asString(decrypted.awsAccessKeyId) || asString(decrypted.aws_access_key_id) || null,
    aws_secret_access_key: asString(decrypted.awsSecretAccessKey) || asString(decrypted.aws_secret_access_key) || null,
    aws_region: asString(decrypted.awsRegion) || asString(decrypted.aws_region) || null,
    from_address: sender?.email_address ?? mailbox.email_address ?? (asString(decrypted.fromAddress) || null),
  }
}

export function validateAdapterForFamily(
  family: GrowthDeliveryProviderFamily,
  credentials: ProviderAdapterCredentials,
) {
  const adapter = getTransportAdapter(family)
  if (!adapter) return { ok: false, summary: `No transport adapter for ${family}.` }
  const validation = adapter.validate(credentials)
  return { ok: validation.ok, summary: validation.summary, adapter }
}
