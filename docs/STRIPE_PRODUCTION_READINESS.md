# Stripe production readiness (Phase 54.1–54.2)

Operational checklist for **live** Stripe billing on Equipify. Test mode behavior is unchanged when deploys are not “live-enforced” (see below).

Phase **54.2** adds subscription lifecycle validation: webhook behavior for each event type, safe catalog ↔ price mapping, structured observability, and manual QA below.

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
   Optional (informational only in-app): `customer.subscription.trial_will_end`, `invoice.payment_action_required` — Equipify logs them as `ignored` with no DB mutation.

## Subscription lifecycle (Phase 54.2)

### Events — handled vs ignored

| Stripe event | App behavior |
|--------------|----------------|
| `checkout.session.completed` | **Handled** when `mode === subscription` — loads subscription from Stripe, upserts `organization_subscriptions`. Non-subscription checkout: **skipped** (logged). |
| `customer.subscription.created` / `.updated` | **Handled** — upsert by org id from subscription metadata or DB lookup on `stripe_subscription_id` / `stripe_customer_id`. |
| `customer.subscription.deleted` | **Handled** — same upsert path; status forced to `canceled`. |
| `invoice.payment_succeeded` | **Handled** — clears `payment_failed_at`; refreshes row from Stripe subscription when subscription id is present and retrievable. |
| `invoice.payment_failed` | **Handled** — sets `payment_failed_at`, aligns status with Stripe (`past_due` / etc.). |
| `invoice.payment_action_required` | **Ignored** — no row write (customer completes authentication in Stripe / hosted flows). |
| `customer.subscription.trial_will_end` | **Ignored** — informational; trial dates remain on the subscription object / DB via other events. |
| Any other type | **Ignored** — logged with `dispatch: ignored`; idempotency still recorded. |

### `organization_subscriptions` fields (webhook-maintained)

Writes include: `organization_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `plan_id`, `billing_cycle`, `status`, `trial_starts_at`, `trial_ends_at`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `canceled_at`, `payment_failed_at`, `intended_plan_id` (cleared when subscription reflects paid/tier state). Product ↔ plan mapping uses env/catalog price IDs (`lib/billing/stripe-price-map.ts`), not a separate products table.

### Price → plan mapping failures

If Stripe sends a `price_…` that does not match env overrides or `lib/plans` catalog IDs:

- Logs include `priceMappingOk: false` and a short explanation (no secrets, no raw payloads).
- The webhook **does not** infer tier from arbitrary subscription metadata (`normalizePlanIdFromMetadataStrict`). Checkout/session metadata and explicit known `plan_id` metadata still apply.
- Existing `plan_id` in the database is preserved when the patch omits `plan_id` (updates do not overwrite with a wrong tier).

### Entitlements after webhooks

There is no separate entitlement cache: clients read `organization_subscriptions` (and usage tables) on load. After webhooks update the row, **limits follow `plan_id`** via `getUsageWithLimits` / plan gates. **`past_due` / `unpaid` / `canceled`** are not treated as “active subscription” for `isSubscriptionActive()` — failed payment paths update status so the account does not look paid-up while Stripe shows dunning.

### Manual lifecycle QA (test mode recommended)

Use Stripe test mode and the Dashboard or CLI to replay events where useful.

- [ ] **New subscription:** Complete Checkout from `/settings/billing`; confirm `organization_subscriptions` has customer, subscription, price ids, expected `plan_id` / `billing_cycle`, `status` active/trialing, period dates.
- [ ] **Upgrade / downgrade:** Change plan in Stripe Customer Portal or swap price on subscription; confirm `plan_id` / `stripe_price_id` / `billing_cycle` update on next `.updated` or invoice-driven sync.
- [ ] **Cancel at period end:** Set cancel at period end in Stripe; confirm `cancel_at_period_end` and eventual `canceled` / `canceled_at` when period ends.
- [ ] **Immediate cancel:** If used in Stripe; confirm `customer.subscription.deleted` sets status `canceled`.
- [ ] **Failed payment:** Use test card or invoice action; confirm `past_due` (or Stripe status), `payment_failed_at` set, entitlements not treated as fully active where gated.
- [ ] **Renewal / payment succeeded:** Confirm `invoice.payment_succeeded` clears `payment_failed_at` and refreshes period / status `active` when appropriate.
- [ ] **Webhook replay / idempotency:** Replay same `evt_` id — expect `200` with `duplicate: true`, no double side effects.
- [ ] **Entitlements:** After each change, reload app / session subscription API and confirm limits match tier (seats, equipment caps, etc.).
- [ ] **Logs:** Handler logs include `eventType`, `dispatch`, org resolution, ids as IDs only — **no** payment method or card data, **no** full raw Stripe payloads.

Platform admin accounts table (optional): Plan column shows billing cycle and period end when present; tooltip includes raw subscription status and row `updated_at` proxy for last webhook write.

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

Phase 54.1 required no schema changes. Phase 54.2 reuses existing `organization_subscriptions` and `stripe_webhook_events` — **no new migrations** for lifecycle validation.

If you already applied historical migrations, **no** extra `supabase db push` is needed solely for 54.2.

## Related: BlitzPay / customer payments (Phase 54.3)

SaaS subscription Stripe setup above is **not** used for **end-customer invoice** collection. Architecture for Connect, application fees, and webhooks is documented in [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md) and [BLITZPAY_PHASE_1.md](./BLITZPAY_PHASE_1.md).

**Supabase:** BlitzPay reads/writes `organizations` columns added by migrations under `equipify-app/supabase/migrations/` (notably `20260813100000_blitzpay_connect_phase1.sql` and `20260910160000_blitzpay_onboarding_diagnostics.sql`). If the app errors with **column `blitzpay_last_onboarding_attempt_at` does not exist**, apply pending migrations: from `equipify-app`, run `supabase db push` against the linked project (or run the SQL from `20260910160000_blitzpay_onboarding_diagnostics.sql` in the Supabase SQL editor).

For BlitzPay Phase 2A–2H environments, also ensure pending BlitzPay table migrations are applied (including `blitzpay_org_settings`, payment/refund/dispute/receipt-dispatch tables, merchant-control columns, and **Phase 2H** `blitzpay_payouts` / `blitzpay_balance_transactions` / `blitzpay_reconciliation_runs`). Configure the **BlitzPay Connect webhook** (`POST /api/blitzpay/webhook`) to receive **`payout.*`** events on connected accounts so payout rows stay current without manual sync. If you see setup/update messages in BlitzPay status/prepare/diagnostics routes, first verify the deploy points to the intended Supabase project and re-run migrations for that project.
