/**
 * Server- and client-safe reads of public marketing analytics env vars.
 * IDs are optional in dev; scripts and events no-op when unset.
 */

function trimEnv(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

export function getGa4MeasurementId(): string | null {
  return trimEnv(process.env.NEXT_PUBLIC_GA4_ID)
}

export function getGoogleAdsId(): string | null {
  return trimEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
}

/**
 * Full Google Ads conversion `send_to` value, e.g. `AW-18160904774/AbCdEfGhIj`.
 * Optional: when unset, GA4 events still fire but the Ads `conversion` event is skipped.
 */
export function getGoogleAdsSignupSendTo(): string | null {
  return trimEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO)
}

export function isMarketingAnalyticsDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1"
}

export function isMarketingAnalyticsEnabled(): boolean {
  return Boolean(getGa4MeasurementId() || getGoogleAdsId())
}

/**
 * Cookie domain for cross-subdomain continuity (marketing site + app).
 * Defaults to `.equipify.ai` when hostname matches; override via env for previews.
 */
export function resolveMarketingCookieDomain(hostname: string | null | undefined): string | undefined {
  const fromEnv = trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_COOKIE_DOMAIN)
  if (fromEnv) return fromEnv === "auto" ? undefined : fromEnv
  if (!hostname) return undefined
  if (hostname === "localhost" || hostname.endsWith(".local")) return undefined
  if (hostname.endsWith("equipify.ai")) return ".equipify.ai"
  return undefined
}

export function getLinkerDomains(): string[] {
  const raw = trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS)
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return ["www.equipify.ai", "app.equipify.ai", "equipify.ai"]
}
