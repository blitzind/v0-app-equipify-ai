/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Pre-send mailbox readiness (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadMailboxCredentialsForSender } from "@/lib/growth/mailboxes/mailbox-credential-loader"
import { isMailboxTokenExpired } from "@/lib/growth/mailboxes/mailbox-health"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import { readMailboxOAuthMetadata } from "@/lib/growth/mailboxes/mailbox-oauth-failure-types"
import { refreshMailboxTokensForSenderIfNeeded } from "@/lib/growth/mailboxes/mailbox-token-refresh-service"

export type MailboxPreSendReadinessResult =
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
      reconnectRequired: boolean
      retryable: boolean
    }

/**
 * Configuration-level eligibility for sender assignment during approval.
 * Does not decrypt credentials when the access token is still valid.
 */
export async function ensureMailboxEligibleForSenderAssignment(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<MailboxPreSendReadinessResult> {
  const mailbox = await getMailboxConnectionBySender(admin, senderAccountId)
  if (!mailbox) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "No mailbox connection for sender.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  if (mailbox.status === "disabled") {
    return {
      ok: false,
      code: "mailbox_disabled",
      message: "Mailbox connection is disabled.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  if (["error", "expired"].includes(mailbox.status)) {
    return {
      ok: false,
      code: "mailbox_unhealthy",
      message: mailbox.health_reason ?? `Mailbox connection unhealthy (${mailbox.status}).`,
      reconnectRequired: true,
      retryable: false,
    }
  }

  const oauth = readMailboxOAuthMetadata(mailbox.provider_metadata)
  if (oauth.reconnectRequired || oauth.oauthFailure?.reconnectRequired) {
    return {
      ok: false,
      code: oauth.oauthFailure?.category ?? "reconnect_required",
      message: oauth.oauthFailure?.providerErrorDescription ?? "Reconnect assigned mailbox.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  const accessExpired = isMailboxTokenExpired(mailbox.token_expires_at)
  if (!accessExpired) {
    if (!mailbox.token_configured) {
      return {
        ok: false,
        code: "mailbox_not_configured",
        message: "Mailbox tokens are not configured.",
        reconnectRequired: true,
        retryable: false,
      }
    }
    return { ok: true }
  }

  if (!mailbox.refresh_token_configured) {
    return {
      ok: false,
      code: "refresh_token_missing",
      message: "Refresh token missing — reconnect required.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  return { ok: true }
}

/**
 * Transport-time readiness — proves credentials are resolvable before send.
 */
export async function ensureMailboxReadyForOutboundSend(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<MailboxPreSendReadinessResult> {
  const assignmentEligible = await ensureMailboxEligibleForSenderAssignment(admin, senderAccountId)
  if (!assignmentEligible.ok) return assignmentEligible

  const mailbox = await getMailboxConnectionBySender(admin, senderAccountId)
  const accessExpired = isMailboxTokenExpired(mailbox?.token_expires_at ?? null)

  if (!accessExpired) {
    const loaded = await loadMailboxCredentialsForSender(admin, senderAccountId, {
      refreshIfExpired: false,
      persistRefresh: false,
    })
    if (!loaded.ok) {
      return {
        ok: false,
        code: loaded.code,
        message: loaded.message,
        reconnectRequired: loaded.reconnectRequired,
        retryable: loaded.code === "refresh_failed",
      }
    }
    if (!loaded.accessToken) {
      return {
        ok: false,
        code: "access_token_unavailable",
        message: "Mailbox access token unavailable.",
        reconnectRequired: true,
        retryable: false,
      }
    }
    return { ok: true }
  }

  const refresh = await refreshMailboxTokensForSenderIfNeeded(admin, senderAccountId)
  if (!refresh.ok) {
    return {
      ok: false,
      code: refresh.code,
      message: refresh.message,
      reconnectRequired: refresh.reconnectRequired,
      retryable: refresh.retryable,
    }
  }

  const latest = await getMailboxConnectionBySender(admin, senderAccountId)
  if (!latest) {
    return {
      ok: false,
      code: "mailbox_not_found",
      message: "Mailbox connection unavailable after refresh.",
      reconnectRequired: true,
      retryable: false,
    }
  }

  if (["error", "disabled"].includes(latest.status)) {
    return {
      ok: false,
      code: "mailbox_unhealthy",
      message: latest.health_reason ?? `Mailbox connection unhealthy (${latest.status}).`,
      reconnectRequired: latest.status === "error",
      retryable: false,
    }
  }

  return { ok: true }
}
