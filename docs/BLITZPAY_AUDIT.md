# BlitzPay / Stripe Connect — codebase audit

**Date:** 2026-05-11  
**Scope:** Read-only audit of the Equipify app (`equipify-app`) against the stated BlitzPay goals (Express Connect, destination charges, card + ACH, application fees, onboarding, webhooks, org-level settings).  
**Sources reviewed:** Stripe-related modules under `lib/billing/`, `lib/stripe.ts`, `app/api/stripe/webhook`, `app/api/billing/checkout`, `app/actions/stripe*.ts`, Settings/Integrations/Billing UI, `supabase/migrations` for billing/payments tables, `docs/BLITZPAY_ARCHITECTURE.md`, `docs/STRIPE_PRODUCTION_READINESS.md`.

---

## 1. Executive Summary

**Executive summary (post–Phase 1):** **Express Connect onboarding** is implemented (`docs/BLITZPAY_PHASE_1.md`): `organizations` Connect columns, Account Links, owner/admin APIs, Settings → **Payments**, and **`POST /api/blitzpay/webhook`** for **`account.updated`** with **`STRIPE_BLITZPAY_WEBHOOK_SECRET`**. **Still missing for full BlitzPay:** customer invoice **checkout** / PaymentIntents, **destination or direct charges**, **application fees**, **ACH/card pay UX**, **payout/dispute** surfaces, and broader Connect webhooks.

The repo also contains **Equipify SaaS subscription billing** on the **platform** Stripe account (`organization_subscriptions`, `/api/stripe/webhook`) — that path remains **separate** from BlitzPay.

**Implications:**

- **Operational invoice payments** remain **manual** in `org_invoice_payments` (no Stripe processor on those rows in Phase 1).
- **Production readiness** for SaaS billing stays in `STRIPE_PRODUCTION_READINESS.md`; BlitzPay needs its own Dashboard webhook endpoint and env for `STRIPE_BLITZPAY_WEBHOOK_SECRET`.

**Next:** Phase 2+ per `docs/BLITZPAY_ARCHITECTURE.md` — invoice pay flows, fees, extra webhooks, reconciliation.

---

## 2. What Is Already Implemented

### 2.0 BlitzPay / Stripe Connect (Phase 1 — onboarding only)

| Area | Implementation |
|------|------------------|
| Org persistence | `organizations` columns + `blitzpay_stripe_webhook_events` idempotency table (`20260813100000_blitzpay_connect_phase1.sql`) |
| Server module | `lib/blitzpay/*` — Express US account create, Account Links, retrieve + map to org fields |
| APIs | `GET/POST /api/organizations/[id]/blitzpay/{status,enable,sync,account-link}` |
| Webhook | `POST /api/blitzpay/webhook` — `account.updated` only, `STRIPE_BLITZPAY_WEBHOOK_SECRET` |
| UI | `/settings/payments` |

### 2.1 Stripe configuration usage (SaaS billing only)

| Area | Implementation |
|------|----------------|
| Server Stripe client | `lib/stripe.ts` — lazy `Stripe` SDK with API version `2026-04-22.dahlia`, `STRIPE_SECRET_KEY`, `assertStripeSecretKeyMatchesDeployment` |
| Env guards | `lib/billing/stripe-env.ts` — live vs test enforcement (`VERCEL_ENV`, `STRIPE_LIVE_MODE`), publishable key alignment, webhook secret presence helper |
| Hosted Checkout | `lib/billing/hosted-subscription-checkout.ts` + `app/api/billing/checkout/route.ts` — subscription Checkout with org metadata / `client_reference_id` |
| Embedded Checkout (optional) | `app/actions/stripe.ts` — `createCheckoutSession` for billing page |
| Customer Portal (optional fallback) | `app/actions/stripe.ts` — `createPortalSession` — **not** the default UX; `/settings/billing` opens an in-app **Manage billing** dialog first; portal only after explicit user consent in that dialog |
| SetupIntent (platform customer PM) | `app/actions/stripe-setup.ts` — attaches PM to **subscription** Stripe customer |
| Billing UI | `app/(dashboard)/settings/billing/page.tsx` — `loadStripe` / `Elements` / `CardElement` for **Equipify subscription** card setup only |
| Stripe invoice list (SaaS) | `app/actions/stripe-billing-data.ts` — lists **Stripe Billing** invoices for the org’s `stripe_customer_id`; sanitizes output (no raw Customer object) |
| Webhook HTTP handler | `app/api/stripe/webhook/route.ts` — raw body, `stripe-signature`, `constructEvent`, service-role Supabase |
| Webhook idempotency | Insert into `stripe_webhook_events` by Stripe `event.id`; duplicate → 200 `duplicate: true` |
| Webhook business logic | `lib/billing/stripe-webhook-sync.ts` — updates **`organization_subscriptions` only** |

