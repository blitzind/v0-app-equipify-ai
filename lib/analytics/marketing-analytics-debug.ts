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
