import { isMarketingAnalyticsDebugEnabled } from "@/lib/analytics/marketing-analytics-config"

const PREFIX = "[equipify-analytics]"

export function marketingAnalyticsDebug(...args: unknown[]) {
  if (!isMarketingAnalyticsDebugEnabled()) return
  try {
    console.info(PREFIX, ...args)
  } catch {
    /* best-effort */
  }
}

/** Dev or `NEXT_PUBLIC_ANALYTICS_DEBUG=1` — onboarding funnel / redirect timing. */
export function onboardingAnalyticsDevLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "development" && !isMarketingAnalyticsDebugEnabled()) return
  try {
    console.info(`${PREFIX} onboarding`, ...args)
  } catch {
    /* best-effort */
  }
}
