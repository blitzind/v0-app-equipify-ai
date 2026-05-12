# Stripe production readiness (Phase 54.1–54.2)

Operational checklist for **live** Stripe billing on Equipify. Test mode behavior is unchanged when deploys are not “live-enforced” (see below).

Phase **54.2** adds subscription lifecycle validation: webhook behavior for each event type, safe catalog ↔ price mapping, structured observability, and manual QA below.

**BlitzPay Phase 6A (mobile financial ops foundations)** does **not** add Stripe webhooks or new Connect capabilities; it introduces optional server-only peppers (`BLITZPAY_MOBILE_AUDIT_PEPPER`, `BLITZPAY_MOBILE_SIGNATURE_PEPPER`) for deterministic audit/signature hashing. Production should set strong random values.

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

## BlitzPay (Connect) vs SaaS subscription webhooks

**BlitzPay** end-customer invoice payments use **`POST /api/blitzpay/webhook`** and the **Connect** webhook secret (`STRIPE_BLITZPAY_WEBHOOK_SECRET` / env naming per deploy). That path is **separate** from **`POST /api/stripe/webhook`** (SaaS subscriptions). Phase **2O** financing/installment features **do not** add new Stripe event types to the SaaS webhook; future third-party financing integrations must keep **PII and application payloads out of Equipify** and use **opaque provider references** only.

### BlitzPay Phase 3A (internal general ledger)

- **Stripe** remains the system of record for **money movement** (charges, refunds, disputes, payouts, balance transactions).
- **BlitzPay GL** (new `blitzpay_chart_of_accounts`, `blitzpay_journal_*`, periods, deferred schedules) is the system of record for **posted internal journals** — integer cents, double-entry, **immutable after post**; corrections use **reversal batches**, not edits.
- **Optional env:** `BLITZPAY_GL_SOURCE_PEPPER` (server-only) for deterministic fingerprints of external references — see `.env.local.example` and `docs/BLITZPAY_PHASE_3_ARCHITECTURE.md`.
- **No new Stripe webhook types** are required for Phase 3A; schema health guards apply to accounting APIs same as other BlitzPay staff routes.

### BlitzPay Phase 3B (vendor AP & bill pay foundations)

- **Orchestration only:** payment runs and allocations **do not** trigger Stripe charges, ACH debits, or off-platform transfers automatically.
- **Schema:** apply `20261012120000_blitzpay_phase_3b_ap_automation.sql` so staff `GET/POST …/blitzpay/ap/*` routes pass **schema health** checks (`blitzpay_schema_incomplete` otherwise).
- **Money movement** remains on **existing Connect** flows when you pay through approved provider paths; Phase 3B adds **internal liability tracking** and **audit lineage** only.

### BlitzPay Phase 3C (tax & compliance foundations)

- **Orchestration only:** Phase **3C** records **jurisdictions**, **tax rules**, **deterministic calculation rows**, **append-only compliance audit** entries, **ACH authorization retention metadata** (hashed references), **vendor tax / 1099 readiness profiles**, and optional **tax liability snapshots** — it does **not** file, remit, or guarantee tax outcomes.
- **Schema:** apply `20261013120000_blitzpay_phase_3c_tax_compliance.sql` so staff tax/compliance routes pass **schema health** checks (`blitzpay_schema_incomplete` otherwise).
- **Stripe / webhooks:** no new Connect webhook types are required for Phase **3C**; settlement and charge behavior remain unchanged. Optional server-only pepper `BLITZPAY_GL_SOURCE_PEPPER` also seeds **compliance audit row hashes** (same as GL reference fingerprinting) — rotate with care across environments.
- **Client exposure:** staff UI shows **operational indicators** only; do not surface raw tax identifiers, TINs, or bank/ACH authorization text from these tables.

### BlitzPay Phase 3D (financing marketplace foundations)

- **Orchestration only:** Phase **3D** records **marketplace provider rows** (`blitzpay_marketplace_financing_providers`), **financing applications**, **application offers** (`blitzpay_financing_application_offers`), **contractor advance planning models**, **append-only financing audit**, and **provider match rows** — Equipify does **not** originate credit, hold funds, or auto-approve third-party financing.
- **Schema:** apply `20261014120000_blitzpay_phase_3d_financing_marketplace.sql` so staff `…/blitzpay/financing/*` routes pass **schema health** checks (`blitzpay_schema_incomplete` otherwise). This phase is **orthogonal** to Phase **2O** `blitzpay_financing_sessions` / catalog `blitzpay_financing_providers` — keep integrations explicit in product docs.
- **Stripe / webhooks:** no new Connect webhook types are required for Phase **3D**; any future financing partner would add **separate** ingress (not in this phase).
- **Portal:** `/api/portal/financing/*` returns **customer-scoped summaries** only; hashes replace raw provider references in storage.

