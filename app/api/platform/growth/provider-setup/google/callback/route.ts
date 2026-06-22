import { NextRequest, NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { completeOAuthProviderConnection } from "@/lib/growth/provider-setup/dashboard"
import { logGrowthGoogleOAuthFlow } from "@/lib/growth/provider-setup/google-oauth-flow-log"
import {
  defaultGrowthProviderOAuthReturnTo,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"
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
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const returnTo = defaultGrowthProviderOAuthReturnTo("growth")
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
    logGrowthGoogleOAuthFlow("oauth_callback_failed", {
      userId: access.userId,
      provider: "google",
      connectionState: "invalid_state",
      error: "invalid_state",
    })
    return redirectResult(request, returnTo, { provider_error: "invalid_state" })
  }

  const consumed = await consumeProviderSetupOAuthStateRecord(access.admin, {
    stateToken: state,
    providerFamily: "google",
    userId: access.userId,
  })
  if (!consumed) {
    logGrowthGoogleOAuthFlow("oauth_callback_failed", {
      userId: access.userId,
      senderId: payload.senderAccountId ?? null,
      mailboxId: payload.mailboxConnectionId ?? null,
      provider: "google",
      connectionState: "state_already_used",
      returnTo: payload.returnTo,
      error: "state_already_used",
    })
    return redirectResult(request, returnTo, { provider_error: "state_already_used" })
  }

  const senderAccountId = consumed.sender_account_id ?? payload.senderAccountId ?? null
  const mailboxConnectionId = consumed.mailbox_connection_id ?? payload.mailboxConnectionId ?? null

  logGrowthGoogleOAuthFlow("oauth_callback_received", {
    userId: access.userId,
    senderId: senderAccountId,
    mailboxId: mailboxConnectionId,
    provider: "google",
    connectionState: "callback_received",
    returnTo: consumed.return_to,
  })

  try {
    const tokens = await exchangeGoogleProviderOAuthCode(code)
    const profile = await fetchGoogleProviderAccountProfile(tokens.access_token)
    const tokenExpiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()

    logGrowthGoogleOAuthFlow("token_exchange_success", {
      userId: access.userId,
      senderId: senderAccountId,
      mailboxId: mailboxConnectionId,
      email: profile.email,
      provider: "google",
      connectionState: "token_exchanged",
      returnTo: consumed.return_to,
    })

    const result = await completeOAuthProviderConnection(access.admin, {
      providerFamily: "google",
      senderAccountId,
      mailboxConnectionId,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
      tokenExpiresAt,
      scopes: getGoogleOAuthScopes(),
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthGoogleOAuthFlow("mailbox_persisted", {
      userId: access.userId,
      senderId: senderAccountId,
      mailboxId: result.mailbox_connection_id,
      email: profile.email,
      provider: "google",
      connectionState: result.settings.status,
      settingsStatus: result.settings.status,
      returnTo: consumed.return_to,
    })

    logGrowthGoogleOAuthFlow("redirect_generated", {
      userId: access.userId,
      senderId: senderAccountId,
      mailboxId: result.mailbox_connection_id,
      email: profile.email,
      provider: "google",
      connectionState: "provider_connected=google",
      returnTo: consumed.return_to,
    })

    return redirectResult(request, consumed.return_to, { provider_connected: "google" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed"
    logGrowthGoogleOAuthFlow("oauth_callback_failed", {
      userId: access.userId,
      senderId: senderAccountId,
      mailboxId: mailboxConnectionId,
      provider: "google",
      connectionState: "persistence_failed",
      returnTo: consumed.return_to,
      error: message.slice(0, 200),
    })
    logGrowthGoogleOAuthFlow("redirect_generated", {
      userId: access.userId,
      senderId: senderAccountId,
      mailboxId: mailboxConnectionId,
      provider: "google",
      connectionState: "provider_error",
      returnTo: consumed.return_to,
      error: message.slice(0, 200),
    })
    return redirectResult(request, consumed.return_to, { provider_error: message.slice(0, 200) })
  }
}
