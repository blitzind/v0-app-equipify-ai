/**
 * Regression checks for Google Ads + GA4 base tags on app.equipify.ai.
 * Run: pnpm test:marketing-analytics-tags
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID,
  EQUIPIFY_MARKETING_GOOGLE_ADS_ID,
} from "../lib/analytics/marketing-analytics-config"

assert.equal(EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID, "G-YZMS47H63H")
assert.equal(EQUIPIFY_MARKETING_GOOGLE_ADS_ID, "AW-18160904774")

const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")
assert.match(layoutSource, /<script async src=\{gtagLoaderSrc\} \/>/)
assert.match(layoutSource, /id="equipify-google-gtag-config"/)
assert.match(layoutSource, /googletagmanager\.com\/gtag\/js\?id=\$\{EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID\}/)
assert.match(layoutSource, /gtag\('config', '\$\{ga4Id\}'/)
assert.match(layoutSource, /gtag\('config', '\$\{adsId\}'/)
assert.match(layoutSource, /data-equipify-app-build-marker=\{EQUIPIFY_APP_BUILD_MARKER\}/)
assert.match(layoutSource, /EQUIPIFY_APP_BUILD_MARKER = 'google-tags-debug-v2'/)
assert.match(layoutSource, /data-google-tags-debug=\{GOOGLE_TAGS_DEBUG_ATTR\}/)
assert.doesNotMatch(layoutSource, /GoogleAnalyticsTags/)
assert.doesNotMatch(layoutSource, /MarketingGtagServerScripts/)
assert.doesNotMatch(layoutSource, /isMarketingAnalyticsEnabledFromServerEnv/)
assert.doesNotMatch(layoutSource, /from 'next\/script'/)
assert.doesNotMatch(layoutSource, /afterInteractive/)

const dashboardAlias = fs.readFileSync(
  path.join(process.cwd(), "app/dashboard/page.tsx"),
  "utf8",
)
assert.match(dashboardAlias, /redirect\('\/'\)/)

const providersSource = fs.readFileSync(
  path.join(process.cwd(), "components/global-providers.tsx"),
  "utf8",
)
assert.match(providersSource, /MarketingAnalyticsProvider/)

console.log("marketing-analytics-tags: all checks passed")
