import {
  EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
  getLinkerDomains,
  isMarketingAnalyticsEnabledFromServerEnv,
  readMarketingPublicEnvForServerScript,
} from "@/lib/analytics/marketing-analytics-config"

/** Temporary deploy verification marker — safe in HTML, no secrets. */
export const EQUIPIFY_GOOGLE_TAGS_QA_MARKER = "app-subdomain-v1" as const

function buildServerGtagBootstrap(): string {
  const env = readMarketingPublicEnvForServerScript()
  const envJson = JSON.stringify(env)
  const linkerDomains = getLinkerDomains()
  const useEquipifyCookieDomain =
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")

  const configPayload: Record<string, unknown> = {
    send_page_view: false,
    linker: { domains: linkerDomains },
  }
  if (useEquipifyCookieDomain) {
    configPayload.cookie_domain = ".equipify.ai"
    configPayload.cookie_flags = "SameSite=None;Secure"
  }
  const configJson = JSON.stringify(configPayload)

  const lines = [
    `window.__EQUIPIFY_MARKETING_ENV__=${envJson}`,
    "window.dataLayer=window.dataLayer||[]",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag",
    "gtag('js',new Date())",
  ]

  if (env.ga4Id) {
    lines.push(`gtag('config','${env.ga4Id}',${configJson})`)
  }
  if (env.googleAdsId && env.googleAdsId !== env.ga4Id) {
    lines.push(`gtag('config','${env.googleAdsId}',${configJson})`)
  } else if (env.googleAdsId && !env.ga4Id) {
    lines.push(`gtag('config','${env.googleAdsId}',${configJson})`)
  }

  lines.push("window.__EQUIPIFY_MARKETING_GTAG_CONFIGURED__=true")

  if (env.analyticsDebug === "1") {
    lines.push(
      "console.info('[equipify-analytics]','gtag bootstrap (server HTML)',{ga4Id:" +
        JSON.stringify(env.ga4Id) +
        ",googleAdsId:" +
        JSON.stringify(env.googleAdsId) +
        ",marker:" +
        JSON.stringify(EQUIPIFY_GOOGLE_TAGS_QA_MARKER) +
        "})",
    )
  }

  return lines.join(";")
}

/**
 * Emits the standard Google gtag snippet from the **root Server Component `<head>`**
 * so Tag Assistant and View Source see both `gtag/js` and inline `gtag('config', …)`
 * on the initial HTML response (auth, onboarding, dashboard, etc.).
 *
 * Not gated on NODE_ENV, consent, pathname, or session — only disabled when both
 * public measurement IDs resolve to off/empty via env overrides.
 */
export function MarketingGtagServerScripts() {
  if (!isMarketingAnalyticsEnabledFromServerEnv()) {
    return null
  }

  const env = readMarketingPublicEnvForServerScript()
  const loaderId = env.ga4Id || env.googleAdsId
  if (!loaderId) return null

  const loaderSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`

  return (
    <>
      <script async src={loaderSrc} />
      <script
        id="equipify-marketing-gtag-bootstrap"
        dangerouslySetInnerHTML={{ __html: buildServerGtagBootstrap() }}
      />
    </>
  )
}

/** QA / regression helpers — not for product UI. */
export const MARKETING_GTAG_EXPECTED_IDS = {
  ga4: EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  googleAds: EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
} as const
