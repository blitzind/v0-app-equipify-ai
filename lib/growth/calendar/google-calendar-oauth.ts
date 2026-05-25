import "server-only"

import {
  getGrowthGoogleCalendarClientId,
  getGrowthGoogleCalendarClientSecret,
  getGrowthGoogleCalendarRedirectUri,
  getGrowthGoogleCalendarScopes,
} from "@/lib/growth/calendar/google-calendar-env"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const REVOKE_URL = "https://oauth2.googleapis.com/revoke"

export type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
}

export function buildGrowthGoogleCalendarAuthorizeUrl(params: { state: string }): string {
  const u = new URL(AUTH_URL)
  u.searchParams.set("client_id", getGrowthGoogleCalendarClientId())
  u.searchParams.set("redirect_uri", getGrowthGoogleCalendarRedirectUri())
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", getGrowthGoogleCalendarScopes().join(" "))
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", "consent")
  u.searchParams.set("include_granted_scopes", "true")
  u.searchParams.set("state", params.state)
  return u.toString()
}

export async function exchangeGrowthGoogleCalendarCode(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getGrowthGoogleCalendarRedirectUri(),
    client_id: getGrowthGoogleCalendarClientId(),
    client_secret: getGrowthGoogleCalendarClientSecret(),
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const json = (await res.json()) as GoogleTokenResponse & { error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Token exchange failed (${res.status})`)
  }
  if (!json.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke prior access and reconnect with consent.")
  }
  return json
}

export async function refreshGrowthGoogleCalendarAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getGrowthGoogleCalendarClientId(),
    client_secret: getGrowthGoogleCalendarClientSecret(),
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const json = (await res.json()) as GoogleTokenResponse & { error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Token refresh failed (${res.status})`)
  }
  return json
}

export async function revokeGrowthGoogleCalendarToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token })
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => undefined)
}
