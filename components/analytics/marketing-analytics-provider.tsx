"use client"

import Script from "next/script"
import { Suspense, useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  isMarketingAnalyticsDebugEnabled,
  isMarketingAnalyticsEnabled,
} from "@/lib/analytics/marketing-analytics-config"
import { marketingAnalyticsDebug } from "@/lib/analytics/marketing-analytics-debug"
import {
  buildMarketingGtagConfigPayload,
  configureMarketingGtagOnce,
  getMarketingGtagLoaderId,
  marketingGtagPageView,
} from "@/lib/analytics/marketing-analytics-gtag"
import { shouldSendMarketingPageView } from "@/lib/analytics/marketing-analytics-pageview-dedupe"
import { registerFutureMarketingPixels } from "@/lib/analytics/third-party-marketing-pixels"

/**
 * Loads gtag once, configures GA4 + Google Ads with cross-subdomain linker/cookies,
 * and tracks virtual `page_view` on App Router navigations (no default automatic pageviews).
 */
function MarketingAnalyticsRouteEffects() {
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const serializedSearch = useMemo(() => {
    const q = searchParams?.toString()
    return q ? `?${q}` : ""
  }, [searchParams])

  useEffect(() => {
    const payload = buildMarketingGtagConfigPayload()
    if (!payload) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 80

    const tryConfigure = () => {
      if (cancelled) return
      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        configureMarketingGtagOnce(payload)
        registerFutureMarketingPixels({ debug: isMarketingAnalyticsDebugEnabled() })
        return
      }
      attempts += 1
      if (attempts >= maxAttempts) {
        marketingAnalyticsDebug("gtag configure gave up: gtag never became available")
        return
      }
      window.setTimeout(tryConfigure, 25)
    }

    tryConfigure()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isMarketingAnalyticsEnabled()) return
    const fullPath = `${pathname}${serializedSearch}`
    if (!shouldSendMarketingPageView(fullPath)) {
      marketingAnalyticsDebug("page_view deduped", fullPath)
      return
    }
    marketingGtagPageView(fullPath)
  }, [pathname, serializedSearch])

  return null
}

export function MarketingAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const loaderId = getMarketingGtagLoaderId()

  if (!isMarketingAnalyticsEnabled()) {
    return <>{children}</>
  }

  return (
    <>
      <Script
        id="equipify-gtag-bootstrap"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());",
        }}
      />
      {loaderId ? (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`}
          strategy="afterInteractive"
        />
      ) : null}
      <Suspense fallback={null}>
        <MarketingAnalyticsRouteEffects />
      </Suspense>
      {children}
    </>
  )
}
