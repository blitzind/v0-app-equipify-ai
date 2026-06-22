import { NextRequest, NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { completeOAuthProviderConnection } from "@/lib/growth/provider-setup/dashboard"
import {
  defaultGrowthProviderOAuthReturnTo,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"
import {
  exchangeMicrosoftProviderOAuthCode,
  fetchMicrosoftProviderAccountProfile,
  getMicrosoftOAuthScopes,
  microsoftProviderOAuthConfigured,
} from "@/lib/growth/provider-setup/microsoft-oauth"
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

  const returnTo = defaultGrowthProviderOAuthReturnTo("growth")
  const oauthError = request.nextUrl.searchParams.get("error")
  if (oauthError) return redirectResult(request, returnTo, { provider_error: oauthError })

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  if (!code || !state) return redirectResult(request, returnTo, { provider_error: "missing_code_or_state" })
  if (!microsoftProviderOAuthConfigured()) {
    return redirectResult(request, returnTo, { provider_error: "not_configured" })
  }

  const payload = verifyProviderSetupOAuthState(state, "microsoft")
  if (!payload || payload.userId !== access.userId) {
    return redirectResult(request, returnTo, { provider_error: "invalid_state" })
  }

  const consumed = await consumeProviderSetupOAuthStateRecord(access.admin, {
    stateToken: state,
    providerFamily: "microsoft",
    userId: access.userId,
  })
  if (!consumed) return redirectResult(request, returnTo, { provider_error: "state_already_used" })

  try {
    const tokens = await exchangeMicrosoftProviderOAuthCode(code)
    const profile = await fetchMicrosoftProviderAccountProfile(tokens.access_token)
    const tokenExpiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()

    await completeOAuthProviderConnection(access.admin, {
      providerFamily: "microsoft",
      senderAccountId: consumed.sender_account_id ?? payload.senderAccountId ?? null,
      mailboxConnectionId: consumed.mailbox_connection_id ?? payload.mailboxConnectionId ?? null,
      email: profile.email,
      displayName: profile.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenExpiresAt,
      scopes: getMicrosoftOAuthScopes(),
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    return redirectResult(request, consumed.return_to, { provider_connected: "microsoft" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed"
    return redirectResult(request, consumed.return_to, { provider_error: message.slice(0, 200) })
  }
}
