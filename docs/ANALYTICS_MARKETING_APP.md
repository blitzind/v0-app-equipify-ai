# Marketing analytics (GA4 + Google Ads) on the app

This app mirrors the marketing stack used on [www.equipify.ai](https://www.equipify.ai) so sessions and conversions can be attributed when users land on the marketing site and complete signup on [app.equipify.ai](https://app.equipify.ai).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GA4_ID` | No* | GA4 measurement ID (`G-…`). Default when unset: `G-YZMS47H63H` (same as marketing site). |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | No* | Google Ads tag ID (`AW-…`). Default when unset: `AW-18160904774` (same as marketing site). |
| `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO` | No | Full Ads conversion `send_to` value (`AW-…/label`). Without it, GA4 events still fire but the Ads `conversion` event is skipped. Copy the exact value from Google Ads → Goals → Conversions → Tag setup. |
| `NEXT_PUBLIC_ANALYTICS_COOKIE_DOMAIN` | No | Override first-party cookie domain. Default: `.equipify.ai` when the hostname ends with `equipify.ai`; omitted on `localhost`. |
| `NEXT_PUBLIC_ANALYTICS_LINKER_DOMAINS` | No | Comma-separated hostnames for `linker.domains` (cross-domain / subdomain measurement). Default: `www.equipify.ai,app.equipify.ai,equipify.ai`. |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | No | Set to `1` to log gtag init, SPA `page_view`, and conversion-related calls to the browser console. |

\*Scripts load when at least one ID resolves (env or built-in Equipify defaults). Set either env var to `off` to disable that destination.

## Where code runs

- **Bootstrap + `gtag/js` loader (all routes):** `components/analytics/google-analytics-tags.tsx` (re-exports `MarketingGtagServerScripts`), mounted from **`app/layout.tsx`** inside `<head>`. Uses the standard Google pattern: `<script async src="https://www.googletagmanager.com/gtag/js?id=…">` plus an inline bootstrap that calls `gtag('config', …)` for GA4 + Google Ads on the **initial HTML** (not deferred to post-hydration `next/script`). `<body data-equipify-google-tags="app-subdomain-v1">` confirms the deployed build.
- **Runtime ID mirror for the client:** the server inline script sets `window.__EQUIPIFY_MARKETING_ENV__`. `lib/analytics/marketing-analytics-config.ts` prefers that object over `process.env` so event helpers match the IDs embedded in the HTML for this response.
- **SPA `page_view` + `gtag('config', …)`:** `components/analytics/marketing-analytics-provider.tsx` (inside `GlobalProviders`) — `usePathname` / `useSearchParams`, with dedupe in `lib/analytics/marketing-analytics-pageview-dedupe.ts`.
- **Conversion and funnel events (client-only):** `lib/analytics/marketing-analytics-events.ts`

### Layout / routing (Tag Assistant on `/onboarding`)

- `GlobalProviders` (including `MarketingAnalyticsProvider`) is mounted only from **`app/layout.tsx`**, so it wraps every route group (`(auth)`, `(dashboard)`, etc.). `(auth)/layout.tsx` does not remove it.
- **Google tag scripts** load from **`MarketingGtagServerScripts`** in the same root layout, so they are present on public/auth routes without authentication and do not depend on dashboard-only trees.
- Script loading is **not** gated on `NODE_ENV`, consent wrappers, pathname, or session; only missing `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_GOOGLE_ADS_ID` disables emission.

## Where conversions fire (intentionally strict)

Conversions and primary funnel events are **not** tied to page load, query strings, or “success” URL patterns alone.

They run only after the server confirms success:

| Event / action | When it fires |
|----------------|----------------|
| `trackOnboardingCompleted` → GA4 `sign_up`, `onboarding_completed`, optional Ads `conversion` | After successful `POST /api/invites/accept` or `POST /api/onboarding/provision` in `app/(auth)/onboarding/page.tsx` (`finalizeOnboarding`), with parsed `organizationId`. The page **awaits** `onRedirectReady` from `trackOnboardingCompleted` before `router.push` so the Google Ads hit is not cut off by navigation. Ads conversion uses `transport_type: 'beacon'`, `event_callback`, and a **1500ms** timeout fallback (first wins). |
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
2. **View source** or DevTools → Elements on `/onboarding`: confirm `<body data-equipify-google-tags="app-subdomain-v1">`, a `<head>` `<script async src="https://www.googletagmanager.com/gtag/js?id=G-YZMS47H63H">`, and an inline `<script id="equipify-marketing-gtag-bootstrap">` with `gtag('config','G-YZMS47H63H'` and `gtag('config','AW-18160904774'`.
3. DevTools → Console: `typeof window.gtag` should be `"function"` on `/onboarding` without signing in.
4. Set `NEXT_PUBLIC_ANALYTICS_DEBUG=1`, run the app; filter console for `equipify-analytics`.
5. Navigate between routes: confirm a `page_view` log per navigation without double bursts on a single navigation (Strict Mode may still mount twice in dev; dedupe should collapse identical path+search within ~450ms).
6. Complete onboarding on a test account: confirm logs for `GA4 sign_up + onboarding_completed`, `GA4 free_trial_signup` (self-serve only), and `Ads conversion` when `SIGNUP_SEND_TO` is set.
7. In GA4 **DebugView** (with debug mode or GA Debugger), confirm events and page views for `app.equipify.ai`.
8. Optional: land on `www.equipify.ai` with UTM/gclid, then continue to `app.equipify.ai` onboarding; in Ads/GA4 reporting, verify attributed conversions within your attribution window (not real-time in all surfaces).
9. Tag Assistant: connect to `https://app.equipify.ai/onboarding` and confirm the Google tag is detected after deploy.

## Hydration / SSR

- The provider is a client component; the root layout stays a server component.
- Default automatic GA pageviews are disabled (`send_page_view: false`); only explicit SPA `page_view` events run, avoiding duplicate automatic + manual pageviews.
- The **inline** gtag bootstrap and **async `gtag/js` loader** are emitted from the root layout `<head>` on the server HTML response. SPA `page_view` events still run client-side via `MarketingAnalyticsProvider`.
