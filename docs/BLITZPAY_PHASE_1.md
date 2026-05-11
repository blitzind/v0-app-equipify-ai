# BlitzPay Phase 1 — Stripe Connect Express onboarding

Phase 1 adds **organization-level Stripe Connect Express** account creation, **Account Link** onboarding, **status sync**, and a **dedicated Connect webhook** (`account.updated` only). It does **not** collect customer invoice payments, application fees, ACH/card checkout, payouts UI, or disputes.

**North star:** `docs/BLITZPAY_ARCHITECTURE.md`  
**Pre-work audit:** `docs/BLITZPAY_AUDIT.md`

---

## What was implemented

| Area | Details |
|------|---------|
| **Database** | New columns on `public.organizations` for Connect id, aggregate status, capability flags, requirements JSON arrays, last sync time. New table `public.blitzpay_stripe_webhook_events` for idempotency (mirrors `stripe_webhook_events` pattern). |
| **Server helpers** | `lib/blitzpay/access.ts` (owner/admin + platform admin gate), `lib/blitzpay/map-account.ts` (Stripe Account → org columns), `lib/blitzpay/connect-stripe.ts` (Express create, retrieve, Account Link), `lib/blitzpay/org-write-client.ts` (JWT vs service role for org updates). |
| **API routes** | `GET/POST` under `/api/organizations/[organizationId]/blitzpay/…` — see below. |
| **Webhook** | `POST /api/blitzpay/webhook` — signature with `STRIPE_BLITZPAY_WEBHOOK_SECRET`, handles `account.updated` only. |
| **UI** | `app/(dashboard)/settings/payments/page.tsx` — Settings → **Payments** (BlitzPay). |
| **Navigation** | `app/(dashboard)/settings/layout.tsx` — “Payments” entry (visible when `canViewBilling \|\| canManageWorkspaceSettings`). |

### Routes / actions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/organizations/[organizationId]/blitzpay/status` | Active org member | Read Connect snapshot columns. |
| POST | `/api/organizations/[organizationId]/blitzpay/enable` | Owner, admin, or platform admin | Create Express account if missing; else refresh from Stripe. |
| POST | `/api/organizations/[organizationId]/blitzpay/sync` | Owner, admin, or platform admin | `accounts.retrieve` + update org normalized fields. |
| POST | `/api/organizations/[organizationId]/blitzpay/account-link` | Owner, admin, or platform admin | Ensure account exists, return Stripe Account Link URL for hosted onboarding. |
| POST | `/api/blitzpay/webhook` | Stripe signature | `account.updated` → update org by `stripe_connect_account_id`. |

### Database fields (`organizations`)

| Column | Type | Notes |
|--------|------|--------|
| `stripe_connect_account_id` | text nullable | Stripe `acct_*` |
| `stripe_connect_status` | text NOT NULL default `not_started` | Check: `not_started`, `onboarding_started`, `action_required`, `pending_verification`, `ready`, `disabled` |
| `stripe_connect_onboarding_complete` | boolean default false | True when status maps to `ready` |
| `stripe_charges_enabled` | boolean default false | From Stripe Account |
| `stripe_payouts_enabled` | boolean default false | From Stripe Account |
| `stripe_details_submitted` | boolean default false | From Stripe Account |
| `stripe_requirements_*` | jsonb default `[]` | `currently_due`, `eventually_due`, `past_due` |
| `last_stripe_connect_sync_at` | timestamptz nullable | Set on sync + webhook update |

### Status mapping (heuristic)

1. `requirements.disabled_reason` → **disabled**  
2. `past_due` or `currently_due` non-empty → **action_required**  
3. `charges_enabled` && `payouts_enabled` && `details_submitted` → **ready**  
4. `details_submitted` but not both charges and payouts → **pending_verification**  
5. Else (account exists) → **onboarding_started**  
6. No account id → **not_started** (default column)

---

## Onboarding errors (user-safe)

APIs return `{ error, message }` where `error` is a **normalized code** (for example `connect_temporarily_restricted`, `connect_rate_limited`) and `message` is **safe copy** — not raw Stripe text. Server logs include Stripe `requestId`, `code`, `type`, and raw message for support. Persisted columns on `organizations` (see migration `20260910160000_blitzpay_onboarding_diagnostics.sql`) store the last failure **category** and Stripe **request id** for future admin tools.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | Platform secret; used for Connect Account + Account Link APIs (same as SaaS billing). |
| `STRIPE_BLITZPAY_WEBHOOK_SECRET` | Yes in any env that receives Connect webhooks | Signing secret for **`/api/blitzpay/webhook`** only. **Do not** reuse `STRIPE_WEBHOOK_SECRET` (SaaS endpoint). |
| `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL` or `APP_URL` | Recommended | Account Link `return_url` / `refresh_url` base (see `getPublicAppOrigin()` in `lib/email/config.ts`). |

Do not commit real secrets. Copy from Stripe Dashboard → Developers → Webhooks (separate endpoint for Connect).

---

## How to test (Stripe test mode)

1. Run migration: `supabase db push` (or apply SQL in dashboard) for your project.  
2. Set `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_BLITZPAY_WEBHOOK_SECRET`, and public app URL env vars locally.  
3. In Stripe Dashboard, add webhook URL: `https://<your-host>/api/blitzpay/webhook`  
   - Select event: **`account.updated`**  
   - Use the signing secret as `STRIPE_BLITZPAY_WEBHOOK_SECRET`.  
4. Sign in as **owner** or **admin**; open **Settings → Payments**.  
5. **Enable BlitzPay** — creates one Express account; repeat click should not create duplicates.  
6. **Continue onboarding** — opens Stripe-hosted flow; complete or exit; return URL should land on Payments with auto **Refresh** toast.  
7. **Refresh status** — updates columns from Stripe.  
8. Trigger **account.updated** (e.g. finish onboarding steps) and confirm DB fields update via webhook.  
9. Confirm **Settings → Billing** (SaaS Checkout / Portal) still works and **`/api/stripe/webhook`** unchanged.

---

## Phase 2 (suggested)

- PaymentIntent or Checkout Session for **`org_invoices`** (metadata: `organization_id`, `invoice_id`, `purpose=blitzpay_invoice`).  
- `application_fee_amount` / percent policy (server-only).  
- Customer portal “Pay invoice” and staff “Collect payment”.  
- ACH / card method selection + fee disclosures + legal copy.  
- Additional Connect webhooks: `payment_intent.*`, `charge.*`, `payout.*`, `charge.dispute.*`.  
- Optional: unique constraint on `stripe_connect_account_id`.

---

## Migration file

- `supabase/migrations/20260813100000_blitzpay_connect_phase1.sql`

---

## Related code (unchanged)

- `app/api/stripe/webhook/route.ts` — SaaS subscriptions only.  
- `lib/billing/stripe-webhook-sync.ts` — subscription / SaaS invoice events only.  
- `organization_subscriptions` — still the only place for **tenant → Equipify** Stripe customer/subscription ids.
