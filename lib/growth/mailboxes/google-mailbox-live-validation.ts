import "server-only"

import {
  fetchGoogleProviderAccountProfile,
  googleProviderOAuthConfigured,
  refreshGoogleProviderAccessToken,
} from "@/lib/growth/provider-setup/google-oauth"
import { decryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import type { GrowthMailboxConnectionStatus } from "@/lib/growth/mailboxes/mailbox-types"
import type { MailboxValidationResult } from "@/lib/growth/mailboxes/mailbox-validation"

export type GoogleMailboxLiveValidationInput = {
  email_address: string
  encrypted_refresh_token?: string | null
  encrypted_access_token?: string | null
  token_expires_at?: string | null
  status: GrowthMailboxConnectionStatus
  validation_failure_count?: number
}

export type GoogleMailboxTokenRefreshLiveResult =
  | { ok: true; accessToken: string; expiresAt: string | null; refreshToken?: string }
  | { ok: false; message: string }

export async function refreshGoogleMailboxTokensLive(
  encryptedRefreshToken: string | null | undefined,
): Promise<GoogleMailboxTokenRefreshLiveResult> {
  if (!googleProviderOAuthConfigured()) {
    return { ok: false, message: "Google OAuth is not configured." }
  }

  const refreshToken = decryptMailboxToken(encryptedRefreshToken)
  if (!refreshToken) {
    return { ok: false, message: "Google refresh token missing or undecryptable." }
  }

  try {
    const token = await refreshGoogleProviderAccessToken(refreshToken)
    const expiresAt =
      typeof token.expires_in === "number"
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null
    return {
      ok: true,
      accessToken: token.access_token,
      expiresAt,
      refreshToken: token.refresh_token,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Google token refresh failed.",
    }
  }
}

export async function validateGoogleMailboxConnectionLive(
  input: GoogleMailboxLiveValidationInput,
): Promise<MailboxValidationResult> {
  const checked_at = new Date().toISOString()

  if (input.status === "disabled") {
    return { valid: false, status: "disabled", message: "Mailbox connection is disabled.", checked_at }
  }

  if ((input.validation_failure_count ?? 0) > 3) {
    return {
      valid: false,
      status: "error",
      message: "Validation failure threshold exceeded.",
      checked_at,
    }
  }

  if (!googleProviderOAuthConfigured()) {
    return {
      valid: false,
      status: "pending",
      message: "Google OAuth env incomplete — live validation unavailable.",
      checked_at,
    }
  }

  const refresh = await refreshGoogleMailboxTokensLive(input.encrypted_refresh_token)
  if (!refresh.ok) {
    return {
      valid: false,
      status: "error",
      message: refresh.message,
      checked_at,
    }
  }

  try {
    const profile = await fetchGoogleProviderAccountProfile(refresh.accessToken)
    const expected = input.email_address.trim().toLowerCase()
    const actual = profile.email.trim().toLowerCase()
    if (expected && actual !== expected) {
      return {
        valid: false,
        status: "warning",
        message: `Connected Google account (${profile.email}) does not match mailbox record (${input.email_address}).`,
        checked_at,
      }
    }

    return {
      valid: true,
      status: "connected",
      message: "Google mailbox live validation passed — OAuth token refresh + profile check succeeded.",
      checked_at,
    }
  } catch (error) {
    return {
      valid: false,
      status: "error",
      message: error instanceof Error ? error.message : "Google profile validation failed.",
      checked_at,
    }
  }
}
