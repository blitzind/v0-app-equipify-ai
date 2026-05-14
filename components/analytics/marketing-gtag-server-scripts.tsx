import Script from "next/script"
import {
  isMarketingAnalyticsEnabledFromServerEnv,
  readMarketingPublicEnvForServerScript,
} from "@/lib/analytics/marketing-analytics-config"

/**
 * Emits gtag from the **root Server Component** so tags exist on every route (auth,
 * onboarding, login, etc.) without depending on client-only `next/script` injection.
 * Also defines `window.__EQUIPIFY_MARKETING_ENV__` for client modules to read the same
 * IDs as were present when this HTML was generated.
 */
export function MarketingGtagServerScripts() {
  if (!isMarketingAnalyticsEnabledFromServerEnv()) {
    return null
  }

  const env = readMarketingPublicEnvForServerScript()
  const loaderId = env.ga4Id || env.googleAdsId
  if (!loaderId) return null

  const envJson = JSON.stringify(env)
  const inlineBootstrap = `window.__EQUIPIFY_MARKETING_ENV__=${envJson};window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());`

  return (
    <>
      <script
        // Runs synchronously when parsed so `window.gtag` exists before React hydrates.
        dangerouslySetInnerHTML={{ __html: inlineBootstrap }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`}
        strategy="afterInteractive"
      />
    </>
  )
}
