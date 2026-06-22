import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  appendMailboxTimelineEvent,
  createMailboxConnectionEvent,
} from "@/lib/growth/mailboxes/mailbox-events"
import {
  buildMailboxHealthReason,
  computeMailboxConnectionHealth,
  isMailboxTokenExpired,
  mailboxHealthToTier,
} from "@/lib/growth/mailboxes/mailbox-health"
import {
  encryptMailboxToken,
  refreshProviderToken,
  sanitizeMailboxMetadataForApi,
} from "@/lib/growth/mailboxes/mailbox-token-manager"
import { getMailboxProviderCapabilities } from "@/lib/growth/mailboxes/mailbox-provider-registry"
import { validateMailboxConnectionStub } from "@/lib/growth/mailboxes/mailbox-validation"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { validateGoogleMailboxConnectionLive, refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import {
  refreshMicrosoftMailboxTokensLive,
  validateMicrosoftMailboxConnectionLive,
} from "@/lib/growth/mailboxes/microsoft-mailbox-live-validation"
import { microsoftProviderOAuthConfigured } from "@/lib/growth/provider-setup/microsoft-oauth"
import type {
  GrowthMailboxConnectionSummary,
  GrowthMailboxHealthDashboard,
} from "@/lib/growth/mailboxes/mailbox-types"
import { GROWTH_MAILBOX_CONNECTION_QA_MARKER } from "@/lib/growth/mailboxes/mailbox-types"
import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"

type MailboxRow = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function connectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("mailbox_connections")
}

function activeConnectionsQuery(admin: SupabaseClient) {
  return connectionsTable(admin).select("*").is("deleted_at", null)
}