### 2.2 Live / test mode handling (SaaS)

- Documented and enforced for **secret** and **publishable** keys in `stripe-env.ts` and checkout route (`assertPublishableKeyMatchesDeployment`, `validateResolvedStripePriceIds` when live-enforced).
- **Safe pattern:** no secret values logged in documented paths; webhook logger emits structured JSON with **ids and metadata keys**, not full payment objects (still review for any future Connect logging).

### 2.3 Organization-level payment data (existing — SaaS scope)

| Table / object | Purpose |
|----------------|---------|
| `organization_subscriptions` | One row per org: `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, plan, trial, periods, `payment_failed_at`, etc. — **Equipify tenant as customer of Equipify’s Stripe account** |
| `stripe_webhook_events` | Idempotency store for **platform** webhook endpoint |

**Not present:** dedicated `organizations.*` or side-table columns for Connect `acct_*`, `charges_enabled`, `payouts_enabled`, BlitzPay fee config, or `last_stripe_account_sync_at` for **connected** accounts.

### 2.4 Staff invoice payments (non-Stripe processor)

| Area | Implementation |
|------|----------------|
| Table | `org_invoice_payments` — `amount_cents`, `paid_on`, `payment_method` enum (`cash`, `check`, `ach`, `wire`, `card`, `other`), `reference`, `note` |
| Semantics | Migration explicitly: **staff-recorded; no payment processor** |
| UI | `components/drawers/invoice-detail-view.tsx` — record payment flows |
| RLS | `is_org_member` for select; writes restricted to `owner`, `admin`, `manager` |

### 2.5 Webhooks (platform SaaS — implemented)

**Verified in code (`dispatchStripeWebhookEvent`):**

| Event | Behavior |
|-------|----------|
| `checkout.session.completed` | Only if `session.mode === "subscription"`; else **skipped** |
| `customer.subscription.created` / `.updated` / `.deleted` | Upserts `organization_subscriptions` |
| `invoice.payment_succeeded` | Resolves org via **subscription Stripe invoice** → customer/subscription id on `organization_subscriptions`; clears `payment_failed_at`, refreshes from Stripe Subscription |
| `invoice.payment_failed` | Sets `past_due` / syncs from subscription |
| `invoice.payment_action_required` | Logged **ignored** (no DB mutation) |
| `customer.subscription.trial_will_end` | Logged **ignored** |
| **All other types** | Logged **ignored** |

**Security:** `STRIPE_WEBHOOK_SECRET` required; signature verification via `stripe.webhooks.constructEvent`; handler failure deletes idempotency row and returns 500 (Stripe retries).

### 2.6 Documentation (design)

- `docs/BLITZPAY_ARCHITECTURE.md` — recommended Connect model, Express preference, charge pattern options, separate webhook endpoint recommendation, phased plan **54.3B–F**, compliance cautions.
- `docs/STRIPE_PRODUCTION_READINESS.md` — SaaS checklist; cross-link to BlitzPay doc.

---

## 3. What Is Partially Implemented

| Topic | Status |
|-------|--------|
| **“Stripe” in product UI** | **Billing** (SaaS) + **Settings → Payments** (BlitzPay Phase 1 onboarding). Integrations hub Stripe card still describes **platform billing**, not Connect checkout (`lib/integrations/catalog-metadata.ts`). |
| **Checkout** | Implemented only for **subscription** mode SaaS purchases — **not** for paying `org_invoices`. |
| **Webhook `checkout.session.completed`** | Implemented **only** for subscription Checkout; could be **extended** later with strict metadata branching — today any non-subscription session is skipped without side effects. |
| **ACH wording** | `org_invoice_payments` allows `payment_method = 'ach'` as **manual** entry — **not** Stripe US bank account / Financial Connections. |
| **Invoice email copy** | Invoice drawer / email templates may mention “payment link when billing is connected” as **product language** — **no** PaymentIntent or link creation found in audit paths. |

---

## 4. What Is Missing (vs full BlitzPay production goals)

Phase 1 covers **Express onboarding + `account.updated` only** (see §2.0). Remaining gaps:

1. **Customer invoice collection** — No PaymentIntent, Checkout Session, or payment links for `org_invoices`; no `Stripe-Account` (or destination) charge APIs for end-customer pay.
2. **Application fees** — No `application_fee_amount` / `application_fee_percent` on any BlitzPay charge (no charges yet).
3. **Fee / method configuration columns** — No `stripe_default_fee_mode`, `stripe_application_fee_percent`, convenience fee toggles, or org-level ACH/card enable flags beyond what Stripe returns on the Account object.
4. **Portal / staff “Pay invoice” UX** — No Stripe-backed pay button; `org_invoice_payments` remains manual-only for processor-backed rows.
5. **Additional Connect webhooks** — `payment_intent.*`, `charge.*`, `payout.*`, `charge.dispute.*`, `setup_intent.succeeded`, etc., on `/api/blitzpay/webhook` (or split endpoints).
6. **BlitzPay admin / support dashboard** — No dispute list, payout failure queue, or payment volume for **tenant collections** (beyond what Stripe Dashboard shows for the connected account).
7. **Compliance copy** — No pre-pay fee disclosure, ACH authorization, or MoR / Stripe relationship copy on **checkout** surfaces (they do not exist yet).
8. **Integrations catalog copy** — May still read as “no Connect” in marketing cards; update when invoice pay ships.

---

## 5. Risks / Issues Found

| Risk | Detail |
|------|--------|
| **Conceptual confusion** | `organization_subscriptions.stripe_customer_id` is the **tenant’s** customer id on the **platform** account — **must not** be reused as the connected account id or end-customer id for BlitzPay without a clear model split. |
| **Webhook collision** | BlitzPay uses **`/api/blitzpay/webhook`** + **`STRIPE_BLITZPAY_WEBHOOK_SECRET`** (separate from SaaS). When adding invoice Checkout later, **never** point Connect events at `/api/stripe/webhook`; branch SaaS `checkout.session.completed` by `metadata.purpose` if any shared surface is unavoidable. |
| **Misread of `invoice.payment_succeeded`** | Handler ties to **Stripe subscription invoices** and `organization_subscriptions` — **not** to `org_invoices`. Do not assume operational invoice payment coverage. |
| **Manual `ach` / `card` labels** | Staff can label a payment “ACH” or “card” without processor verification — reconciliation risk if BlitzPay later auto-records Stripe payments; need dedupe rules (architecture doc references QB reconcile). |
| **No BlitzPay kill switch** | No `BLITZPAY_ENABLED` (or similar) env flag in code today for a gradual rollout. |
| **Logging** | Current webhook logs omit raw bodies (good). Any future Connect logging must avoid PAN, bank account numbers, full `payment_method` objects, and webhook secrets. |

---

## 6. Recommended Production Architecture

Align with **`docs/BLITZPAY_ARCHITECTURE.md`** (already sound) with these **implementation** anchors:

1. **Separate concerns permanently:** Platform SaaS (`/api/stripe/webhook`, `STRIPE_WEBHOOK_SECRET`) vs **Connect / BlitzPay** (`/api/stripe/connect/webhook` or similar, `STRIPE_CONNECT_WEBHOOK_SECRET`).
2. **Charge model:** Decide **direct charge on connected account + `application_fee_amount`** vs **destination charge** with counsel + Stripe rep; document in runbook before coding defaults.
3. **Express accounts:** Create with requested capabilities (`card_payments`, `transfers`; add ACH-related capabilities only when product/legal ready).
4. **Data model:** New table(s) or clearly named columns — never overload `organization_subscriptions` for Connect account ids.
5. **Payment records:** Extend `org_invoice_payments` (or add `org_invoice_payment_intents`) with `source = 'stripe'`, `stripe_payment_intent_id`, fee snapshots, idempotency keys; keep manual rows distinct.
6. **Gating:** Block “Pay online” until `charges_enabled` (and any `requirements` gates) synced from `account.updated`.

---

## 7. Required Database Changes

*(None exist today for BlitzPay; below is a requirements list.)*

| Need | Suggestion |
|------|------------|
| Connect account id | `organizations.stripe_connect_account_id` **or** `organization_blitzpay_settings` 1:1 with `organization_id` |
| Capability / onboarding flags | `charges_enabled`, `payouts_enabled`, `details_submitted`, `onboarding_status` (enum or text), optional `requirements_disabled_reason` json/text hash |
| Fee configuration | `stripe_default_fee_mode`, `stripe_application_fee_percent`, `stripe_convenience_fee_enabled`, `stripe_ach_enabled`, `stripe_card_enabled` (or feature flags table) |
| Sync cursor | `last_stripe_account_sync_at` |
| Payment attempts | Link `org_invoice_id` ↔ `stripe_payment_intent_id` / `checkout_session_id`, `application_fee_cents`, status, failure codes |
| Webhook idempotency | **New** table `stripe_connect_webhook_events` (recommended in architecture doc) |
| RLS | Policies: org members read limited fields; only `owner`/`admin` (or explicit permission) mutate BlitzPay settings; service role for webhook writes |

---

## 8. Required API / Server Actions

| Capability | Description |
|------------|-------------|
| Create Express account | Server-only: `accounts.create` with `type: 'express'`, requested capabilities |
| Account Link / embedded onboarding | Generate link; `return_url`, `refresh_url` from app origin |
| Account status refresh | Poll or webhook-driven upsert from Stripe Account object |
| Create PaymentIntent or Checkout | For invoice amount, connected account context, `application_fee_*`, metadata `organization_id`, `invoice_id`, `purpose=blitzpay_invoice` |
| Refund / dispute hooks | Server routes calling Stripe with correct account context |
| Portal pay endpoint | Authenticated portal session → create intent or session with amount from `org_invoices` (read-only today) |

---

## 9. Required UI Changes

| Surface | Change |
|---------|--------|
| Settings | New **Payments / BlitzPay** (or under Billing with clear separation): onboarding CTA, status pills (`charges_enabled`, `payouts_enabled`, requirements), resume onboarding |
| Invoice detail | “Collect payment” → real flow when Connect ready; keep manual record path |
| Portal invoice | Pay button + fee disclosure + merchant name |
| Integrations / marketing | Update catalog entries when BlitzPay ships (today: “billing only / no Connect”) |
| Admin | Optional platform admin view for failed Connect onboarding, disputes (if platform has visibility) |

---

## 10. Required Webhooks

**New endpoint** (recommended) with dedicated signing secret. Minimum set to plan for:

| Event | Purpose |
|-------|---------|
| `account.updated` | Sync onboarding + capability gates to Supabase |
| `payment_intent.succeeded` / `payment_intent.payment_failed` | Update invoice payment / intent rows; notify |
| `charge.succeeded` / `charge.failed` | Optional redundancy or legacy readers |
| `charge.dispute.created` / `.updated` / `.closed` | Support UI + notifications |
| `payout.paid` / `payout.failed` | Connected account cash movement visibility |
| `setup_intent.succeeded` | If using SetupIntent for ACH verification / saved PM |
| `checkout.session.completed` | **Only** if using Checkout for invoice pay — branch on metadata; **do not** merge with SaaS handler without guards |

**Not required for BlitzPay:** SaaS `customer.subscription.*` handlers remain on existing endpoint.

---

## 11. Environment Variables Needed

**Already used (SaaS):**

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, optional `STRIPE_PRICE_*`, `STRIPE_LIVE_MODE`

**Future (from architecture doc + audit):**

- `STRIPE_CONNECT_WEBHOOK_SECRET` (or Stripe multi-endpoint configuration)
- Optional: `BLITZPAY_ENABLED`, `STRIPE_CONNECT_CLIENT_ID` (if OAuth Standard ever considered)
- **Same** platform `STRIPE_SECRET_KEY` typically used for Connect API calls; connected context is per-request, not a second secret key.

---

## 12. Testing Checklist

### SaaS billing (existing — regression when touching shared libs)

- [ ] Hosted Checkout completes; `organization_subscriptions` updates via webhook.
- [ ] `STRIPE_WEBHOOK_SECRET` missing → 503 webhook.
- [ ] Duplicate event id → 200 duplicate, no double write.
- [ ] Live mode: `sk_live_` / `pk_live_` / price validation.

### BlitzPay (when built — placeholder)

- [ ] Express account creation + Account Link return/refresh URLs.
- [ ] `account.updated` reflects disabled capabilities in UI.
- [ ] Card payment: PI succeeds → `org_invoices` / `org_invoice_payments` consistent; QB reconcile rules if applicable.
- [ ] ACH: verify microdeposit / instant verification flow per Stripe product choice.
- [ ] Application fee appears on platform balance; connected net correct.
- [ ] Dispute webhook → in-app state + email.
- [ ] Webhook idempotency under retry.
- [ ] RLS: non-admin cannot enable BlitzPay; portal cannot access other orgs’ payment intents.

---

## 13. Phased Implementation Plan

Maps to **`docs/BLITZPAY_ARCHITECTURE.md` §6** with minor labels:

| Phase | Deliverable |
|-------|-------------|
| **A — Done** | Architecture + this audit |
| **B** | DB migrations for Connect settings; Express `accounts.create` + Account Links; `account.updated` webhook + UI status |
| **C** | First invoice PaymentIntent or Checkout (sandbox); link to `org_invoices`; zero fee initially |
| **D** | Application fee server policy + disclosure copy |
| **E** | Refunds, disputes, payout visibility, exports |
| **F** | QuickBooks payment reconciliation rules with Stripe-sourced rows |

---

## Appendix A — Stripe SDK touchpoints (file list)

- `lib/stripe.ts`
- `lib/billing/stripe-env.ts`, `stripe-price-map.ts`, `stripe-price-validation.ts`, `hosted-subscription-checkout.ts`, `stripe-webhook-sync.ts`, `subscriptions.ts` (supporting), `access.ts` (billing UX)
- `app/api/stripe/webhook/route.ts`
- `app/api/billing/checkout/route.ts`
- `app/actions/stripe.ts`, `stripe-setup.ts`, `stripe-billing-data.ts`
- `app/(dashboard)/settings/billing/page.tsx` (`@stripe/stripe-js`, `@stripe/react-stripe-js`)

**No** `stripe` package usage found for Connect Account / PaymentIntent on behalf of tenants for **operational** invoices in this audit.

---

## Appendix B — Glossary disambiguation

| Term in codebase | Meaning today |
|------------------|---------------|
| **Stripe customer** on `organization_subscriptions` | Equipify **workspace** as customer of **Equipify platform** Stripe account (SaaS) |
| **`org_invoice_payments`** | Internal bookkeeping for **end-customer** invoices — **not** Stripe-processed unless future work adds processor ids |
| **BlitzPay** | **Product + architecture name** in docs; **no** separate npm module or feature flag implementation found |

---

*End of audit. No code or schema was modified to produce this document.*
