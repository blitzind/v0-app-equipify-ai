import { NextRequest, NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { completeOAuthProviderConnection } from "@/lib/growth/provider-setup/dashboard"
import {
  exchangeGoogleProviderOAuthCode,
  fetchGoogleProviderAccountProfile,
  getGoogleOAuthScopes,
  googleProviderOAuthConfigured,
} from "@/lib/growth/provider-setup/google-oauth"
import {
  consumeProviderSetupOAuthStateRecord,
  verifyProviderSetupOAuthState,
} from "@/lib/growth/provider-setup/oauth-state"

export const runtime = "nodejs"

function redirectResult(request: NextRequest, returnTo: string, search: Record<string, string>) {
  const u = new URL(returnTo, request.nextUrl.origin)
  for (const [key, value] of Object.entries(search)) u.searchParams.set(key, value)
  return NextResponse.redirect(u.toString())
}

export async function GET(request: NextRequest) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const returnTo = "/admin/growth/providers/setup"
  const oauthError = request.nextUrl.searchParams.get("error")
  if (oauthError) return redirectResult(request, returnTo, { provider_error: oauthError })

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  if (!code || !state) return redirectResult(request, returnTo, { provider_error: "missing_code_or_state" })
  if (!googleProviderOAuthConfigured()) {
    return redirectResult(request, returnTo, { provider_error: "not_configured" })
  }

  const payload = verifyProviderSetupOAuthState(state, "google")
  if (!payload || payload.userId !== access.userId) {
    return redirectResult(request, returnTo, { provider_error: "invalid_state" })
  }

  const consumed = await consumeProviderSetupOAuthStateRecord(access.admin, {
    stateToken: state,
    providerFamily: "google",
    userId: access.userId,
  })
  if (!consumed) return redirectResult(request, returnTo, { provider_error: "state_already_used" })

  try {
    const tokens = await exchangeGoogleProviderOAuthCode(code)
    const profile = await fetchGoogleProviderAccountProfile(tokens.access_token)
    const tokenExpiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()

    await completeOAuthProviderConnection(access.admin, {
      providerFamily: "google",
      senderAccountId: consumed.sender_account_id ?? payload.senderAccountId ?? null,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
      tokenExpiresAt,
      scopes: getGoogleOAuthScopes(),
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    return redirectResult(request, consumed.return_to, { provider_connected: "google" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed"
    return redirectResult(request, consumed.return_to, { provider_error: message.slice(0, 200) })
  }
}