### BlitzPay Phase 3E (procurement & inventory finance foundations)

- **Orchestration only:** Phase **3E** records **inventory financial profiles**, **append-only movements**, **valuation snapshots**, **rebate programs + accruals** (accrual tracking only), **reorder forecasts** (planning estimates), **serialized asset financial rows** (hashed serial references), and **append-only procurement audit** — it does **not** auto-place purchase orders, execute reorders, or custody supplier financing balances.
- **Schema:** apply `20261015120000_blitzpay_phase_3e_procurement_inventory_finance.sql` so staff `…/blitzpay/procurement/*` routes pass **schema health** checks (`blitzpay_schema_incomplete` otherwise).
- **Stripe / webhooks:** no new Connect webhook types are required for Phase **3E**; inventory and procurement signals are **internal** to Postgres reporting surfaces.

### BlitzPay Phase 4A (AI financial copilot — advisory only)

- **No autonomous execution:** insights, forecasts, and recommendation rows are **operational recommendations**; APIs only dismiss/acknowledge/complete advisory queue items.
- **Schema:** apply `20261116120000_blitzpay_phase_4a_ai_financial_copilot.sql` so staff `…/blitzpay/ai/*` routes pass **schema health** checks.
- **Optional env:** `BLITZPAY_AI_AUDIT_PEPPER` (server-only) — strengthens immutable audit hashes; distinct from `BLITZPAY_GL_SOURCE_PEPPER`. See `docs/BLITZPAY_PHASE_4_ARCHITECTURE.md`.

### BlitzPay Phase 4B (revenue optimization — deterministic recommendations only)

- **No autonomous execution:** opportunities, behavior scores, and experiments are **internal planning artifacts**; `POST …/generate` refreshes the queue from reporting math — it does **not** message customers, change prices, renew memberships, approve financing, or retry cards outside existing Phase **2AB** caps.
- **Schema:** apply `20261117120000_blitzpay_phase_4b_revenue_optimization.sql` so staff `…/blitzpay/revenue-optimization/*` routes pass **schema health** checks.
- **Optional env:** `BLITZPAY_REVENUE_OPT_AUDIT_PEPPER` (server-only) — strengthens immutable optimization audit hashes. See `docs/BLITZPAY_PHASE_4_ARCHITECTURE.md`.

### BlitzPay Phase 5A (multi-entity / franchise finance — reporting & linkage only)

- **No autonomous cross-org control:** groups, membership, inter-company rows, and consolidated snapshots are **explicit configuration + reporting**; APIs validate anchor org for mutations; RLS remains org-isolated with finance roles.
- **Schema:** apply `20261118120000_blitzpay_phase_5a_multi_entity_finance.sql` so staff `…/blitzpay/multi-entity/*` routes pass **schema health** checks.
- **Optional env:** `BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER` (server-only) — strengthens immutable multi-entity audit hashes. See `docs/BLITZPAY_PHASE_5_ARCHITECTURE.md`.

### BlitzPay Phase 5B (supplier / vendor network — orchestration visibility only)

- **No autonomous procurement or financing:** networks, preferred programs, bulk coordination rows, and financing offers are **planning artifacts**; APIs require anchor org for network-owned mutations; benchmarks remain **aggregate-only** (no customer-level sharing).
- **Schema:** apply `20261119120000_blitzpay_phase_5b_vendor_supplier_network.sql` so staff `…/blitzpay/supplier-network/*` routes pass **schema health** checks.
- **Optional env:** `BLITZPAY_SUPPLIER_NETWORK_AUDIT_PEPPER` (server-only) — strengthens immutable supplier-network audit hashes. See `docs/BLITZPAY_PHASE_5_ARCHITECTURE.md`.

### BlitzPay Phase 5C (warranty / claims / protection — tracking & orchestration only)

- **No autonomous adjudication or payouts:** warranty reserves, claims, protection plans, storm financials, and payout tracking rows are **internal workflow + visibility** artifacts; APIs are org-scoped with bounded reads; **no** portal claim administration; payout payloads expose **hashed** references only (no raw external payout identifiers).
- **Schema:** apply `20261120120000_blitzpay_phase_5c_insurance_warranty_claims.sql` so staff `…/blitzpay/claims/*`, `…/protection-plans`, and `…/storm-events` routes pass **schema health** checks.
- **Optional env:** `BLITZPAY_CLAIMS_AUDIT_PEPPER` (server-only) — strengthens immutable claims audit hashes. See `docs/BLITZPAY_PHASE_5_ARCHITECTURE.md`.

### BlitzPay Phase 2AA (billing profiles and payment method metadata)

