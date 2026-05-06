import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { refreshQuickBooksAccessToken } from "@/lib/integrations/quickbooks-oauth"

export type QuickBooksConnection = {
  integrationId: string
  organizationId: string
  realmId: string
  accessToken: string
  /** Current refresh token (rotated on refresh) — for persistence only, never sent to client. */
  refreshToken: string
}

const EXPIRY_BUFFER_MS = 120_000

/**
 * Loads integration + tokens (service role), refreshes access token when near expiry, persists new tokens.
 */
export async function getQuickBooksConnection(
  svc: SupabaseClient,
  organizationId: string,
): Promise<QuickBooksConnection | { error: string; code?: string }> {
  const { data: int, error: intErr } = await svc
    .from("organization_integrations")
    .select("id, realm_id, connection_status")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  if (intErr) {
    return { error: intErr.message, code: "query_failed" }
  }

  const row = int as { id?: string; realm_id?: string | null; connection_status?: string } | null
  if (!row?.id || row.connection_status !== "connected") {
    return { error: "QuickBooks is not connected for this organization.", code: "not_connected" }
  }
  if (!row.realm_id?.trim()) {
    return { error: "Missing QuickBooks company (realm). Reconnect QuickBooks.", code: "missing_realm" }
  }

  const { data: tok, error: tokErr } = await svc
    .from("organization_integration_oauth_tokens")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("organization_integration_id", row.id)
    .maybeSingle()

  if (tokErr || !tok?.refresh_token) {
    return { error: "OAuth tokens missing. Reconnect QuickBooks.", code: "missing_tokens" }
  }

  let accessToken = typeof tok.access_token === "string" ? tok.access_token : ""
  const refreshToken = tok.refresh_token as string
  const expMs = tok.access_token_expires_at
    ? new Date(String(tok.access_token_expires_at)).getTime()
    : 0

  const needsRefresh = !accessToken || Date.now() > expMs - EXPIRY_BUFFER_MS

  let nextRefresh = refreshToken

  if (needsRefresh) {
    try {
      const refreshed = await refreshQuickBooksAccessToken(refreshToken)
      accessToken = refreshed.access_token
      nextRefresh = refreshed.refresh_token
      const expiresAt = new Date(Date.now() + Math.max(60, refreshed.expires_in) * 1000).toISOString()

      const { error: upErr } = await svc.from("organization_integration_oauth_tokens").upsert(
        {
          organization_integration_id: row.id,
          refresh_token: nextRefresh,
          access_token: accessToken,
          access_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_integration_id" },
      )

      if (upErr) {
        return { error: upErr.message, code: "token_persist_failed" }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await svc
        .from("organization_integrations")
        .update({
          connection_status: "error",
          sync_health: "error",
          last_sync_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)

      return { error: msg, code: "token_refresh_failed" }
    }
  }

  return {
    integrationId: row.id,
    organizationId,
    realmId: row.realm_id.trim(),
    accessToken,
    refreshToken: nextRefresh,
  }
}
