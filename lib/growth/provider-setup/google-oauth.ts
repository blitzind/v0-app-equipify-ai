
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
]

export type GoogleMailboxTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
}

export function getGoogleOAuthClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null
}

export function getGoogleOAuthClientSecret(): string | null {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || null
}

export function getGoogleOAuthRedirectUri(): string | null {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || null
}

export function getGoogleOAuthScopes(): string[] {
  const raw = process.env.GOOGLE_OAUTH_SCOPES?.trim()
  if (!raw) return DEFAULT_SCOPES
  return raw.split(/\s+/).filter(Boolean)
}

export function googleProviderOAuthConfigured(): boolean {
  return Boolean(
    getGoogleOAuthClientId() &&
      getGoogleOAuthClientSecret() &&
      getGoogleOAuthRedirectUri() &&
      process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim(),
  )
}

export function googleProviderOAuthEnvWarnings(): string[] {
  const warnings: string[] = []
  if (!getGoogleOAuthClientId()) warnings.push("GOOGLE_CLIENT_ID is not configured.")
  if (!getGoogleOAuthClientSecret()) warnings.push("GOOGLE_CLIENT_SECRET is not configured.")
  if (!getGoogleOAuthRedirectUri()) warnings.push("GOOGLE_REDIRECT_URI is not configured.")
  if (!process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim()) {
    warnings.push("INTEGRATION_OAUTH_STATE_SECRET is required for OAuth state signing.")
  }
  return warnings
}

export function buildGoogleProviderAuthorizeUrl(params: { state: string; loginHint?: string | null }): string {
  const clientId = getGoogleOAuthClientId()
  const redirectUri = getGoogleOAuthRedirectUri()
  if (!clientId || !redirectUri) {
    throw new Error("Google OAuth is not configured.")
  }
  const u = new URL(AUTH_URL)
  u.searchParams.set("client_id", clientId)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", getGoogleOAuthScopes().join(" "))
  u.searchParams.set("access_type", "offline")
  u.searchParams.set("prompt", "consent")
  u.searchParams.set("include_granted_scopes", "true")
  u.searchParams.set("state", params.state)
  const loginHint = params.loginHint?.trim()
  if (loginHint) u.searchParams.set("login_hint", loginHint)
  return u.toString()
}

export async function exchangeGoogleProviderOAuthCode(code: string): Promise<GoogleMailboxTokenResponse> {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  const redirectUri = getGoogleOAuthRedirectUri()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured.")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = (await res.json()) as GoogleMailboxTokenResponse & { error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Google token exchange failed (${res.status})`)
  }
  if (!json.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke prior access and reconnect with consent.")
  }
  return json
}

export async function refreshGoogleProviderAccessToken(
  refreshToken: string,
): Promise<GoogleMailboxTokenResponse> {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.")

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = (await res.json()) as GoogleMailboxTokenResponse & { error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Google token refresh failed (${res.status})`)
  }
  return json
}

export async function fetchGoogleProviderAccountProfile(accessToken: string): Promise<{
  email: string
  hostedDomain: string | null
}> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as { email?: string; hd?: string; error?: string }
  if (!res.ok || !json.email) {
    throw new Error(json.error ?? `Google profile fetch failed (${res.status})`)
  }
  return { email: json.email, hostedDomain: json.hd ?? null }
}