- **Stripe remains the vault:** Equipify stores only **hashed** payment-method references plus **non-sensitive** display fields (brand, last4, exp, type). **No** card or bank account numbers are stored in Postgres.
- **Optional env:** `BLITZPAY_STRIPE_REF_PEPPER` (server-only) — set in **production** to a long random secret so reference hashes are not reversible across environments. Documented in `.env.local.example`.
- **No new money-movement paths:** Phase **2AA** does **not** add Checkout, PaymentIntents, subscriptions, or ACH debits; staff “sync” calls **list/retrieve** payment methods for metadata only. Webhook configuration is unchanged from existing BlitzPay Connect setup.
- **Client exposure:** Portal billing APIs return **masked** labels only; staff UIs must not print raw `pm_` / `cus_` ids from Phase **2AA** tables (hashes are internal).

### BlitzPay Phase 2AB (collections engine — orchestration only)

- **No autonomous collections:** routes record **state + activity** and deterministic **retry windows**; they do **not** send email/SMS or trigger Stripe charges.
- **Retry caps:** engine constants bound automated retry slots; staff actions log to `blitzpay_collection_activity_log` for auditability.
- **Portal:** customer billing overview exposes **counts and plain-language status** only — not internal escalation metadata.

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

## Related: BlitzPay Phase 6B (observability metadata)

Phase **6B** tables and APIs are **internal staff / admin visibility** only (queue snapshots, workflow rows, idempotency metadata). They **do not** change Stripe objects, Connect balances, or payout timing. Production readiness still depends on **Connect webhooks**, **idempotent invoice side effects**, and **migration application** for `blitzpay_*` tables — see [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md) and [BLITZPAY_PHASE_6_ARCHITECTURE.md](./BLITZPAY_PHASE_6_ARCHITECTURE.md).

## Related: BlitzPay / customer payments (Phase 54.3)

SaaS subscription Stripe setup above is **not** used for **end-customer invoice** collection. Architecture for Connect, application fees, and webhooks is documented in [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md) and [BLITZPAY_PHASE_1.md](./BLITZPAY_PHASE_1.md).

**Supabase:** BlitzPay reads/writes `organizations` columns added by migrations under `equipify-app/supabase/migrations/` (notably `20260813100000_blitzpay_connect_phase1.sql` and `20260910160000_blitzpay_onboarding_diagnostics.sql`). If the app errors with **column `blitzpay_last_onboarding_attempt_at` does not exist**, apply pending migrations: from `equipify-app`, run `supabase db push` against the linked project (or run the SQL from `20260910160000_blitzpay_onboarding_diagnostics.sql` in the Supabase SQL editor).

For BlitzPay Phase 2A–2R environments, also ensure pending BlitzPay table migrations are applied (including `blitzpay_org_settings`, payment/refund/dispute/receipt-dispatch tables, **platform-managed fee policy columns**, **Phase 2H** `blitzpay_payouts` / `blitzpay_balance_transactions` / `blitzpay_reconciliation_runs`, **Phase 2I** `blitzpay_customer_payment_profiles` plus multi-method columns on `blitzpay_payment_intents` / `blitzpay_org_settings`, and **Phase 2R** `blitzpay_org_balances` / `blitzpay_balance_snapshots` plus treasury columns on `blitzpay_org_settings`). **Phase 2X** adds `blitzpay_memberships` and related membership tables (`20260926120000_blitzpay_phase_2x_memberships_recurring_revenue.sql`); recurring billing still creates **org invoices** and uses existing Checkout/charge paths — **no Stripe subscription objects** are required for memberships, and **portal membership APIs must not return raw Stripe ids** (only org-scoped references and UI-safe labels). **Phase 2Y** adds payroll accrual tables (`20260928120000_blitzpay_phase_2y_payroll_and_payouts.sql`) including **`blitzpay_contractor_settlements`** for WO-linked settlements — this is separate from Phase 2S `blitzpay_vendor_payouts` (internal AP paid markers). Phase 2Y does **not** introduce new Stripe objects or ACH payroll execution; schema health probes include the new tables. Configure the **BlitzPay Connect webhook** (`POST /api/blitzpay/webhook`) to receive **`payout.*`** events on connected accounts so payout rows stay current without manual sync. If you see setup/update messages in BlitzPay status/prepare/diagnostics routes, first verify the deploy points to the intended Supabase project and re-run migrations for that project.

**Phase 2Z** adds internal cash-planning tables (`20260929120000_blitzpay_phase_2z_cash_accounts.sql`) — **not** bank accounts, **not** custodial balances, **not** money transmission. UI and APIs surface **estimates** for contractor operations; **Stripe Connect remains the source of truth** for funds movement. Schema health includes the new tables; apply migrations before relying on cash-planning panels or reporting fields.
