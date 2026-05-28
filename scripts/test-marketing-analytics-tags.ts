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
  isMarketingAnalyticsEnabledFromServerEnv,
  readMarketingPublicEnvForServerScript,
} from "../lib/analytics/marketing-analytics-config"
import {
  EQUIPIFY_GOOGLE_TAGS_QA_MARKER,
  MARKETING_GTAG_EXPECTED_IDS,
} from "../components/analytics/marketing-gtag-server-scripts"

assert.equal(EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID, "G-YZMS47H63H")
assert.equal(EQUIPIFY_MARKETING_GOOGLE_ADS_ID, "AW-18160904774")
assert.equal(MARKETING_GTAG_EXPECTED_IDS.ga4, "G-YZMS47H63H")
assert.equal(MARKETING_GTAG_EXPECTED_IDS.googleAds, "AW-18160904774")
assert.equal(EQUIPIFY_GOOGLE_TAGS_QA_MARKER, "app-subdomain-v1")

const env = readMarketingPublicEnvForServerScript()
assert.equal(env.ga4Id, "G-YZMS47H63H")
assert.equal(env.googleAdsId, "AW-18160904774")
assert.equal(isMarketingAnalyticsEnabledFromServerEnv(), true)

const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")
assert.match(layoutSource, /GoogleAnalyticsTags/)
assert.match(layoutSource, /<head>/)
assert.match(layoutSource, /<head>[\s\S]*<GoogleAnalyticsTags \/>[\s\S]*<\/head>/)
assert.match(layoutSource, /data-equipify-google-tags=\{EQUIPIFY_GOOGLE_TAGS_QA_MARKER\}/)

const gtagSource = fs.readFileSync(
  path.join(process.cwd(), "components/analytics/marketing-gtag-server-scripts.tsx"),
  "utf8",
)
assert.match(gtagSource, /gtag\('config'/)
assert.match(gtagSource, /googletagmanager\.com\/gtag\/js/)
assert.match(gtagSource, /__EQUIPIFY_MARKETING_GTAG_CONFIGURED__/)
assert.match(gtagSource, /<script async src=\{loaderSrc\} \/>/)
assert.doesNotMatch(gtagSource, /from "next\/script"/)
assert.doesNotMatch(gtagSource, /afterInteractive/)
assert.match(gtagSource, /EQUIPIFY_GOOGLE_TAGS_QA_MARKER/)
assert.match(gtagSource, /analyticsDebug === "1"/)
assert.match(gtagSource, /if \(!isMarketingAnalyticsEnabledFromServerEnv\(\)\)/)
assert.doesNotMatch(gtagSource, /if \(process\.env\.NODE_ENV !== "production"\)/)

const wrapperSource = fs.readFileSync(
  path.join(process.cwd(), "components/analytics/google-analytics-tags.tsx"),
  "utf8",
)
assert.match(wrapperSource, /Google Ads/)
assert.match(wrapperSource, /GA4/)

const providersSource = fs.readFileSync(
  path.join(process.cwd(), "components/global-providers.tsx"),
  "utf8",
)
assert.match(providersSource, /MarketingAnalyticsProvider/)
assert.doesNotMatch(providersSource, /MarketingGtagServerScripts/)

console.log("marketing-analytics-tags: all checks passed")
