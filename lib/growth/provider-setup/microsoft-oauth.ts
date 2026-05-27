
const AUTH_URL = "https://login.microsoftonline.com"
const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"

const DEFAULT_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
]

export type MicrosoftMailboxTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
}

export function getMicrosoftTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common"
}

export function getMicrosoftOAuthClientId(): string | null {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || null
}

export function getMicrosoftOAuthClientSecret(): string | null {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || null
}

export function getMicrosoftOAuthRedirectUri(): string | null {
  return process.env.MICROSOFT_REDIRECT_URI?.trim() || null
}

export function getMicrosoftOAuthScopes(): string[] {
  const raw = process.env.MICROSOFT_OAUTH_SCOPES?.trim()
  if (!raw) return DEFAULT_SCOPES
  return raw.split(/\s+/).filter(Boolean)
}

export function microsoftProviderOAuthConfigured(): boolean {
  return Boolean(
    getMicrosoftOAuthClientId() &&
      getMicrosoftOAuthClientSecret() &&
      getMicrosoftOAuthRedirectUri() &&
      process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim(),
  )
}

export function microsoftProviderOAuthEnvWarnings(): string[] {
  const warnings: string[] = []
  if (!getMicrosoftOAuthClientId()) warnings.push("MICROSOFT_CLIENT_ID is not configured.")
  if (!getMicrosoftOAuthClientSecret()) warnings.push("MICROSOFT_CLIENT_SECRET is not configured.")
  if (!getMicrosoftOAuthRedirectUri()) warnings.push("MICROSOFT_REDIRECT_URI is not configured.")
  if (!process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim()) {
    warnings.push("INTEGRATION_OAUTH_STATE_SECRET is required for OAuth state signing.")
  }
  return warnings
}

export function buildMicrosoftProviderAuthorizeUrl(params: { state: string }): string {
  const clientId = getMicrosoftOAuthClientId()
  const redirectUri = getMicrosoftOAuthRedirectUri()
  if (!clientId || !redirectUri) throw new Error("Microsoft OAuth is not configured.")

  const u = new URL(`${AUTH_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`)
  u.searchParams.set("client_id", clientId)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", getMicrosoftOAuthScopes().join(" "))
  u.searchParams.set("response_mode", "query")
  u.searchParams.set("state", params.state)
  return u.toString()
}

export async function exchangeMicrosoftProviderOAuthCode(code: string): Promise<MicrosoftMailboxTokenResponse> {
  const clientId = getMicrosoftOAuthClientId()
  const clientSecret = getMicrosoftOAuthClientSecret()
  const redirectUri = getMicrosoftOAuthRedirectUri()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Microsoft OAuth is not configured.")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    scope: getMicrosoftOAuthScopes().join(" "),
  })

  const res = await fetch(`${AUTH_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = (await res.json()) as MicrosoftMailboxTokenResponse & {
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Microsoft token exchange failed (${res.status})`)
  }
  return json
}

export async function refreshMicrosoftProviderAccessToken(
  refreshToken: string,
): Promise<MicrosoftMailboxTokenResponse> {
  const clientId = getMicrosoftOAuthClientId()
  const clientSecret = getMicrosoftOAuthClientSecret()
  if (!clientId || !clientSecret) throw new Error("Microsoft OAuth is not configured.")

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: getMicrosoftOAuthScopes().join(" "),
  })

  const res = await fetch(`${AUTH_URL}/${getMicrosoftTenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = (await res.json()) as MicrosoftMailboxTokenResponse & {
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `Microsoft token refresh failed (${res.status})`)
  }
  return json
}

export async function fetchMicrosoftProviderAccountProfile(accessToken: string): Promise<{
  email: string
  displayName: string | null
}> {
  const res = await fetch(GRAPH_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Microsoft profile fetch failed (${res.status})`)
  }
  const email = json.mail ?? json.userPrincipalName
  if (!email) throw new Error("Microsoft profile did not include an email address.")
  return { email, displayName: json.displayName ?? null }
}
