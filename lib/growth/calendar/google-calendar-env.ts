const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
]

export function getGrowthGoogleCalendarClientId(): string {
  const id = process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_ID?.trim()
  if (!id) throw new Error("GROWTH_GOOGLE_CALENDAR_CLIENT_ID is not configured.")
  return id
}

export function getGrowthGoogleCalendarClientSecret(): string {
  const secret = process.env.GROWTH_GOOGLE_CALENDAR_CLIENT_SECRET?.trim()
  if (!secret) throw new Error("GROWTH_GOOGLE_CALENDAR_CLIENT_SECRET is not configured.")
  return secret
}

export function getGrowthGoogleCalendarRedirectUri(): string {
  const uri = process.env.GROWTH_GOOGLE_CALENDAR_REDIRECT_URI?.trim()
  if (!uri) throw new Error("GROWTH_GOOGLE_CALENDAR_REDIRECT_URI is not configured.")
  return uri
}

export function growthGoogleCalendarOAuthConfigured(): boolean {
  try {
    getGrowthGoogleCalendarClientId()
    getGrowthGoogleCalendarClientSecret()
    getGrowthGoogleCalendarRedirectUri()
    return Boolean(process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim())
  } catch {
    return false
  }
}

export function getGrowthGoogleCalendarScopes(): string[] {
  const raw = process.env.GROWTH_GOOGLE_CALENDAR_SCOPES?.trim()
  if (!raw) return DEFAULT_SCOPES
  return raw.split(/\s+/).filter(Boolean)
}
