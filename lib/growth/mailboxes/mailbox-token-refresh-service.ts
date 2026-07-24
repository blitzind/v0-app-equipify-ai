/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Canonical mailbox OAuth refresh (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { microsoftProviderOAuthConfigured } from "@/lib/growth/provider-setup/microsoft-oauth"
import {
  classifyOAuthRefreshFailure,
  clearMailboxOAuthFailureMetadata,
  parseGoogleOAuthErrorFromMessage,
  writeMailboxAccessTokenRefreshRequired,
  writeMailboxOAuthFailureMetadata,
} from "@/lib/growth/mailboxes/mailbox-oauth-diagnostics"
import { refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import { refreshMicrosoftMailboxTokensLive } from "@/lib/growth/mailboxes/microsoft-mailbox-live-validation"
import { isMailboxTokenExpired } from "@/lib/growth/mailboxes/mailbox-health"
import {
  decryptMailboxToken,
  encryptMailboxToken,
  sanitizeMailboxMetadataForApi,
} from "@/lib/growth/mailboxes/mailbox-token-manager"
import { readMailboxOAuthMetadata } from "@/lib/growth/mailboxes/mailbox-oauth-failure-types"
import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000

export type MailboxTokenRefreshResult =
  | { ok: true; mailboxConnectionId: string; refreshed: boolean }
  | { ok: false; code: string; message: string; reconnectRequired: boolean; retryable: boolean }

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function accessTokenNeedsRefresh(tokenExpiresAt: string | null, accessTokenPresent: boolean): boolean {
  if (!accessTokenPresent) return true
  if (!tokenExpiresAt) return true
  const expiresAtMs = Date.parse(tokenExpiresAt)
  if (!Number.isFinite(expiresAtMs)) return true
  return expiresAtMs <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS
}

export async function refreshMailboxConnectionTokensIfNeeded(
  admin: SupabaseClient,
  input: {
    mailboxConnectionId: string
    force?: boolean
  },
): Promise<MailboxTokenRefreshResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id, provider_family, encrypted_access_token, encrypted_refresh_token, token_expires_at, status, provider_metadata",
    )
    .eq("id", input.mailboxConnectionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { ok: false, code: "mailbox_not_found", message: "Mailbox not found.", reconnectRequired: true, retryable: false }

  const row = data as Record<string, unknown>
  const mailboxConnectionId = asString(row.id)
  const providerFamily = asString(row.provider_family) as GrowthSenderProviderFamily
  const encryptedRefresh = asString(row.encrypted_refresh_token) || null
  const encryptedAccess = asString(row.encrypted_access_token) || null
  const accessToken = decryptMailboxToken(encryptedAccess)
  const refreshToken = decryptMailboxToken(encryptedRefresh)
  const tokenExpiresAt = asString(row.token_expires_at) || null
  const providerMetadata =
    row.provider_metadata && typeof row.provider_metadata === "object"
      ? (row.provider_metadata as Record<string, unknown>)
      : {}

  const oauthMeta = readMailboxOAuthMetadata(providerMetadata)
  if (oauthMeta.reconnectRequired || oauthMeta.oauthFailure?.reconnectRequired) {
    return {
      ok: false,
      code: oauthMeta.oauthFailure?.category ?? "reconnect_required",
      message: oauthMeta.oauthFailure?.providerErrorDescription ?? "Mailbox reconnect required.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  if (!refreshToken) {
    return {
      ok: false,
      code: "refresh_token_missing",
      message: "Refresh token missing — reconnect required.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  const needsRefresh = input.force || accessTokenNeedsRefresh(tokenExpiresAt, Boolean(accessToken))
  if (!needsRefresh) {
    return { ok: true, mailboxConnectionId, refreshed: false }
  }

  const liveRefresh =
    providerFamily === "google" && googleProviderOAuthConfigured()
      ? await refreshGoogleMailboxTokensLive(encryptedRefresh)
      : providerFamily === "microsoft" && microsoftProviderOAuthConfigured()
        ? await refreshMicrosoftMailboxTokensLive(encryptedRefresh)
        : null

  if (!liveRefresh) {
    return {
      ok: false,
      code: "refresh_unsupported",
      message: "Live OAuth refresh is not configured for this provider.",
      reconnectRequired: false,
      retryable: false,
    }
  }

  if (!liveRefresh.ok) {
    const parsed = parseGoogleOAuthErrorFromMessage(liveRefresh.message)
    const diagnostic = classifyOAuthRefreshFailure({
      message: liveRefresh.message,
      providerErrorCode: parsed.errorCode,
    })
    const nextMetadata = sanitizeMailboxMetadataForApi(
      writeMailboxOAuthFailureMetadata(providerMetadata, diagnostic),
    )
    const nextStatus = diagnostic.reconnectRequired ? "error" : asString(row.status) || "warning"
    await admin
      .schema("growth")
      .from("mailbox_connections")
      .update({
        status: nextStatus,
        provider_metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mailboxConnectionId)

    return {
      ok: false,
      code: diagnostic.category,
      message: liveRefresh.message,
      reconnectRequired: diagnostic.reconnectRequired,
      retryable: diagnostic.retryable,
    }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    encrypted_access_token: encryptMailboxToken(liveRefresh.accessToken),
    token_expires_at: liveRefresh.expiresAt,
    last_refresh_attempt: now,
    last_successful_refresh: now,
    status: "connected",
    provider_metadata: sanitizeMailboxMetadataForApi(
      clearMailboxOAuthFailureMetadata(
        writeMailboxAccessTokenRefreshRequired(providerMetadata, false),
      ),
    ),
    updated_at: now,
  }

  if (liveRefresh.refreshToken?.trim()) {
    patch.encrypted_refresh_token = encryptMailboxToken(liveRefresh.refreshToken)
  }

  await admin.schema("growth").from("mailbox_connections").update(patch).eq("id", mailboxConnectionId)

  return { ok: true, mailboxConnectionId, refreshed: true }
}

export async function refreshMailboxTokensForSenderIfNeeded(
  admin: SupabaseClient,
  senderAccountId: string,
  input?: { force?: boolean },
): Promise<MailboxTokenRefreshResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "No mailbox connection for sender.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  return refreshMailboxConnectionTokensIfNeeded(admin, {
    mailboxConnectionId: asString((data as { id?: string }).id),
    force: input?.force,
  })
}

export function isMailboxAccessTokenRefreshable(input: {
  tokenExpiresAt: string | null
  refreshTokenConfigured: boolean
  reconnectRequired?: boolean
}): boolean {
  if (input.reconnectRequired) return false
  if (!input.refreshTokenConfigured) return false
  return isMailboxTokenExpired(input.tokenExpiresAt) || !input.tokenExpiresAt
}
