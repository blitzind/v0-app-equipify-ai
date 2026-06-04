import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import { refreshMicrosoftMailboxTokensLive } from "@/lib/growth/mailboxes/microsoft-mailbox-live-validation"
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { microsoftProviderOAuthConfigured } from "@/lib/growth/provider-setup/microsoft-oauth"

type MailboxRow = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type MailboxSyncCredentials = {
  mailboxConnectionId: string
  providerFamily: string
  emailAddress: string
  accessToken: string
}

async function persistRefreshedAccessToken(
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
  if (refreshed.refreshToken) {
    patch.encrypted_refresh_token = encryptMailboxToken(refreshed.refreshToken)
  }
  await admin.schema("growth").from("mailbox_connections").update(patch).eq("id", mailboxConnectionId)
}

async function refreshAccessTokenIfExpired(input: {
  admin: SupabaseClient
  mailboxConnectionId: string
  providerFamily: string
  accessToken: string | null
  encryptedRefreshToken: string
  tokenExpiresAt: string
}): Promise<string | null> {
  const { admin, mailboxConnectionId, providerFamily } = input
  let accessToken = input.accessToken

  const expiresAtMs = Date.parse(input.tokenExpiresAt)
  const accessExpired = !accessToken || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000
  if (!accessExpired) return accessToken

  if (providerFamily === "google" && googleProviderOAuthConfigured()) {
    const refreshed = await refreshGoogleMailboxTokensLive(input.encryptedRefreshToken)
    if (refreshed.ok) {
      accessToken = refreshed.accessToken
      await persistRefreshedAccessToken(admin, mailboxConnectionId, refreshed)
    } else if (!accessToken) {
      return null
    }
    return accessToken
  }

  if (providerFamily === "microsoft" && microsoftProviderOAuthConfigured()) {
    const refreshed = await refreshMicrosoftMailboxTokensLive(input.encryptedRefreshToken)
    if (refreshed.ok) {
      accessToken = refreshed.accessToken
      await persistRefreshedAccessToken(admin, mailboxConnectionId, refreshed)
    } else if (!accessToken) {
      return null
    }
    return accessToken
  }

  return accessToken
}

export async function loadMailboxSyncCredentials(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): Promise<MailboxSyncCredentials | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id, provider_family, email_address, encrypted_access_token, encrypted_refresh_token, token_expires_at, status",
    )
    .eq("id", mailboxConnectionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as MailboxRow
  const providerFamily = asString(row.provider_family)
  if (providerFamily !== "google" && providerFamily !== "microsoft") return null

  let accessToken = decryptMailboxToken(asString(row.encrypted_access_token) || null)
  const refreshToken = decryptMailboxToken(asString(row.encrypted_refresh_token) || null)
  const emailAddress = asString(row.email_address).toLowerCase()

  if (!accessToken && !refreshToken) return null

  if (refreshToken) {
    accessToken = await refreshAccessTokenIfExpired({
      admin,
      mailboxConnectionId,
      providerFamily,
      accessToken,
      encryptedRefreshToken: asString(row.encrypted_refresh_token) || "",
      tokenExpiresAt: asString(row.token_expires_at),
    })
  }

  if (!accessToken) return null

  return {
    mailboxConnectionId,
    providerFamily,
    emailAddress,
    accessToken,
  }
}
