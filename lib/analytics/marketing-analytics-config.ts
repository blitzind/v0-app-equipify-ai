/**
 * Server- and client-safe reads of public marketing analytics env vars.
 * Public measurement IDs match www.equipify.ai (Google Ads + GA4) for cross-subdomain
 * trial/signup attribution on app.equipify.ai. Override via `NEXT_PUBLIC_*` when needed.
 *
 * On the client, values prefer `window.__EQUIPIFY_MARKETING_ENV__` (injected from the
 * root Server Component) so Tag Assistant and events stay aligned with the HTML that
 * was rendered for this deployment, even when client-bundle inlining of `NEXT_PUBLIC_*`
 * differs from the server.
 */

/** Same GA4 property as the marketing site — public measurement ID. */
export const EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID = "G-YZMS47H63H" as const

/** Same Google Ads destination as the marketing site — public tag ID. */
export const EQUIPIFY_MARKETING_GOOGLE_ADS_ID = "AW-18160904774" as const

/**
 * Google Ads "Free Trial Signup" conversion label — fires only after successful
 * onboarding completion via `trackOnboardingCompleted` (not on page load).
 */
export const EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO =
  "AW-18160904774/0J7wCMeXtqwcEMbU5dND" as const

export type EquipifyMarketingPublicEnv = {
  ga4Id: string | null
  googleAdsId: string | null
  signupSendTo: string | null
  analyticsDebug: string | null
  cookieDomainOverride: string | null
  linkerDomainsRaw: string | null
}

declare global {
  interface Window {
    __EQUIPIFY_MARKETING_ENV__?: EquipifyMarketingPublicEnv
  }
}

function trimEnv(value: string | undefined | null): string | null {
  const v = value?.trim()
  return v ? v : null
}

function resolvePublicMeasurementId(
  envValue: string | undefined,
  defaultId: string,
): string | null {
  const trimmed = trimEnv(envValue)
  if (trimmed === "0" || trimmed === "false" || trimmed === "off") return null
  return trimmed ?? defaultId
}

function resolveSignupSendTo(envValue: string | undefined): string | null {
  const trimmed = trimEnv(envValue)
  if (trimmed === "0" || trimmed === "false" || trimmed === "off") return null
  return trimmed ?? EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO
}

function publicEnvFromWindow(): EquipifyMarketingPublicEnv | null {
  if (typeof window === "undefined") return null
  const raw = window.__EQUIPIFY_MARKETING_ENV__
  if (!raw || typeof raw !== "object") return null
  return raw
}

/** Used by the root Server Component to serialize env into the HTML bootstrap script. */
export function readMarketingPublicEnvForServerScript(): EquipifyMarketingPublicEnv {
  return {
    ga4Id: resolvePublicMeasurementId(
      process.env.NEXT_PUBLIC_GA4_ID,
      EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
    ),
    googleAdsId: resolvePublicMeasurementId(
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
      EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
    ),
    signupSendTo: resolveSignupSendTo(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO),
    analyticsDebug: trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_DEBUG),
    cookieDomainOverride: trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_COOKIE_DOMAIN),
    linkerDomainsRaw: trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS),
  }
}

export function isMarketingAnalyticsEnabledFromServerEnv(): boolean {
  const e = readMarketingPublicEnvForServerScript()
  return Boolean(e.ga4Id || e.googleAdsId)
}

export function getGa4MeasurementId(): string | null {
  const w = publicEnvFromWindow()
  if (w?.ga4Id !== undefined) return trimEnv(w.ga4Id)
  return resolvePublicMeasurementId(process.env.NEXT_PUBLIC_GA4_ID, EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID)
}

export function getGoogleAdsId(): string | null {
  const w = publicEnvFromWindow()
  if (w?.googleAdsId !== undefined) return trimEnv(w.googleAdsId)
  return resolvePublicMeasurementId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, EQUIPIFY_MARKETING_GOOGLE_ADS_ID)
}

/**
 * Full Google Ads conversion `send_to` for the Free Trial Signup action.
 * Defaults to `EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO` when env is unset.
 * Set env to `off` to disable Ads conversion hits while keeping GA4 events.
 */
export function getGoogleAdsSignupSendTo(): string | null {
  const w = publicEnvFromWindow()
  if (w?.signupSendTo !== undefined) {
    const fromWindow = trimEnv(w.signupSendTo)
    if (fromWindow === "0" || fromWindow === "false" || fromWindow === "off") return null
    return fromWindow ?? EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO
  }
  return resolveSignupSendTo(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO)
}

export function isMarketingAnalyticsDebugEnabled(): boolean {
  const w = publicEnvFromWindow()
  if (trimEnv(w?.analyticsDebug ?? undefined) === "1") return true
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
  const w = publicEnvFromWindow()
  const fromEnv = trimEnv(w?.cookieDomainOverride ?? undefined) ?? trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_COOKIE_DOMAIN)
  if (fromEnv) return fromEnv === "auto" ? undefined : fromEnv
  if (!hostname) return undefined
  if (hostname === "localhost" || hostname.endsWith(".local")) return undefined
  if (hostname.endsWith("equipify.ai")) return ".equipify.ai"
  return undefined
}

export function getLinkerDomains(): string[] {
  const w = publicEnvFromWindow()
  const raw =
    trimEnv(w?.linkerDomainsRaw ?? undefined) ?? trimEnv(process.env.NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS)
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return ["www.equipify.ai", "app.equipify.ai", "equipify.ai"]
}
