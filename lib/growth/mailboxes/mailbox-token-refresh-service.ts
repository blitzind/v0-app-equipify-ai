/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Canonical mailbox OAuth refresh (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyOAuthRefreshFailure,
  clearMailboxOAuthFailureMetadata,
  parseGoogleOAuthErrorFromMessage,
  writeMailboxAccessTokenRefreshRequired,
  writeMailboxOAuthFailureMetadata,
} from "@/lib/growth/mailboxes/mailbox-oauth-diagnostics"
import { loadMailboxCredentialsForSender } from "@/lib/growth/mailboxes/mailbox-credential-loader"
import { isMailboxTokenExpired } from "@/lib/growth/mailboxes/mailbox-health"
import { sanitizeMailboxMetadataForApi } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { readMailboxOAuthMetadata } from "@/lib/growth/mailboxes/mailbox-oauth-failure-types"

export type MailboxTokenRefreshResult =
  | { ok: true; mailboxConnectionId: string; refreshed: boolean }
  | { ok: false; code: string; message: string; reconnectRequired: boolean; retryable: boolean }

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
    .select("id, sender_account_id, provider_metadata, status")
    .eq("id", input.mailboxConnectionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "Mailbox not found.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  const row = data as Record<string, unknown>
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

  const senderAccountId = typeof row.sender_account_id === "string" ? row.sender_account_id.trim() : ""
  if (!senderAccountId) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "Mailbox sender unavailable.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  const loaded = await loadMailboxCredentialsForSender(admin, senderAccountId, {
    refreshIfExpired: input.force ?? true,
    persistRefresh: true,
  })

  if (!loaded.ok) {
    if (loaded.code === "refresh_failed") {
      const parsed = parseGoogleOAuthErrorFromMessage(loaded.message)
      const diagnostic = classifyOAuthRefreshFailure({
        message: loaded.message,
        providerErrorCode: parsed.errorCode,
      })
      const nextMetadata = sanitizeMailboxMetadataForApi(
        writeMailboxOAuthFailureMetadata(providerMetadata, diagnostic),
      )
      const nextStatus = diagnostic.reconnectRequired ? "error" : String(row.status ?? "warning")
      await admin
        .schema("growth")
        .from("mailbox_connections")
        .update({
          status: nextStatus,
          provider_metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.mailboxConnectionId)

      return {
        ok: false,
        code: diagnostic.category,
        message: loaded.message,
        reconnectRequired: diagnostic.reconnectRequired,
        retryable: diagnostic.retryable,
      }
    }

    return {
      ok: false,
      code: loaded.code,
      message: loaded.message,
      reconnectRequired: loaded.reconnectRequired,
      retryable: loaded.code === "refresh_failed",
    }
  }

  if (loaded.refreshed) {
    await admin
      .schema("growth")
      .from("mailbox_connections")
      .update({
        status: "connected",
        provider_metadata: sanitizeMailboxMetadataForApi(
          clearMailboxOAuthFailureMetadata(
            writeMailboxAccessTokenRefreshRequired(providerMetadata, false),
          ),
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", loaded.mailboxConnectionId)
  }

  return { ok: true, mailboxConnectionId: loaded.mailboxConnectionId, refreshed: loaded.refreshed }
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
    mailboxConnectionId: typeof (data as { id?: string }).id === "string" ? (data as { id: string }).id : "",
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
