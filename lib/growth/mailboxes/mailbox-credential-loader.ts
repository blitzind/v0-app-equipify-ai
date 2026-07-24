/**
 * AVA-MAILBOX-CREDENTIAL-RESOLUTION-HOTFIX-1A — Canonical mailbox credential loader (server-only).
 *
 * Shared by transport, inbox sync, readiness, and refresh paths.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import { refreshMicrosoftMailboxTokensLive } from "@/lib/growth/mailboxes/microsoft-mailbox-live-validation"
import { isMailboxTokenExpired } from "@/lib/growth/mailboxes/mailbox-health"
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { isUsingDevFallbackCredentialPepper } from "@/lib/growth/outbound/credentials-crypto"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { microsoftProviderOAuthConfigured } from "@/lib/growth/provider-setup/microsoft-oauth"
import type { GrowthDeliveryProviderFamily } from "@/lib/growth/providers/provider-types"
import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000

export const MAILBOX_CREDENTIAL_LOADER_QA_MARKER = "mailbox-credential-loader-1a-v1" as const

export type MailboxEncryptedTokenResolution = {
  encryptedPresent: boolean
  plaintext: string | null
  decryptionFailed: boolean
}

export type MailboxCredentialsLoadResult =
  | {
      ok: true
      mailboxConnectionId: string
      providerFamily: GrowthSenderProviderFamily
      accessToken: string | null
      refreshToken: string | null
      emailAddress: string | null
      accessTokenExpired: boolean
      encryptedRefreshPresent: boolean
      encryptedAccessPresent: boolean
      refreshed: boolean
    }
  | {
      ok: false
      code:
        | "mailbox_not_found"
        | "refresh_token_missing"
        | "credential_decryption_failed"
        | "access_token_unavailable"
        | "refresh_failed"
      message: string
      reconnectRequired: boolean
      encryptedRefreshPresent: boolean
      encryptedAccessPresent: boolean
      accessTokenExpired: boolean
    }

export type MailboxCredentialDiagnostic = {
  qaMarker: typeof MAILBOX_CREDENTIAL_LOADER_QA_MARKER
  mailboxConnectionId: string | null
  senderAccountId: string
  encryptedRefreshPresent: boolean
  encryptedAccessPresent: boolean
  accessTokenExpired: boolean
  canonicalLoad: "success" | "failure"
  failureCategory: string | null
  usingDevFallbackCredentialPepper: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveEncryptedMailboxToken(
  encrypted: string | null | undefined,
): MailboxEncryptedTokenResolution {
  const encryptedPresent = Boolean(encrypted?.trim())
  if (!encryptedPresent) {
    return { encryptedPresent: false, plaintext: null, decryptionFailed: false }
  }
  const plaintext = decryptMailboxToken(encrypted)
  if (!plaintext) {
    return { encryptedPresent: true, plaintext: null, decryptionFailed: true }
  }
  return { encryptedPresent: true, plaintext, decryptionFailed: false }
}

function accessTokenNeedsRefresh(tokenExpiresAt: string | null, accessTokenPresent: boolean): boolean {
  if (!accessTokenPresent) return true
  if (!tokenExpiresAt) return true
  const expiresAtMs = Date.parse(tokenExpiresAt)
  if (!Number.isFinite(expiresAtMs)) return true
  return expiresAtMs <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS
}

async function persistRefreshedMailboxTokens(
  admin: SupabaseClient,
  mailboxConnectionId: string,
  refreshed: { accessToken: string; expiresAt: string | null; refreshToken?: string },
): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    encrypted_access_token: encryptMailboxToken(refreshed.accessToken),
    token_expires_at: refreshed.expiresAt,
    last_refresh_attempt: now,
    last_successful_refresh: now,
    updated_at: now,
  }
  if (refreshed.refreshToken?.trim()) {
    patch.encrypted_refresh_token = encryptMailboxToken(refreshed.refreshToken)
  }
  await admin.schema("growth").from("mailbox_connections").update(patch).eq("id", mailboxConnectionId)
}

export async function loadMailboxCredentialsForSender(
  admin: SupabaseClient,
  senderAccountId: string,
  input?: {
    providerFamily?: GrowthDeliveryProviderFamily | GrowthSenderProviderFamily
    refreshIfExpired?: boolean
    persistRefresh?: boolean
  },
): Promise<MailboxCredentialsLoadResult> {
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
  if (!data) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "No mailbox connection for sender.",
      reconnectRequired: true,
      encryptedRefreshPresent: false,
      encryptedAccessPresent: false,
      accessTokenExpired: true,
    }
  }

  const row = data as Record<string, unknown>
  const mailboxConnectionId = asString(row.id)
  const providerFamily = (input?.providerFamily ?? asString(row.provider_family)) as GrowthSenderProviderFamily
  const encryptedAccess = asString(row.encrypted_access_token) || null
  const encryptedRefresh = asString(row.encrypted_refresh_token) || null
  const tokenExpiresAt = asString(row.token_expires_at) || null
  const emailAddress = asString(row.email_address) || null

  const accessResolution = resolveEncryptedMailboxToken(encryptedAccess)
  const refreshResolution = resolveEncryptedMailboxToken(encryptedRefresh)
  let accessToken = accessResolution.plaintext
  let refreshToken = refreshResolution.plaintext
  const accessTokenExpired = accessTokenNeedsRefresh(tokenExpiresAt, Boolean(accessToken))
  let refreshed = false

  const refreshIfExpired = input?.refreshIfExpired ?? true
  const persistRefresh = input?.persistRefresh ?? true

  if (refreshIfExpired && accessTokenExpired) {
    if (!refreshResolution.encryptedPresent) {
      return {
        ok: false,
        code: "refresh_token_missing",
        message: "Refresh token missing — reconnect required.",
        reconnectRequired: true,
        encryptedRefreshPresent: false,
        encryptedAccessPresent: accessResolution.encryptedPresent,
        accessTokenExpired: true,
      }
    }

    if (refreshResolution.decryptionFailed) {
      return {
        ok: false,
        code: "credential_decryption_failed",
        message: "Mailbox refresh token could not be decrypted.",
        reconnectRequired: true,
        encryptedRefreshPresent: true,
        encryptedAccessPresent: accessResolution.encryptedPresent,
        accessTokenExpired: true,
      }
    }

    const refreshLive =
      providerFamily === "google" && googleProviderOAuthConfigured()
        ? await refreshGoogleMailboxTokensLive(encryptedRefresh)
        : providerFamily === "microsoft" && microsoftProviderOAuthConfigured()
          ? await refreshMicrosoftMailboxTokensLive(encryptedRefresh)
          : null

    if (!refreshLive?.ok) {
      const message = refreshLive?.message ?? "Mailbox token refresh failed."
      const undecryptable = message.toLowerCase().includes("undecryptable")
      return {
        ok: false,
        code: undecryptable ? "credential_decryption_failed" : "refresh_failed",
        message,
        reconnectRequired: undecryptable,
        encryptedRefreshPresent: true,
        encryptedAccessPresent: accessResolution.encryptedPresent,
        accessTokenExpired: true,
      }
    }

    accessToken = refreshLive.accessToken
    if (refreshLive.refreshToken?.trim()) {
      refreshToken = refreshLive.refreshToken
    }
    refreshed = true

    if (persistRefresh) {
      await persistRefreshedMailboxTokens(admin, mailboxConnectionId, refreshLive)
    }
  }

  if (!accessToken && accessResolution.encryptedPresent && accessResolution.decryptionFailed) {
    return {
      ok: false,
      code: "credential_decryption_failed",
      message: "Mailbox access token could not be decrypted.",
      reconnectRequired: true,
      encryptedRefreshPresent: refreshResolution.encryptedPresent,
      encryptedAccessPresent: true,
      accessTokenExpired,
    }
  }

  if (!accessToken) {
    return {
      ok: false,
      code: "access_token_unavailable",
      message: "Mailbox access token unavailable.",
      reconnectRequired: !refreshResolution.encryptedPresent,
      encryptedRefreshPresent: refreshResolution.encryptedPresent,
      encryptedAccessPresent: accessResolution.encryptedPresent,
      accessTokenExpired,
    }
  }

  return {
    ok: true,
    mailboxConnectionId,
    providerFamily,
    accessToken,
    refreshToken,
    emailAddress,
    accessTokenExpired,
    encryptedRefreshPresent: refreshResolution.encryptedPresent,
    encryptedAccessPresent: accessResolution.encryptedPresent,
    refreshed,
  }
}

export async function diagnoseMailboxCredentialsForSender(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<MailboxCredentialDiagnostic> {
  const { data } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id, token_expires_at, encrypted_refresh_token, encrypted_access_token")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = (data ?? null) as Record<string, unknown> | null
  const encryptedRefreshPresent = Boolean(asString(row?.encrypted_refresh_token))
  const encryptedAccessPresent = Boolean(asString(row?.encrypted_access_token))
  const accessTokenExpired = isMailboxTokenExpired(asString(row?.token_expires_at) || null)

  const loaded = await loadMailboxCredentialsForSender(admin, senderAccountId, {
    refreshIfExpired: accessTokenExpired,
    persistRefresh: false,
  })

  return {
    qaMarker: MAILBOX_CREDENTIAL_LOADER_QA_MARKER,
    mailboxConnectionId: row ? asString(row.id) || null : null,
    senderAccountId,
    encryptedRefreshPresent,
    encryptedAccessPresent,
    accessTokenExpired,
    canonicalLoad: loaded.ok ? "success" : "failure",
    failureCategory: loaded.ok ? null : loaded.code,
    usingDevFallbackCredentialPepper: isUsingDevFallbackCredentialPepper(),
  }
}
