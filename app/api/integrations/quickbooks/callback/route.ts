import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { verifyOAuthState } from "@/lib/integrations/oauth-state"
import { quickBooksOAuthConfigured } from "@/lib/integrations/quickbooks-env"
import { exchangeQuickBooksAuthorizationCode } from "@/lib/integrations/quickbooks-oauth"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function redirectResult(request: NextRequest, search: Record<string, string>) {
  const u = new URL("/settings/integrations/quickbooks", request.nextUrl.origin)
  for (const [k, v] of Object.entries(search)) {
    u.searchParams.set(k, v)
  }
  return NextResponse.redirect(u.toString())
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error")
  const errorDesc = request.nextUrl.searchParams.get("error_description")
  if (error) {
    return redirectResult(request, {
      qbo_error: error,
      ...(errorDesc ? { qbo_error_description: errorDesc.slice(0, 500) } : {}),
    })
  }

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const realmId = request.nextUrl.searchParams.get("realmId")?.trim() ?? null

  if (!code || !state) {
    return redirectResult(request, { qbo_error: "missing_code_or_state" })
  }

  if (!quickBooksOAuthConfigured()) {
    return redirectResult(request, { qbo_error: "server_not_configured" })
  }

  const payload = verifyOAuthState(state, STATE_MAX_AGE_MS)
  if (!payload) {
    return redirectResult(request, { qbo_error: "invalid_state" })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || user.id !== payload.userId) {
    return redirectResult(request, { qbo_error: "session_mismatch" })
  }

  let tokens: Awaited<ReturnType<typeof exchangeQuickBooksAuthorizationCode>>
  try {
    tokens = await exchangeQuickBooksAuthorizationCode(code)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_exchange_failed"
    return redirectResult(request, { qbo_error: encodeURIComponent(msg.slice(0, 200)) })
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return redirectResult(request, { qbo_error: "service_unavailable" })
  }

  const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()

  const { data: existing } = await svc
    .from("organization_integrations")
    .select("id")
    .eq("organization_id", payload.organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  let integrationId = existing?.id as string | undefined

  if (integrationId) {
    const { error: upErr } = await svc
      .from("organization_integrations")
      .update({
        connection_status: "connected",
        realm_id: realmId,
        connected_by_user_id: user.id,
        sync_health: "unknown",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId)

    if (upErr) {
      return redirectResult(request, { qbo_error: encodeURIComponent(upErr.message.slice(0, 200)) })
    }
  } else {
    const { data: inserted, error: insErr } = await svc
      .from("organization_integrations")
      .insert({
        organization_id: payload.organizationId,
        provider: "quickbooks_online",
        connection_status: "connected",
        realm_id: realmId,
        connected_by_user_id: user.id,
        sync_health: "unknown",
      })
      .select("id")
      .single()

    if (insErr || !inserted?.id) {
      return redirectResult(request, {
        qbo_error: encodeURIComponent(insErr?.message?.slice(0, 200) ?? "insert_failed"),
      })
    }
    integrationId = inserted.id as string
  }

  const { error: tokErr } = await svc.from("organization_integration_oauth_tokens").upsert(
    {
      organization_integration_id: integrationId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_integration_id" },
  )

  if (tokErr) {
    return redirectResult(request, { qbo_error: encodeURIComponent(tokErr.message.slice(0, 200)) })
  }

  return redirectResult(request, { qbo_connected: "1" })
}
