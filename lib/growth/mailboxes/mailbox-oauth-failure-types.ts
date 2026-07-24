/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — OAuth failure taxonomy (client-safe).
 */

export const MAILBOX_OAUTH_FAILURE_QA_MARKER = "mailbox-oauth-failure-1a-v1" as const

export const MAILBOX_OAUTH_FAILURE_CATEGORIES = [
  "invalid_grant",
  "token_revoked",
  "refresh_token_missing",
  "consent_required",
  "admin_policy_enforced",
  "transient_provider_failure",
  "credential_decryption_failed",
  "unknown_refresh_failure",
] as const

export type MailboxOAuthFailureCategory = (typeof MAILBOX_OAUTH_FAILURE_CATEGORIES)[number]

export type MailboxOAuthFailureDiagnostic = {
  qaMarker: typeof MAILBOX_OAUTH_FAILURE_QA_MARKER
  providerErrorCode: string | null
  category: MailboxOAuthFailureCategory
  providerErrorDescription: string | null
  failedAt: string
  retryable: boolean
  reconnectRequired: boolean
}

export type MailboxOAuthMetadata = {
  oauthFailure?: MailboxOAuthFailureDiagnostic | null
  accessTokenRefreshRequired?: boolean
  reconnectRequired?: boolean
  lastSuccessfulRefreshAt?: string | null
}

export function readMailboxOAuthMetadata(
  providerMetadata: Record<string, unknown> | null | undefined,
): MailboxOAuthMetadata {
  const raw = providerMetadata?.mailboxOAuth
  if (!raw || typeof raw !== "object") return {}
  const row = raw as MailboxOAuthMetadata
  return row
}
