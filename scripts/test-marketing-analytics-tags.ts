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
  EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO,
  getGoogleAdsSignupSendTo,
  readMarketingPublicEnvForServerScript,
} from "../lib/analytics/marketing-analytics-config"

assert.equal(EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID, "G-YZMS47H63H")
assert.equal(EQUIPIFY_MARKETING_GOOGLE_ADS_ID, "AW-18160904774")
assert.equal(
  EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO,
  "AW-18160904774/0J7wCMeXtqwcEMbU5dND",
)

assert.equal(
  readMarketingPublicEnvForServerScript().signupSendTo,
  EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO,
)

const prevSignupSendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO
delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO
assert.equal(getGoogleAdsSignupSendTo(), EQUIPIFY_MARKETING_GOOGLE_ADS_SIGNUP_SEND_TO)
process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO = "off"
assert.equal(getGoogleAdsSignupSendTo(), null)
if (prevSignupSendTo) {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO = prevSignupSendTo
} else {
  delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO
}

const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")
assert.match(layoutSource, /<script async src=\{gtagLoaderSrc\} \/>/)
assert.match(layoutSource, /id="equipify-google-gtag-config"/)
assert.match(layoutSource, /googletagmanager\.com\/gtag\/js\?id=\$\{EQUIPIFY_MARKETING_GA4_MEASUREMENT_ID\}/)
assert.match(layoutSource, /gtag\('config', '\$\{ga4Id\}'/)
assert.match(layoutSource, /gtag\('config', '\$\{adsId\}'/)
assert.match(layoutSource, /0J7wCMeXtqwcEMbU5dND|readMarketingPublicEnvForServerScript/)
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

const eventsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/analytics/marketing-analytics-events.ts"),
  "utf8",
)
assert.match(eventsSource, /trackOnboardingCompleted/)
assert.match(eventsSource, /gtag\("event", "conversion"/)
assert.match(eventsSource, /0J7wCMeXtqwcEMbU5dND|getGoogleAdsSignupSendTo/)
assert.match(eventsSource, /fireGoogleAdsSignupConversionOnceWithSettle/)

const onboardingPage = fs.readFileSync(
  path.join(process.cwd(), "app/(auth)/onboarding/page.tsx"),
  "utf8",
)
assert.match(onboardingPage, /trackOnboardingCompleted/)
assert.doesNotMatch(onboardingPage, /trackOnboardingCompleted[\s\S]{0,120}useEffect/)

console.log("marketing-analytics-tags: all checks passed")
