import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { refreshGoogleMailboxTokensLive } from "@/lib/growth/mailboxes/google-mailbox-live-validation"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"

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
  if (providerFamily !== "google") return null

  let accessToken = decryptMailboxToken(asString(row.encrypted_access_token) || null)
  const refreshToken = decryptMailboxToken(asString(row.encrypted_refresh_token) || null)
  const emailAddress = asString(row.email_address).toLowerCase()

  if (!accessToken && !refreshToken) return null

  if (googleProviderOAuthConfigured() && refreshToken) {
    const expiresAtMs = Date.parse(asString(row.token_expires_at))
    const accessExpired = !accessToken || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000

    if (accessExpired) {
      const refreshed = await refreshGoogleMailboxTokensLive(asString(row.encrypted_refresh_token) || null)
      if (refreshed.ok) {
        accessToken = refreshed.accessToken
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
      } else if (!accessToken) {
        return null
      }
    }
  }

  if (!accessToken) return null

  return {
    mailboxConnectionId,
    providerFamily,
    emailAddress,
    accessToken,
  }
}
