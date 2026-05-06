import { getQuickBooksClientId, getQuickBooksRedirectUri } from "@/lib/integrations/quickbooks-env"

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const DEFAULT_SCOPE = "com.intuit.quickbooks.accounting"

export function buildQuickBooksAuthorizeUrl(params: { state: string }): string {
  const clientId = getQuickBooksClientId()
  const redirectUri = getQuickBooksRedirectUri()
  const u = new URL(AUTH_URL)
  u.searchParams.set("client_id", clientId)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", DEFAULT_SCOPE)
  u.searchParams.set("state", params.state)
  return u.toString()
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in?: number
  token_type: string
}

export async function exchangeQuickBooksAuthorizationCode(code: string): Promise<TokenResponse> {
  const clientId = getQuickBooksClientId()
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? ""
  const redirectUri = getQuickBooksRedirectUri()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string }
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Token exchange failed (${res.status})`)
  }
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Token response missing access or refresh token.")
  }
  return json as TokenResponse
}

/** Refresh access token (Intuit may rotate the refresh token). */
export async function refreshQuickBooksAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = getQuickBooksClientId()
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? ""
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string }
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Token refresh failed (${res.status})`)
  }
  if (!json.access_token) {
    throw new Error("Refresh response missing access token.")
  }
  if (!json.refresh_token) {
    throw new Error("Refresh response missing refresh token.")
  }
  return json as TokenResponse
}