function mapSummary(row: MailboxRow): GrowthMailboxConnectionSummary {
  const connection_health = asNumber(row.connection_health, 100)
  return {
    id: asString(row.id),
    sender_account_id: asString(row.sender_account_id),
    provider_family: asString(row.provider_family) as GrowthSenderProviderFamily,
    status: asString(row.status) as GrowthMailboxConnectionSummary["status"],
    email_address: asString(row.email_address),
    display_name: asString(row.display_name),
    token_expires_at: asString(row.token_expires_at) || null,
    token_configured: Boolean(row.encrypted_access_token || row.encrypted_refresh_token),
    last_refresh_attempt: asString(row.last_refresh_attempt) || null,
    last_successful_refresh: asString(row.last_successful_refresh) || null,
    last_validation_at: asString(row.last_validation_at) || null,
    validation_failure_count: asNumber(row.validation_failure_count, 0),
    provider_account_id: asString(row.provider_account_id) || null,
    provider_metadata: sanitizeMailboxMetadataForApi(
      row.provider_metadata && typeof row.provider_metadata === "object"
        ? (row.provider_metadata as Record<string, unknown>)
        : {},
    ),
    connection_health,
    health_tier: mailboxHealthToTier(connection_health),
    health_reason: asString(row.health_reason) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function recomputeMailboxHealth(
  admin: SupabaseClient,
  row: MailboxRow,
): Promise<GrowthMailboxConnectionSummary> {
  const status = asString(row.status) as GrowthMailboxConnectionSummary["status"]
  let nextStatus = status
  const tokenExpiresAt = asString(row.token_expires_at) || null
  const tokenExpired = isMailboxTokenExpired(tokenExpiresAt)

  if (tokenExpired && status !== "disabled") {
    nextStatus = "expired"
  } else if (status === "expired" && !tokenExpired) {
    nextStatus = "connected"
  }

  const score = computeMailboxConnectionHealth({
    status: nextStatus,
    token_expires_at: tokenExpiresAt,
    validation_failure_count: asNumber(row.validation_failure_count, 0),
  })
  const health_reason = buildMailboxHealthReason({
    status: nextStatus,
    token_expires_at: tokenExpiresAt,
    validation_failure_count: asNumber(row.validation_failure_count, 0),
    score,
  })

  const previousScore = asNumber(row.connection_health, 100)
  const now = new Date().toISOString()

  const { data, error } = await connectionsTable(admin)
    .update({
      status: nextStatus,
      connection_health: score,
      health_reason,
      updated_at: now,
    })
    .is("deleted_at", null)
    .eq("id", asString(row.id))
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const updated = mapSummary(data as MailboxRow)

  if (nextStatus === "expired" && status !== "expired") {
    await appendMailboxTimelineEvent(admin, {
      eventType: "mailbox_token_expired",
      title: `Mailbox token expired: ${updated.email_address}`,
      summary: health_reason,
      mailboxConnectionId: updated.id,
    })
    await createMailboxConnectionEvent(admin, {
      mailbox_connection_id: updated.id,
      event_type: "token_expired",
      severity: "high",
      title: "Token expiry detected",
      description: health_reason ?? "Mailbox token expired.",
    })
  }

  if (score < previousScore && score < 70) {
    await appendMailboxTimelineEvent(admin, {
      eventType: "mailbox_health_declined",
      title: `Mailbox health declined: ${updated.email_address}`,
      summary: health_reason,
      mailboxConnectionId: updated.id,
      payload: { previous_health: previousScore, connection_health: score },
    })
  }

  return updated
}

export async function listMailboxConnections(admin: SupabaseClient): Promise<GrowthMailboxConnectionSummary[]> {
  const { data, error } = await activeConnectionsQuery(admin)
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSummary(row as MailboxRow))
}

export async function getMailboxConnectionBySender(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthMailboxConnectionSummary | null> {
  const { data, error } = await activeConnectionsQuery(admin)
    .select("*")
    .eq("sender_account_id", senderAccountId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return recomputeMailboxHealth(admin, data as MailboxRow)
}

export async function getMailboxConnection(
  admin: SupabaseClient,
  mailboxId: string,
): Promise<GrowthMailboxConnectionSummary | null> {
  const { data, error } = await activeConnectionsQuery(admin).select("*").eq("id", mailboxId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSummary(data as MailboxRow)
}

export async function createMailboxConnection(
  admin: SupabaseClient,
  input: {
    sender_account_id: string
    provider_family: GrowthSenderProviderFamily
    email_address: string
    display_name: string
    access_token?: string | null
    refresh_token?: string | null
    token_expires_at?: string | null
    provider_account_id?: string | null
    provider_metadata?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthMailboxConnectionSummary> {
  const sender = await getSenderAccount(admin, input.sender_account_id)
  if (!sender) throw new Error("sender_not_found")

  const capabilities = getMailboxProviderCapabilities(input.provider_family)
  const encrypted_access_token = encryptMailboxToken(input.access_token)
  const encrypted_refresh_token = encryptMailboxToken(input.refresh_token)
  const status = capabilities.oauth && !encrypted_access_token ? "pending" : "connecting"

  const score = computeMailboxConnectionHealth({
    status,
    token_expires_at: input.token_expires_at ?? null,
    validation_failure_count: 0,
  })

  const now = new Date().toISOString()
  const { data, error } = await connectionsTable(admin)
    .insert({
      sender_account_id: input.sender_account_id,
      provider_family: input.provider_family,
      status,
      email_address: input.email_address.trim().toLowerCase(),
      display_name: input.display_name.trim(),
      encrypted_access_token,
      encrypted_refresh_token,
      token_expires_at: input.token_expires_at ?? null,
      provider_account_id: input.provider_account_id ?? null,
      provider_metadata: sanitizeMailboxMetadataForApi(input.provider_metadata ?? {}),
      connection_health: score,
      health_reason: buildMailboxHealthReason({ status, score, token_expires_at: input.token_expires_at ?? null }),
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const summary = mapSummary(data as MailboxRow)

  await appendMailboxTimelineEvent(admin, {
    eventType: "mailbox_connected",
    title: `Mailbox registered: ${summary.email_address}`,
    summary: `${capabilities.label} mailbox connection created (infrastructure only).`,
    mailboxConnectionId: summary.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    payload: { provider_family: summary.provider_family, status: summary.status },
  })

  return recomputeMailboxHealth(admin, data as MailboxRow)
}

export async function updateMailboxConnection(
  admin: SupabaseClient,
  mailboxId: string,
  input: Partial<{
    display_name: string
    status: GrowthMailboxConnectionSummary["status"]
    access_token: string | null
    refresh_token: string | null
    token_expires_at: string | null
    provider_metadata: Record<string, unknown>
    validation_failure_count: number
  }> & {
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthMailboxConnectionSummary> {
  const existing = await getMailboxConnection(admin, mailboxId)
  if (!existing) throw new Error("mailbox_not_found")

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.display_name != null) patch.display_name = input.display_name.trim()
  if (input.status != null) patch.status = input.status
  if (input.token_expires_at !== undefined) patch.token_expires_at = input.token_expires_at
  if (input.provider_metadata != null) {
    patch.provider_metadata = sanitizeMailboxMetadataForApi(input.provider_metadata)
  }
  if (input.access_token !== undefined) patch.encrypted_access_token = encryptMailboxToken(input.access_token)
  if (input.refresh_token !== undefined) patch.encrypted_refresh_token = encryptMailboxToken(input.refresh_token)
  if (input.validation_failure_count !== undefined) patch.validation_failure_count = input.validation_failure_count

  const { data, error } = await connectionsTable(admin)
    .update(patch)
    .is("deleted_at", null)
    .eq("id", mailboxId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  if (input.status === "disabled" && existing.status !== "disabled") {
    await appendMailboxTimelineEvent(admin, {
      eventType: "mailbox_disconnected",
      title: `Mailbox disabled: ${existing.email_address}`,
      summary: "Mailbox connection disabled — no outbound sending.",
      mailboxConnectionId: mailboxId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  return recomputeMailboxHealth(admin, data as MailboxRow)
}

export async function softDeleteMailboxConnection(
  admin: SupabaseClient,
  input: { mailboxId: string; actorUserId?: string | null; actorEmail?: string | null },
): Promise<{ id: string; deleted_at: string }> {
  const existing = await getMailboxConnection(admin, input.mailboxId)
  if (!existing) throw new Error("mailbox_not_found")

  const deletedAt = new Date().toISOString()
  const { data, error } = await connectionsTable(admin)
    .update({ deleted_at: deletedAt, status: "disabled", updated_at: deletedAt })
    .is("deleted_at", null)
    .eq("id", input.mailboxId)
    .select("id, deleted_at")
    .single()

  if (error) throw new Error(error.message)

  await appendMailboxTimelineEvent(admin, {
    eventType: "mailbox_disconnected",
    title: `Mailbox removed: ${existing.email_address}`,
    summary: "Mailbox connection soft-deleted from infrastructure registry.",
    mailboxConnectionId: existing.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    payload: { soft_deleted: true },
  })

  return { id: asString((data as MailboxRow).id), deleted_at: deletedAt }
}

export async function validateMailboxConnection(
  admin: SupabaseClient,
  mailboxId: string,
  input?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthMailboxConnectionSummary> {
  const { data, error } = await activeConnectionsQuery(admin).select("*").eq("id", mailboxId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("mailbox_not_found")

  const row = data as MailboxRow
  const providerFamily = asString(row.provider_family) as GrowthSenderProviderFamily
  const validationInput = {
    provider_family: providerFamily,
    email_address: asString(row.email_address),
    status: asString(row.status) as GrowthMailboxConnectionSummary["status"],
    token_configured: Boolean(row.encrypted_access_token || row.encrypted_refresh_token),
    token_expires_at: asString(row.token_expires_at) || null,
    validation_failure_count: asNumber(row.validation_failure_count, 0),
  }

  let validation =
    providerFamily === "google" && googleProviderOAuthConfigured()
      ? await validateGoogleMailboxConnectionLive({
          email_address: validationInput.email_address,
          encrypted_refresh_token: asString(row.encrypted_refresh_token) || null,
          encrypted_access_token: asString(row.encrypted_access_token) || null,
          token_expires_at: validationInput.token_expires_at,
          status: validationInput.status,
          validation_failure_count: validationInput.validation_failure_count,
        })
      : providerFamily === "microsoft" && microsoftProviderOAuthConfigured()
        ? await validateMicrosoftMailboxConnectionLive({
            email_address: validationInput.email_address,
            encrypted_refresh_token: asString(row.encrypted_refresh_token) || null,
            encrypted_access_token: asString(row.encrypted_access_token) || null,
            token_expires_at: validationInput.token_expires_at,
            status: validationInput.status,
            validation_failure_count: validationInput.validation_failure_count,
          })
        : validateMailboxConnectionStub(validationInput)

  let refreshResult = refreshProviderToken({
    provider_family: providerFamily,
    encrypted_refresh_token: asString(row.encrypted_refresh_token) || null,
  })

  let tokenExpiresAt = asString(row.token_expires_at) || null
  let encryptedAccessToken = asString(row.encrypted_access_token) || null

  if (
    validation.valid &&
    ((providerFamily === "google" && googleProviderOAuthConfigured()) ||
      (providerFamily === "microsoft" && microsoftProviderOAuthConfigured()))
  ) {
    const liveRefresh =
      providerFamily === "google"
        ? await refreshGoogleMailboxTokensLive(asString(row.encrypted_refresh_token) || null)
        : await refreshMicrosoftMailboxTokensLive(asString(row.encrypted_refresh_token) || null)
    if (liveRefresh.ok) {
      refreshResult = "supported"
      encryptedAccessToken = encryptMailboxToken(liveRefresh.accessToken)
      tokenExpiresAt = liveRefresh.expiresAt
    } else {
      refreshResult = "failed"
      validation = {
        valid: false,
        status: "error",
        message: liveRefresh.message,
        checked_at: new Date().toISOString(),
      }
    }
  }

  const now = new Date().toISOString()
  const failureCount = validation.valid
    ? 0
    : asNumber(row.validation_failure_count, 0) + 1

  const { data: updated, error: updateError } = await connectionsTable(admin)
    .update({
      status: validation.status,
      last_validation_at: validation.checked_at,
      validation_failure_count: failureCount,
      encrypted_access_token: encryptedAccessToken,
      token_expires_at: tokenExpiresAt,
      last_refresh_attempt: refreshResult !== "unsupported" ? now : asString(row.last_refresh_attempt) || null,
      last_successful_refresh: refreshResult === "supported" ? now : asString(row.last_successful_refresh) || null,
      updated_at: now,
    })
    .is("deleted_at", null)
    .eq("id", mailboxId)
    .select("*")
    .single()

  if (updateError) throw new Error(updateError.message)

  if (!validation.valid) {
    await appendMailboxTimelineEvent(admin, {
      eventType: "mailbox_validation_failed",
      title: `Mailbox validation failed: ${asString(row.email_address)}`,
      summary: validation.message,
      mailboxConnectionId: mailboxId,
      actorUserId: input?.actorUserId,
      actorEmail: input?.actorEmail,
    })
    await createMailboxConnectionEvent(admin, {
      mailbox_connection_id: mailboxId,
      event_type: "validation_failed",
      severity: failureCount > 3 ? "critical" : "high",
      title: "Mailbox validation failed",
      description: validation.message,
      metadata: { validation_failure_count: failureCount },
    })
  }

  const summary = await recomputeMailboxHealth(admin, updated as MailboxRow)
  return { ...summary, validation_message: validation.message }
}

export async function fetchMailboxHealthDashboard(admin: SupabaseClient): Promise<GrowthMailboxHealthDashboard> {
  const mailboxes = await listMailboxConnections(admin)
  const connected_count = mailboxes.filter((m) => m.status === "connected").length
  const warning_count = mailboxes.filter(
    (m) => m.status === "warning" || m.health_tier === "warning" || m.health_tier === "degraded",
  ).length
  const expired_count = mailboxes.filter((m) => m.status === "expired").length
  const failed_validation_count = mailboxes.filter((m) => m.validation_failure_count > 3).length
  const average_connection_health =
    mailboxes.length > 0
      ? Math.round(mailboxes.reduce((sum, m) => sum + m.connection_health, 0) / mailboxes.length)
      : 0

  return {
    qa_marker: GROWTH_MAILBOX_CONNECTION_QA_MARKER,
    connected_count,
    warning_count,
    expired_count,
    failed_validation_count,
    average_connection_health,
  }
}
