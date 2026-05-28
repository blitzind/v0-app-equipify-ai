/**
 * Google Ads (AW-…) + GA4 (G-…) base tags for app.equipify.ai.
 *
 * Mirrors the marketing site's gtag destinations so Tag Assistant, GA4, and Google Ads
 * can measure trial signup/onboarding on the app subdomain (cross-domain linker + shared
 * cookie domain when deployed on *.equipify.ai).
 *
 * Conversion events remain in `lib/analytics/marketing-analytics-events.ts` — this module
 * only loads/configures the shared tag bootstrap.
 */
export { MarketingGtagServerScripts as GoogleAnalyticsTags } from "@/components/analytics/marketing-gtag-server-scripts"
