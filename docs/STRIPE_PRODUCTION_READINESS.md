# Stripe production readiness (Phase 54.1)

Operational checklist for **live** Stripe billing on Equipify. Test mode behavior is unchanged when deploys are not “live-enforced” (see below).

## Live vs test enforcement

The server treats a deploy as **live-enforced** when **either**:

- `VERCEL_ENV=production` (Vercel Production), or
- `STRIPE_LIVE_MODE=true` (explicit opt-in, e.g. staging that must use live keys).

When live-enforced:

- `STRIPE_SECRET_KEY` must be `sk_live_…` (test keys are rejected).
- If set, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be `pk_live_…`.
- `POST /api/billing/checkout` runs `validateResolvedStripePriceIds()` so misconfigured catalog / env price IDs fail fast with **env-var-only** error messages.

Local and Preview typically use **test** keys (`sk_test_` / `pk_test_`). `sk_live_` in `NODE_ENV=development` logs a **warning** only.

**Price IDs:** Stripe Price IDs do not encode “test vs live” in the string. Use **separate** Stripe accounts (test dashboard vs live) and **separate** Vercel env values per environment so production never points at test-catalog prices.

## Required environment variables

### Stripe (all environments that run billing)

| Variable | Where | Purpose |
|----------|--------|---------|
| `STRIPE_SECRET_KEY` | Server only | Stripe API (Checkout, Portal, webhooks client) |
| `STRIPE_WEBHOOK_SECRET` | Server only | Signature verification for `POST /api/stripe/webhook` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client + build | Stripe Elements on `/settings/billing` (optional if UI does not mount Elements) |

### Price overrides (optional)

If not set, defaults come from `lib/plans.ts` (must be real `price_…` IDs for checkout validation).

- `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_ANNUAL`
- `STRIPE_PRICE_CORE_MONTHLY`, `STRIPE_PRICE_CORE_ANNUAL`
- `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`
- `STRIPE_PRICE_SCALE_MONTHLY`, `STRIPE_PRICE_SCALE_ANNUAL`

### Vercel / app URLs

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | Fallback origin for Checkout success/cancel when `Origin` is missing |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for webhook handler (writes `organization_subscriptions`, idempotency) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App auth / RLS |

## Stripe Dashboard setup

1. **API keys:** Use **live** keys on Production; **test** keys on local/preview.
2. **Webhooks:** Add endpoint  
   `https://<your-production-host>/api/stripe/webhook`  
   with the **live** signing secret copied into `STRIPE_WEBHOOK_SECRET` for Production.  
   Use a **separate** test endpoint + secret for preview/local if you forward webhooks there.
3. **Events:** Enable at least:  
   `checkout.session.completed`,  
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,  
   `invoice.payment_succeeded`, `invoice.payment_failed`.

## Code references

- Env guards / validation: `lib/billing/stripe-env.ts`
- Stripe client: `lib/stripe.ts`
- Checkout API: `app/api/billing/checkout/route.ts`
- Webhook: `app/api/stripe/webhook/route.ts`, `lib/billing/stripe-webhook-sync.ts`
- Price map: `lib/billing/stripe-price-map.ts`

## Manual test steps (test mode)

1. **Checkout:** From `/settings/billing`, start a subscription with test card; confirm redirect and session creation.
2. **Webhook:** Send or trigger a test event; confirm `200` and logs show `event verified`, handler messages, and **no** raw payloads or secrets.
3. **Missing env:** Unset `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` locally; confirm clear server errors naming the variable only.
4. **Production guard:** With `STRIPE_LIVE_MODE=true` and `sk_test_…` in `STRIPE_SECRET_KEY`, confirm Stripe initialization or checkout returns a misconfiguration error (no secret values in response).

## Database / migrations

No Supabase migrations are required for Phase 54.1 (env validation + logging only).
