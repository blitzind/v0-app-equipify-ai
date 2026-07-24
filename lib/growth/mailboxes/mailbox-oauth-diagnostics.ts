/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — OAuth refresh failure classification (server-only).
 */

import "server-only"

import {
  MAILBOX_OAUTH_FAILURE_QA_MARKER,
  type MailboxOAuthFailureCategory,
  type MailboxOAuthFailureDiagnostic,
} from "@/lib/growth/mailboxes/mailbox-oauth-failure-types"

function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function classifyOAuthRefreshFailure(input: {
  message: string
  providerErrorCode?: string | null
  failedAt?: string
}): MailboxOAuthFailureDiagnostic {
  const message = input.message.trim()
  const code = normalizeCode(input.providerErrorCode)
  const lower = message.toLowerCase()
  const failedAt = input.failedAt ?? new Date().toISOString()

  let category: MailboxOAuthFailureCategory = "unknown_refresh_failure"
  let retryable = false
  let reconnectRequired = true

  if (
    code === "invalid_grant" ||
    lower.includes("invalid_grant") ||
    lower.includes("token has been expired or revoked")
  ) {
    category = "invalid_grant"
  } else if (lower.includes("token revoked") || lower.includes("revoked")) {
    category = "token_revoked"
  } else if (lower.includes("refresh token missing") || lower.includes("undecryptable")) {
    category = "refresh_token_missing"
  } else if (lower.includes("consent") || lower.includes("interaction_required")) {
    category = "consent_required"
  } else if (lower.includes("admin_policy") || lower.includes("policy")) {
    category = "admin_policy_enforced"
  } else if (lower.includes("decrypt")) {
    category = "credential_decryption_failed"
  } else if (
    lower.includes("timeout") ||
    lower.includes("temporarily") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("429")
  ) {
    category = "transient_provider_failure"
    retryable = true
    reconnectRequired = false
  }

  return {
    qaMarker: MAILBOX_OAUTH_FAILURE_QA_MARKER,
    providerErrorCode: input.providerErrorCode?.trim() || null,
    category,
    providerErrorDescription: message || null,
    failedAt,
    retryable,
    reconnectRequired,
  }
}

export function clearMailboxOAuthFailureMetadata(
  providerMetadata: Record<string, unknown>,
): Record<string, unknown> {
  const oauth = readMailboxOAuthBlock(providerMetadata)
  return {
    ...providerMetadata,
    mailboxOAuth: {
      ...oauth,
      oauthFailure: null,
      accessTokenRefreshRequired: false,
      reconnectRequired: false,
      lastSuccessfulRefreshAt: new Date().toISOString(),
    },
  }
}

export function writeMailboxOAuthFailureMetadata(
  providerMetadata: Record<string, unknown>,
  diagnostic: MailboxOAuthFailureDiagnostic,
): Record<string, unknown> {
  const oauth = readMailboxOAuthBlock(providerMetadata)
  return {
    ...providerMetadata,
    mailboxOAuth: {
      ...oauth,
      oauthFailure: diagnostic,
      accessTokenRefreshRequired: false,
      reconnectRequired: diagnostic.reconnectRequired,
    },
  }
}

export function writeMailboxAccessTokenRefreshRequired(
  providerMetadata: Record<string, unknown>,
  required: boolean,
): Record<string, unknown> {
  const oauth = readMailboxOAuthBlock(providerMetadata)
  return {
    ...providerMetadata,
    mailboxOAuth: {
      ...oauth,
      accessTokenRefreshRequired: required,
      reconnectRequired: oauth.reconnectRequired ?? false,
    },
  }
}

function readMailboxOAuthBlock(providerMetadata: Record<string, unknown>): Record<string, unknown> {
  const raw = providerMetadata.mailboxOAuth
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}
}

export function parseGoogleOAuthErrorFromMessage(message: string): {
  errorCode: string | null
  errorDescription: string | null
} {
  const lower = message.toLowerCase()
  const invalidGrant = lower.includes("invalid_grant")
  if (invalidGrant) {
    return { errorCode: "invalid_grant", errorDescription: message }
  }
  const match = message.match(/\berror[=:]\s*([a-z0-9_]+)/i)
  return {
    errorCode: match?.[1]?.trim().toLowerCase() ?? null,
    errorDescription: message,
  }
}
