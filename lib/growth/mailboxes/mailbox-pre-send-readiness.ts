/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Pre-send mailbox readiness (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
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

export async function ensureMailboxReadyForOutboundSend(
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
