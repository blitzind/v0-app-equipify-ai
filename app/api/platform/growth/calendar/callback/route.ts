import { NextRequest, NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { verifyGrowthCalendarOAuthState } from "@/lib/growth/calendar/calendar-oauth-state"
import {
  exchangeGrowthGoogleCalendarCode,
} from "@/lib/growth/calendar/google-calendar-oauth"
import { fetchGoogleAccountProfile } from "@/lib/growth/calendar/google-calendar-client"
import { upsertGrowthCalendarConnection } from "@/lib/growth/calendar/calendar-connection-repository"
import { growthGoogleCalendarOAuthConfigured, getGrowthGoogleCalendarScopes } from "@/lib/growth/calendar/google-calendar-env"

export const runtime = "nodejs"

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function redirectResult(request: NextRequest, returnTo: string, search: Record<string, string>) {
  const u = new URL(returnTo, request.nextUrl.origin)
  for (const [key, value] of Object.entries(search)) {
    u.searchParams.set(key, value)
  }
  return NextResponse.redirect(u.toString())
}

export async function GET(request: NextRequest) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const returnTo = "/admin/growth/settings"
  const oauthError = request.nextUrl.searchParams.get("error")
  if (oauthError) {
    return redirectResult(request, returnTo, { calendar_error: oauthError })
  }

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  if (!code || !state) {
    return redirectResult(request, returnTo, { calendar_error: "missing_code_or_state" })
  }

  if (!growthGoogleCalendarOAuthConfigured()) {
    return redirectResult(request, returnTo, { calendar_error: "not_configured" })
  }

  const payload = verifyGrowthCalendarOAuthState(state, STATE_MAX_AGE_MS)
  if (!payload || payload.userId !== access.userId) {
    return redirectResult(request, returnTo, { calendar_error: "invalid_state" })
  }

  try {
    const tokens = await exchangeGrowthGoogleCalendarCode(code)
    const profile = await fetchGoogleAccountProfile(tokens.access_token)
    const accountType = profile.hostedDomain ? "workspace" : profile.email ? "personal" : "unknown"
    const accessTokenExpiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()

    await upsertGrowthCalendarConnection(access.admin, {
      userId: access.userId,
      accountEmail: profile.email,
      accountType,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
      accessTokenExpiresAt,
      scopes: getGrowthGoogleCalendarScopes(),
    })

    return redirectResult(request, payload.returnTo, { calendar_connected: "1" })
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_exchange_failed"
    return redirectResult(request, payload.returnTo, { calendar_error: encodeURIComponent(message.slice(0, 200)) })
  }
}
