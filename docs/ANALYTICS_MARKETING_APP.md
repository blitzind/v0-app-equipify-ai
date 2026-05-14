# Marketing analytics (GA4 + Google Ads) on the app

This app mirrors the marketing stack used on [www.equipify.ai](https://www.equipify.ai) so sessions and conversions can be attributed when users land on the marketing site and complete signup on [app.equipify.ai](https://app.equipify.ai).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GA4_ID` | No* | GA4 measurement ID (`G-…`). |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | No* | Google Ads tag ID (`AW-…`). |
| `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO` | No | Full Ads conversion `send_to` value (`AW-…/label`). Without it, GA4 events still fire but the Ads `conversion` event is skipped. Copy the exact value from Google Ads → Goals → Conversions → Tag setup. |
| `NEXT_PUBLIC_ANALYTICS_COOKIE_DOMAIN` | No | Override first-party cookie domain. Default: `.equipify.ai` when the hostname ends with `equipify.ai`; omitted on `localhost`. |
| `NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS` | No | Comma-separated hostnames for `linker.domains` (cross-domain / subdomain measurement). Default: `www.equipify.ai,app.equipify.ai,equipify.ai`. |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | No | Set to `1` to log gtag init, SPA `page_view`, and conversion-related calls to the browser console. |

\*At least one of `NEXT_PUBLIC_GA4_ID` or `NEXT_PUBLIC_GOOGLE_ADS_ID` must be set for any scripts to load.

## Where code runs

- **Bootstrap + loader:** `components/analytics/marketing-analytics-provider.tsx` — `next/script` (inline gtag bootstrap + `gtag/js` loader, both `afterInteractive`). A short retry loop ensures `gtag('config', …)` runs after the bootstrap snippet is on the page.
- **Config (linker, cookie domain, `send_page_view: false`):** `lib/analytics/marketing-analytics-gtag.ts`
- **SPA page views:** same provider via `usePathname` / `useSearchParams`, with dedupe in `lib/analytics/marketing-analytics-pageview-dedupe.ts` to reduce duplicate fires under React Strict Mode.
- **Conversion and funnel events (client-only):** `lib/analytics/marketing-analytics-events.ts`

## Where conversions fire (intentionally strict)

Conversions and primary funnel events are **not** tied to page load, query strings, or “success” URL patterns alone.

They run only after the server confirms success:

| Event / action | When it fires |
|----------------|----------------|
| `trackOnboardingCompleted` → GA4 `sign_up`, `onboarding_completed`, optional Ads `conversion` | Immediately after a successful `POST /api/invites/accept` or `POST /api/onboarding/provision` in `app/(auth)/onboarding/page.tsx` (`finalizeOnboarding`), with a parsed `organizationId`. |
| `trackFreeTrialSignup` → GA4 `free_trial_signup` | Same success path, **only** for self-serve provisioning (`completionFlow === "self_serve"`), i.e. when the trial subscription is bootstrapped server-side. |

Client-side deduplication uses `sessionStorage` keys so refresh/retry in the same tab does not double-send the same completion.

Google Ads `conversion` is fired **once per user + organization** from `trackOnboardingCompleted` only (invite or self-serve), so it is not duplicated when `trackFreeTrialSignup` runs afterward.

## Cross-subdomain attribution

- gtag is configured with `linker: { domains: [...] }` and, on `*.equipify.ai`, `cookie_domain: '.equipify.ai'` and `cookie_flags: 'SameSite=None;Secure'` so first-party measurement can span `www` and `app`.
- The marketing site should use the **same** GA4 property and compatible Ads linking as documented in Google’s cross-domain / subdomain guidance.

## CSP

If you add a Content-Security-Policy, allow at least:

- `script-src` / `connect-src`: `https://www.googletagmanager.com`, `https://www.google-analytics.com` (and any region hosts Google assigns for your property).

`next.config.mjs` in this repo does not set CSP by default.

## Future pixels

Use `lib/analytics/third-party-marketing-pixels.ts` and invoke `registerFutureMarketingPixels` from `MarketingAnalyticsProvider` when adding Meta, Clarity, or LinkedIn tags so loading stays centralized.

## Manual QA

1. Set `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, and optionally `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO` in `.env.local`.
2. Set `NEXT_PUBLIC_ANALYTICS_DEBUG=1`, run the app, open DevTools → Console; filter `equipify-analytics`.
3. Navigate between routes: confirm a `page_view` log per navigation without double bursts on a single navigation (Strict Mode may still mount twice in dev; dedupe should collapse identical path+search within ~450ms).
4. Complete onboarding on a test account: confirm logs for `GA4 sign_up + onboarding_completed`, `GA4 free_trial_signup` (self-serve only), and `Ads conversion` when `SIGNUP_SEND_TO` is set.
5. In GA4 **DebugView** (with debug mode or GA Debugger), confirm events and page views for `app.equipify.ai`.
6. Optional: land on `www.equipify.ai` with UTM/gclid, then continue to `app.equipify.ai` onboarding; in Ads/GA4 reporting, verify attributed conversions within your attribution window (not real-time in all surfaces).

## Hydration / SSR

- The provider is a client component; the root layout stays a server component.
- Default automatic GA pageviews are disabled (`send_page_view: false`); only explicit SPA `page_view` events run, avoiding duplicate automatic + manual pageviews.
- gtag bootstrap uses `next/script` with `afterInteractive` (App Router does not support `beforeInteractive` outside the Pages Router `_document` pattern).
