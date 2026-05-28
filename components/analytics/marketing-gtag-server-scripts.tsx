import Script from "next/script"
import {
  EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
  getLinkerDomains,
  isMarketingAnalyticsEnabledFromServerEnv,
  readMarketingPublicEnvForServerScript,
} from "@/lib/analytics/marketing-analytics-config"

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
  return lines.join(";")
}

/**
 * Emits gtag from the **root Server Component** so tags exist on every route (auth,
 * onboarding, login, dashboard, etc.) without depending on client-only `next/script`
 * injection or post-hydration config for Tag Assistant discovery.
 */
export function MarketingGtagServerScripts() {
  if (!isMarketingAnalyticsEnabledFromServerEnv()) {
    return null
  }

  const env = readMarketingPublicEnvForServerScript()
  const loaderId = env.ga4Id || env.googleAdsId
  if (!loaderId) return null

  return (
    <>
      <script
        // Runs synchronously when parsed so `window.gtag` + destination config exist before React hydrates.
        dangerouslySetInnerHTML={{ __html: buildServerGtagBootstrap() }}
      />
      <Script
        id="equipify-marketing-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`}
        strategy="afterInteractive"
      />
    </>
  )
}

/** QA / regression helpers — not for product UI. */
export const MARKETING_GTAG_EXPECTED_IDS = {
  ga4: EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  googleAds: EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
} as const
