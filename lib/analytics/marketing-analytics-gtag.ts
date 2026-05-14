import {
  getGa4MeasurementId,
  getGoogleAdsId,
  resolveMarketingCookieDomain,
  getLinkerDomains,
  isMarketingAnalyticsEnabled,
} from "@/lib/analytics/marketing-analytics-config"
import { marketingAnalyticsDebug } from "@/lib/analytics/marketing-analytics-debug"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    __EQUIPIFY_MARKETING_GTAG_CONFIGURED__?: boolean
  }
}

export type MarketingGtagConfigPayload = {
  ga4Id: string | null
  adsId: string | null
  cookieDomain: string | undefined
  linkerDomains: string[]
}

export function getMarketingGtagLoaderId(): string | null {
  const ga = getGa4MeasurementId()
  const ads = getGoogleAdsId()
  return ga ?? ads
}

export function buildMarketingGtagConfigPayload(): MarketingGtagConfigPayload | null {
  if (!isMarketingAnalyticsEnabled()) return null
  const hostname = typeof window !== "undefined" ? window.location.hostname : null
  return {
    ga4Id: getGa4MeasurementId(),
    adsId: getGoogleAdsId(),
    cookieDomain: resolveMarketingCookieDomain(hostname),
    linkerDomains: getLinkerDomains(),
  }
}

function baseConfig(cookieDomain: string | undefined, linkerDomains: string[]) {
  const linker = { domains: linkerDomains }
  if (cookieDomain) {
    return {
      cookie_domain: cookieDomain,
      cookie_flags: "SameSite=None;Secure",
      linker,
      send_page_view: false,
    } as const
  }
  return {
    linker,
    send_page_view: false,
  } as const
}

/**
 * Runs in the browser after gtag.js is available. Idempotent per tab.
 */
export function configureMarketingGtagOnce(payload: MarketingGtagConfigPayload) {
  if (typeof window === "undefined") return
  if (window.__EQUIPIFY_MARKETING_GTAG_CONFIGURED__) return
  const gtag = window.gtag
  if (typeof gtag !== "function") {
    marketingAnalyticsDebug("configure skipped: gtag missing")
    return
  }

  const common = baseConfig(payload.cookieDomain, payload.linkerDomains)

  if (payload.ga4Id) {
    gtag("config", payload.ga4Id, { ...common })
    marketingAnalyticsDebug("gtag config GA4", payload.ga4Id, common)
  }

  if (payload.adsId) {
    if (payload.adsId !== payload.ga4Id) {
      gtag("config", payload.adsId, { ...common })
      marketingAnalyticsDebug("gtag config Ads", payload.adsId, common)
    } else if (!payload.ga4Id) {
      gtag("config", payload.adsId, { ...common })
      marketingAnalyticsDebug("gtag config Ads-only", payload.adsId, common)
    }
  }

  window.__EQUIPIFY_MARKETING_GTAG_CONFIGURED__ = true
  marketingAnalyticsDebug("gtag configure complete")
}

export function marketingGtagPageView(pagePath: string, pageTitle?: string) {
  if (typeof window === "undefined") return
  const gtag = window.gtag
  if (typeof gtag !== "function") {
    marketingAnalyticsDebug("page_view skipped: gtag missing", pagePath)
    return
  }
  const page_location = window.location.href
  const page_path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`
  gtag("event", "page_view", {
    page_path,
    page_location,
    page_title: pageTitle ?? document.title,
  })
  marketingAnalyticsDebug("page_view", { page_path, page_location })
}
