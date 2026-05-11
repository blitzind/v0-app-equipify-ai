# BlitzPay Phase 2 — Architecture

**Status:** **Phase 2A foundation implemented** (migrations, RLS, server libs, webhook stubs). Customer pay UI, allocation to `org_invoice_payments`, and full reconciliation are **Phase 2B+** (see §12).  
**Prerequisites:** Phase 1 implemented (`docs/BLITZPAY_PHASE_1.md`, `organizations` Connect columns, `POST /api/blitzpay/webhook`, `blitzpay_stripe_webhook_events`, Express onboarding).  
**North star (conceptual):** `docs/BLITZPAY_ARCHITECTURE.md` — this doc **narrows** choices for Phase 2 and aligns with `docs/SCALE_READINESS_AUDIT.md` (score 6/10: pagination, webhook architecture, rate limits, observability).

---

## 0. Goals and principles

| Goal | Approach |
|------|----------|
| **Collect invoice payments** via Stripe Connect for **end-customers** of Equipify tenants | Prefer **direct charges** on the **connected account** + **`application_fee_amount`** to the platform |
| **Stay separate from SaaS billing** | No changes to `/api/stripe/webhook` subscription dispatch; all Connect payment webhooks on **`/api/blitzpay/webhook`** (expand event list; same or additional signing secret documented below) |
| **Money safety** | DB idempotency **before** side effects; Stripe **idempotency keys** on create APIs; unique business constraints |
| **Scale readiness** | Bounded webhook handler; **async completion** for heavy work; **rate limits** on pay + portal APIs |
| **Reconciliation** | Immutable **ledger** rows + link to existing `org_invoice_payments` / balance logic where possible |

**Open legal/product decisions (before coding convenience fees):** card surcharge rules, ACH rules, MoR disclosures — see §4 and §10.

---

## 1. Recommended Supabase tables

All new tables are **tenant-scoped** (`organization_id uuid not null references organizations(id)` unless noted). Use **`gen_random_uuid()`** primary keys unless a natural Stripe id is the PK (prefer **Stripe ids as unique columns**, UUID PK for app rows — easier for FKs from invoices).

### 1.1 `blitzpay_payment_intents` (core charge object mirror)

One row per **Stripe PaymentIntent** created for BlitzPay (invoice pay, or future non-invoice charges).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | Internal id |
| `organization_id` | uuid FK | Tenant |
| `stripe_connect_account_id` | text | Denormalized `acct_*` used for the API call |
| `stripe_payment_intent_id` | text UNIQUE (global) | `pi_*` |
| `stripe_checkout_session_id` | text nullable UNIQUE | If Checkout used instead of / in addition |
| `status` | text | Mirror: `requires_payment_method`, `processing`, `succeeded`, `canceled`, `requires_action`, etc. |
| `amount_cents` | bigint | Total amount intended to charge the customer (minor units) |
| `currency` | text | e.g. `usd` |
| `application_fee_cents` | bigint nullable | Platform fee passed to Stripe |
| `convenience_fee_cents` | bigint not null default 0 | Portion of amount that is **explicitly** a convenience/surcharge line (see §4) |
| `invoice_amount_cents` | bigint nullable | Subtotal attributable to invoice (for reporting; `amount_cents` may equal invoice + convenience) |
| `org_invoice_id` | uuid nullable FK → `org_invoices` | Target invoice |
| `customer_id` | uuid nullable FK → `customers` | End-customer (Equipify tenant’s customer) |
| `idempotency_key` | text not null | Client/server key used with Stripe (`Idempotency-Key` header) |
| `metadata` | jsonb default `{}` | Stripe metadata mirror + internal flags |
| `last_stripe_event_at` | timestamptz nullable | Last webhook that touched this row |
| `created_at` / `updated_at` | timestamptz | Audit |

**Why separate from `org_invoice_payments`:** `org_invoice_payments` today is **staff-recorded** processor-agnostic (`docs/BLITZPAY_ARCHITECTURE.md`). BlitzPay should **insert** a reconciled `org_invoice_payments` row (or call existing allocation helpers) **only after** `payment_intent.succeeded` — the intent table is the **Stripe-shaped** source of truth pre-reconciliation.

### 1.2 `blitzpay_invoice_payment_attempts` (user-facing attempts / sessions)

Tracks **each** “start pay” action (link generation, Checkout session creation, PI create retry). Supports **multiple attempts per invoice** with policy (e.g. max N open, or supersede old session).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `org_invoice_id` | uuid FK | |
| `blitzpay_payment_intent_id` | uuid FK nullable | Linked PI row once created |
| `attempt_no` | int not null | Monotonic per invoice (or per day) |
| `channel` | text | `checkout`, `payment_element`, `portal_link` |
| `created_by_user_id` | uuid nullable | Staff who sent link; null if customer-initiated portal |
| `portal_access_context` | jsonb nullable | Opaque ref to portal session / token id (no secrets) |
| `status` | text | `initiated`, `redirected`, `completed`, `failed`, `expired` |
| `failure_code` | text nullable | Stripe decline / last_payment_error code |
| `created_at` | timestamptz | |

### 1.3 `blitzpay_fee_snapshots` (optional but recommended for disputes/audit)

One row when fees are **computed** at payment creation (immutable).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `blitzpay_payment_intent_id` | uuid FK | |
| `platform_fee_bps` | int | Basis points at time of charge |
| `platform_fee_fixed_cents` | int | Fixed component |
| `convenience_fee_bps` / `convenience_fee_fixed_cents` | int | If applicable |
| `stripe_fee_estimate_cents` | int nullable | Optional display-only estimate |
| `computed_total_application_fee_cents` | bigint | What was sent as `application_fee_amount` |
| `policy_version` | text | e.g. `blitzpay_fees_v1` |
| `created_at` | timestamptz | |

### 1.4 `blitzpay_ledger_entries` (double-entry style reconciliation)

Append-only **internal** ledger for platform vs connected-account economics (not a full accounting GL — a **technical** reconciliation log).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `entry_type` | text | `payment_captured`, `application_fee_received`, `refund`, `chargeback`, `adjustment` |
| `amount_cents` | bigint | Signed |
| `currency` | text | |
| `stripe_object_id` | text nullable | `pi_*`, `ch_*`, `re_*`, etc. |
| `blitzpay_payment_intent_id` | uuid FK nullable | |
| `org_invoice_id` | uuid nullable | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

**Rule:** Webhook handlers **append** ledger rows; invoice balance updates go through **one** code path that also validates totals.

### 1.5 `blitzpay_webhook_inbox` (optional — for bounded handler + async worker)

If the handler must return fast: insert **raw event id + type + payload hash** (or minimal payload) with `processing_status = 'pending'`, return `200`, then **cron or queue** processes. Alternative: use Stripe **event destination** + external worker — product infra choice.

| Column | Type | Purpose |
|--------|------|---------|
| `stripe_event_id` | text PK | `evt_*` |
| `event_type` | text | |
| `livemode` | boolean | |
| `account` | text nullable | Connected account for Connect events |
| `payload_hash` | text | SHA-256 of raw body for dedupe/debug |
| `processing_status` | text | `pending`, `processing`, `done`, `dead` |
| `attempt_count` | int | |
| `last_error` | text nullable | Truncated |
| `created_at` / `processed_at` | timestamptz | |

**Relation to Phase 1:** `blitzpay_stripe_webhook_events` already stores **processed** ids for idempotency. Phase 2 can either:  
- **(A)** Extend usage: insert on receipt → process → mark done (same row, add columns via migration), or  
- **(B)** Keep `blitzpay_stripe_webhook_events` as “successfully processed evt id” only, and add `blitzpay_webhook_inbox` for **retry/dead-letter** — clearer ops story.

**Recommendation:** **(B)** for clarity: `blitzpay_stripe_webhook_events` = idempotent “done” log; `blitzpay_webhook_inbox` = queue + DLQ (optional in sub-phase 2a if first ship is sync-only).

### 1.6 Org settings (fees / feature flags)

Either extend **`organizations`** or add **`blitzpay_org_settings`**:

- `blitzpay_invoice_pay_enabled` boolean  
- `platform_fee_bps`, `platform_fee_fixed_cents` (with caps)  
- `convenience_fee_mode` enum-like text: `none`, `pass_stripe_cost_estimate`, `fixed_cents`, `bps` (each gated by legal)  
- `max_open_checkout_sessions_per_invoice` int  

Keeps fee config **server-side** and auditable.

---

## 2. Required unique constraints and indexes

### 2.1 Unique constraints (correctness / idempotency)

| Table | Constraint | Rationale |
|-------|------------|-----------|
| `blitzpay_payment_intents` | `UNIQUE (stripe_payment_intent_id)` | One row per PI globally |
| `blitzpay_payment_intents` | `UNIQUE (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL` | One row per CS if used |
| `blitzpay_payment_intents` | `UNIQUE (organization_id, idempotency_key)` | Prevents duplicate creates on retry |
| Optional | `UNIQUE (organization_id, org_invoice_id) WHERE status IN ('processing','requires_payment_method',…)` | **Only if** product mandates one open PI per invoice — often too strict; prefer policy in app + partial index for “open” rows |

### 2.2 Indexes (query hot paths)

| Table | Index | Use |
|-------|-------|-----|
| `blitzpay_payment_intents` | `(organization_id, org_invoice_id, created_at desc)` | Invoice detail, admin lists |
| `blitzpay_payment_intents` | `(organization_id, status, updated_at desc)` | Dashboard “stuck” PIs |
| `blitzpay_invoice_payment_attempts` | `(organization_id, org_invoice_id, attempt_no desc)` | Attempt history |
| `blitzpay_ledger_entries` | `(organization_id, created_at desc)` | Support / audit |
| `blitzpay_ledger_entries` | `(stripe_object_id) WHERE stripe_object_id IS NOT NULL` | Webhook lookup by Stripe id |
| `blitzpay_webhook_inbox` | `(processing_status, created_at)` partial `WHERE processing_status = 'pending'` | Worker dequeue |

### 2.3 RLS (see §8)

Enable RLS on all new tables; **`service_role`** for webhook writes; **authenticated** read for org members where product requires UI.

---

## 3. Stripe Connect flow — charge customer + platform fee

**Primary recommendation (aligned with `docs/BLITZPAY_ARCHITECTURE.md` §2):** **Direct charge on the connected account** with **`application_fee_amount`**.

### 3.1 Preconditions

- `organizations.stripe_connect_account_id` present; `charges_enabled` true (from Phase 1 mapping).  
- Invoice in a state that allows pay (`org_invoices` rules).  
- Amount and fees computed **server-side**; persist `blitzpay_fee_snapshots` then create PI.

### 3.2 API shape (Stripe)

- Use platform **`STRIPE_SECRET_KEY`** with **`Stripe-Account: acct_xxx`** header (or SDK equivalent) for **PaymentIntents.create** on the connected account.  
- Parameters (conceptual):  
  - `amount`, `currency`  
  - `application_fee_amount` = platform fee in smallest currency unit (Stripe docs — must be compatible with direct charge model).  
  - `metadata`: `organization_id`, `org_invoice_id`, `purpose=blitzpay_invoice`, `fee_policy_version`  
  - `automatic_payment_methods` or explicit `payment_method_types` (cards first; ACH later may use different setup).  
- **Idempotency-Key:** e.g. `blitzpay:pi:v1:{organization_id}:{org_invoice_id}:{attempt_token}` — must not collide across different logical attempts; use new `attempt_token` per user click.

### 3.3 Checkout Session alternative

**Stripe Checkout** can be created **on behalf of** connected account with `payment_intent_data.application_fee_amount` (per current Stripe Connect Checkout docs — validate at implementation time).

- **Pros:** Less PCI surface on Equipify; hosted UI.  
- **Cons:** Redirect flow; metadata discipline for webhook correlation (`client_reference_id`, `metadata`).

Either way, persist **`blitzpay_payment_intents`** (and `stripe_checkout_session_id` if used) **before** returning URL to client.

### 3.4 Destination charges (alternative)

Documented in north-star doc as optional. **Do not implement in parallel** with direct charges — pick one for Phase 2.1. If ever switched, new fee + ledger rules required.

### 3.5 After success

- Webhook `payment_intent.succeeded` (and/or `checkout.session.completed` if Checkout) → idempotent handler:  
  - Update `blitzpay_payment_intents.status`  
  - Insert **`org_invoice_payments`** (source = `stripe` / `blitzpay`) via **`lib/billing/invoice-payment-allocation.ts`** (or sibling) so **balance** matches today’s staff-recorded path  
  - Append **`blitzpay_ledger_entries`**  
  - Optionally enqueue QuickBooks outbound payment (future)

---

## 4. Convenience fees — optional pass-through to customer

**Definition:** Any amount **above** the invoice subtotal that the **payer** pays for using card/online (vs cash/check).

### 4.1 Implementation options (product + legal)

| Option | Behavior | Stripe mapping |
|--------|----------|------------------|
| **A — Line item in amount** | `amount_cents` = invoice remaining + convenience; **single** PI; `application_fee_amount` = platform’s slice of total (policy: % of full amount or % of invoice only — **document**). | Simple one charge |
| **B — Separate PI (not recommended v1)** | Two charges — worse UX and reconciliation | Avoid for v1 |
| **C — “Absorb fee”** | Customer pays invoice only; platform or connected account eats processing cost | `application_fee_amount` lower or zero; margin from SaaS |

**Recommendation:** **Option A** with explicit **`convenience_fee_cents`** on `blitzpay_payment_intents` + **`blitzpay_fee_snapshots`** so support can explain the breakdown. **Disclose** line items on hosted Checkout or receipt email.

### 4.2 Legal / compliance guardrails (non-code)

- Do not enable **card surcharge** by default; use **feature flag** + jurisdiction allowlist.  
- ACH may have different rules.  
- Copy: “processing fee” vs “convenience fee” — legal review.

### 4.3 Relationship to `application_fee_amount`

- **Platform fee** = Equipify’s BlitzPay revenue (subject to Stripe’s rules for application fees on Connect).  
- **Convenience fee** = extra paid by customer; **may** increase `application_fee_amount` if Equipify keeps that surcharge as revenue, or **may** flow to connected account only — **finance decision**. Document in `blitzpay_fee_snapshots`.

---

## 5. Webhook handling — idempotency + bounded execution

### 5.1 Endpoint

- **Expand** `POST /api/blitzpay/webhook` (`app/api/blitzpay/webhook/route.ts`) to handle payment-related events **using the same Connect webhook secret** (`STRIPE_BLITZPAY_WEBHOOK_SECRET`) **or** add a second route only if Stripe Dashboard forces split — prefer **one endpoint** to reduce misconfiguration.

### 5.2 Idempotency (ordered steps)

1. **Verify signature** (raw body).  
2. **Insert** `stripe_event_id` into **`blitzpay_stripe_webhook_events`** (existing pattern) **or** inbox table — use **`ON CONFLICT DO NOTHING`** / catch unique violation → return `200 { duplicate: true }` **without** re-running side effects.  
3. **Dispatch** by `event.type` to small pure functions.  
4. **Mark processed** only after DB commit of business updates (or use inbox `processing_status`).

**Critical:** Same pattern as SaaS `app/api/stripe/webhook/route.ts` (insert idempotency before work); consider **deleting** idempotency row on failure only if you want Stripe retry — for **payment** events, prefer **inbox retry** instead of delete to avoid double payment application (design handlers to be **idempotent by `payment_intent_id`**).

### 5.3 Bounded execution time (Vercel / serverless)

| Step | Time budget |
|------|-------------|
| Verify + persist inbox + return 200 | **< 1 s** target |
| Full reconciliation + QB + emails | **Async**: `waitUntil` (if available), **Q worker**, or **cron** scanning `blitzpay_webhook_inbox` |

**Scale audit alignment:** avoid long synchronous chains in the webhook route (`docs/SCALE_READINESS_AUDIT.md` §5, §10).

### 5.4 Event types (Phase 2 minimum set)

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Mark PI, allocate invoice payment, ledger |
| `payment_intent.payment_failed` | Update PI + attempt row; notify |
| `payment_intent.canceled` | Update state |
| `charge.refunded` | Partial/total refund handling + ledger |
| `charge.dispute.created` | Flag PI / invoice; notify (no deep dispute UI required in 2.0) |
| `account.updated` | **Existing** Phase 1 handler — keep |
| `checkout.session.completed` | If Checkout: branch on `metadata.purpose=blitzpay_invoice` only |

**Never** send these events to `/api/stripe/webhook`.

---

## 6. Rate limiting recommendations

Apply **defense in depth** (per `docs/SCALE_READINESS_AUDIT.md` §12 and `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`).

| Surface | Suggested limit |
|---------|-----------------|
| `POST …/blitzpay/pay` (create PI / session) | **Per org:** e.g. 20/hour per invoice + 100/hour per org; **per user:** 10/min |
| Portal invoice pay | **Per IP + portal token:** 10/hour; **per invoice:** 5 session creates / hour |
| `GET …/blitzpay/invoice/{id}/pay-options` | Read-heavy — 60/min per org |
| Webhook | Stripe retries — rely on **idempotency**, not rate limit inbound; **alert** on spike volume |

**Implementation note:** Reuse / extend **`lib/ai/operation-rate-limit`** pattern (`ai_operation_rate_buckets`) or introduce **`blitzpay_rate_buckets`** table keyed by `organization_id` + route purpose.

---

## 7. Admin / support visibility

### 7.1 In-app (platform admin)

- Extend **`/admin`** surfaces (e.g. org account page) with read-only: recent `blitzpay_payment_intents`, webhook errors, Connect status.  
- Files likely touched: `app/admin/**`, `app/api/platform/**`.

### 7.2 In-app (tenant admin)

- **Settings → Payments:** failed attempts, last error, “retry pay link” (permission: owner/admin + `canViewBilling`).  
- **Invoice drawer:** BlitzPay status chip + link to Stripe Dashboard for Express (`stripe_connect_account_id`).

### 7.3 Operational

- **Structured logs:** `JSON.stringify({ source: 'blitzpay-webhook', eventId, type, organizationId, durationMs, outcome })` — mirror SaaS webhook style (`app/api/stripe/webhook/route.ts`).  
- **Dead letter:** `blitzpay_webhook_inbox.processing_status = 'dead'` with `last_error`; nightly job or admin “replay” with manual approval.  
- **Alerts:** Pager / email when DLQ count &gt; threshold or `payment_intent.succeeded` without matching invoice row (integrity check).

---

## 8. Security and RLS

### 8.1 Principles

- **Secrets:** Only server; `STRIPE_SECRET_KEY`, webhook secrets never exposed.  
- **Webhook:** Signature verification mandatory; constant-time compare where applicable.  
- **Org isolation:** Every query filters `organization_id`; RLS **`using (is_org_member(organization_id))`** on new tenant tables.  
- **Service role:** Webhook handler and cron use **`createServiceRoleSupabaseClient`** only **after** org resolved from Stripe id / metadata — **never** trust client-supplied `organization_id` alone for writes.

### 8.2 Metadata discipline

Require **`metadata.organization_id`** (UUID) and **`metadata.org_invoice_id`** on every Connect PI/Checkout for webhook routing if Stripe object does not include org in a queryable field.

### 8.3 Portal

- Pay links must be **token-bound** or short-lived signed URLs; **no** guessable invoice id-only URLs.  
- Reuse portal auth patterns from `app/api/portal/invoices/**` and `lib/portal/*`.

### 8.4 Staff actions

- Refund endpoints: **owner/admin** + explicit permission; audit log to `organization_audit_events` where applicable.

---

## 9. Phased implementation plan (safe checkpoints)

| Sub-phase | Scope | Checkpoint / rollback |
|-----------|--------|------------------------|
| **2.0** | Migrations: `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, fee snapshot + ledger; indexes + RLS; feature flag **`BLITZPAY_INVOICE_PAY_ENABLED=false`** default | Ship dark; no UI |
| **2.1** | Server-only: create PI **test mode**, staff-only API, no portal; webhook `payment_intent.*` updates DB only; **no** `org_invoice_payments` write yet | Validate idempotency + logs |
| **2.2** | Wire **allocation** on `succeeded` only; invoice balance matches; dry-run mode logs “would pay” | Enable for one internal org |
| **2.3** | **Application fee** + `blitzpay_fee_snapshots`; verify Stripe Dashboard application fee | Finance sign-off in test |
| **2.4** | **Checkout** or **Payment Element** UX on invoice + email “Pay now” | Limited beta orgs |
| **2.5** | **Portal** pay link + rate limits | External customers |
| **2.6** | **Convenience fee** (flagged off by default) | Legal sign-off |
| **2.7** | Refunds + `charge.refunded`; minimal dispute surface | Support runbook |
| **2.8** | Async webhook inbox + worker if latency issues | Production hardening |
| **2.9** | QuickBooks payment push / reconcile (optional) | Align with `apply-inbound-paid` |

Each sub-phase should have **E2E tests in Stripe test mode** and a **kill switch** env var.

---

## 10. What should **not** be built yet

- **Payout scheduling UI** to connected bank (Express handles; Equipify can link out).  
- **Full dispute center** (webhook flag + email may suffice for 2.x).  
- **Multi-currency** beyond one pilot currency.  
- **Subscription billing on Connect** (SaaS stays platform).  
- **Blending** SaaS and BlitzPay in one Checkout session.  
- **Automatic card surcharge** in all jurisdictions without legal review.  
- **Destination charges** until direct charge is validated in production-like load.

---

## 11. Implementation touch list (expected files / routes / tables)

Use this as a **checklist** when coding — not exhaustive.

### 11.1 Database (`supabase/migrations/`)

- New migration(s): `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, `blitzpay_fee_snapshots`, `blitzpay_ledger_entries`, optional `blitzpay_webhook_inbox`, optional `blitzpay_org_settings` (or alter `organizations`).  
- Extend **`blitzpay_stripe_webhook_events`** if adding columns vs new inbox table (decision in §5).  
- RLS policies + grants mirroring other org tables (`20260501125600`-style patterns).

### 11.2 Server libraries (`lib/blitzpay/`)

- `connect-stripe.ts` — PaymentIntents / Checkout Session helpers (`Stripe-Account` header).  
- New: `fees.ts` (pure fee math), `invoice-pay.ts` (orchestration), `webhook-dispatch.ts` (event router), `refunds.ts` (later).  
- `access.ts` — extend gates for pay/refund permissions.  
- `org-write-client.ts` — reuse for privileged writes.

### 11.3 API routes (`app/api/`)

- **Extend** `app/api/blitzpay/webhook/route.ts` — new event types; keep SaaS untouched.  
- New org routes (examples):  
  - `POST /api/organizations/[organizationId]/blitzpay/invoices/[invoiceId]/prepare-pay`  
  - `POST /api/organizations/[organizationId]/blitzpay/invoices/[invoiceId]/confirm` (if needed)  
- Portal: `app/api/portal/invoices/[invoiceId]/pay-session` or similar — **token gated**.  
- Optional admin: `app/api/platform/organizations/[organizationId]/blitzpay-diagnostics`.

### 11.4 UI (`app/(dashboard)/`, `components/`)

- `components/drawers/invoice-detail-view.tsx`, `PaymentModal` / pay CTA — BlitzPay path.  
- `app/(dashboard)/settings/payments/page.tsx` — fee display, failed payments.  
- `app/(dashboard)/invoices/page.tsx` — status indicators.  
- Portal pages under `app/portal/**` if pay UI is embedded.

### 11.5 Existing billing / invoice code

- `lib/billing/invoice-payment-allocation.ts` + repository — **append** Stripe-sourced payment type.  
- `org_invoice_payments` — new `source` / `stripe_payment_intent_id` columns **or** strict FK from allocation to `blitzpay_payment_intents` (migration decision).  
- `docs/BLITZPAY_ARCHITECTURE.md`, `docs/BLITZPAY_PHASE_1.md` — cross-links and phase labels.

### 11.6 Config / env

- `.env.local.example` — document any new flags (`BLITZPAY_INVOICE_PAY_ENABLED`, optional second secret if split).  
- Stripe Dashboard: add events to **Connect** webhook; verify endpoint URL matches production.

### 11.7 Tests / observability

- `tests/**` or colocated e2e — webhook idempotency, fee math, allocation.  
- Structured logging helper shared with SaaS webhook pattern.

---

## Related documents

- `docs/BLITZPAY_REMAINING_PHASES_ROADMAP.md` — **Phases 3–15** product/engineering roadmap after Phase 2 foundation.  
- `docs/BLITZPAY_ARCHITECTURE.md` — north star, charge model tradeoffs.  
- `docs/BLITZPAY_PHASE_1.md` — shipped onboarding scope.  
- `docs/BLITZPAY_AUDIT.md` — historical gap analysis.  
- `docs/SCALE_READINESS_AUDIT.md` — pagination, webhooks, rate limits.  
- `docs/STRIPE_PRODUCTION_READINESS.md` — SaaS keys (orthogonal but same Stripe project concerns).

---

## 12. Implementation status

### 12.1 Phase 2A (shipped in repo)

| Area | Details |
|------|---------|
| **Migration** | `20260911120000_blitzpay_phase_2a_foundation.sql` — tables `blitzpay_org_settings`, `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, `blitzpay_fee_snapshots`, `blitzpay_ledger_entries`, `blitzpay_webhook_inbox`; indexes and uniqueness per §2. |
| **RLS** | Org-scoped tables: `authenticated` **SELECT** only with `is_org_member(organization_id)`; **no** authenticated writes. `blitzpay_webhook_inbox`: no grants to `authenticated` (service role only). |
| **Server libs** | `lib/blitzpay/payment-domain.ts`, `money.ts`, `fees.ts`, `idempotency-keys.ts`, `stripe-metadata.ts`, `phase2-feature-flag.ts`, `payment-repository.ts`, `webhook-inbox.ts`, `webhook-phase2-events.ts`, `webhook-phase2-dispatch.ts`. |
| **Webhook (2A baseline)** | `POST /api/blitzpay/webhook` — Phase 1 `account.updated` unchanged. Phase 2 inbox + **mirror** `blitzpay_payment_intents` for `payment_intent.*`. **Phase 2B+** extends dispatch for PI/Checkout completion; **Phase 2E** adds `charge.refunded` + dispute events (see §12.5). |
| **Env** | `BLITZPAY_INVOICE_PAY_ENABLED` — global gate (default off); see `.env.local.example`. Per-org `blitzpay_org_settings.blitzpay_invoice_pay_enabled` for rollout. |

### 12.2 Phase 2B (shipped in repo)

| Area | Details |
|------|---------|
| **API** | `POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay` — authenticated, org-scoped; gates: env `BLITZPAY_INVOICE_PAY_ENABLED`, `blitzpay_org_settings.blitzpay_invoice_pay_enabled`, Connect `charges_enabled` + account id; invoice must belong to org, not void/archived, balance due greater than zero; lightweight rate limits (`lib/blitzpay/blitzpay-rate-limit.ts`, optional `BLITZPAY_RATE_PREPARE_*` env). |
| **Stripe** | **Checkout Session** `mode: payment` on **connected account** (`Stripe-Account`), `payment_intent_data.application_fee_amount`, metadata from `stripe-metadata.ts`, idempotency from `idempotency-keys.ts`, amounts/fees via `money.ts` / `fees.ts`. No client secret or card data in the app UI beyond redirect to Stripe-hosted Checkout. |
| **Persistence** | Before/around Stripe: insert `blitzpay_payment_intents` (stable id), `blitzpay_fee_snapshots`, `blitzpay_invoice_payment_attempts` (`checkout` / `initiated`); retries use new `attemptToken` / idempotency key to avoid duplicate Checkout sessions for the same logical retry policy. |
| **Webhook** | `payment_intent.succeeded` / `payment_intent.payment_failed` / `payment_intent.canceled` + `checkout.session.completed` (paid): mirror PI, then idempotent `org_invoice_payments` via `reference = blitzpay_pi:{payment_intent_id}` and `lib/billing/invoice-payment-allocation.ts` path; ledger `payment_captured` + optional `application_fee_received`; attempt row terminal status; inbox `done` / `dead` per existing inbox rules. |
| **UI** | Invoice Payments tab — “Pay with BlitzPay (hosted)” when permitted; Phase **2D** adds attempt history + clearer BlitzPay references (`components/drawers/invoice-detail-view.tsx`). |
| **Tests** | `pnpm test:blitzpay-phase-2b` (`scripts/test-blitzpay-phase-2b.ts`) — eligibility, metadata, idempotency key shape, fee math. |

### 12.3 Phase 2C (shipped in repo) — customer portal hosted Checkout

| Area | Details |
|------|---------|
| **API** | `POST /api/portal/invoices/[invoiceId]/blitzpay/prepare-pay` — **no staff session**; `requirePortalSession()` + org/customer from `portal_users`; invoice must match portal `customer_id` (wrong id → **404** “Invoice not found.” to avoid enumeration). Same Stripe Checkout + DB persistence path as 2B via `prepareBlitzpayInvoiceHostedCheckout` (`lib/blitzpay/blitzpay-prepare-invoice-pay.ts`). |
| **Return URLs** | Success: `/portal/invoices/{id}?blitzpay=1&status=success`. Cancel: same with `status=cancel`. Built with `getPublicAppOrigin()`. |
| **Metadata / attempts** | Stripe metadata includes `payment_source` = `customer_portal` (staff flow uses `staff_dashboard`). `blitzpay_invoice_payment_attempts.channel` = `portal_link`; `created_by_user_id` null; `portal_access_context` json `{ payment_channel, portal_user_id }`. |
| **Idempotency** | Same `blitzpay:pi:v1:{org}:{invoice}:{attemptToken}` format; portal uses `attemptToken` = `pt_{sha256…24}{nonce}` derived from `blitzpay_portal_prepare:{portalUserId}:{nonce}` so keys are unique per attempt without embedding the portal session cookie. |
| **Rate limits** | Reuses `tryConsumeBlitzpayPreparePaySlots` with principal `portal:{portalUserId}` for the per-principal bucket (distinct from staff auth user ids). |
| **UI** | `app/(portal)/portal/invoices/[invoiceId]/page.tsx` — “Pay online (BlitzPay)” card: pay when eligible, disabled copy when org/env/Connect gates fail, already-paid / draft+void / sub-minimum states, inline error when prepare fails, return banners after Stripe redirect. |
| **Bootstrap** | `GET /api/portal/bootstrap` sets `features.onlinePayments` when hosted Checkout is available for the workspace (same eligibility helper as invoice detail). |
| **Invoice JSON** | `GET /api/portal/invoices/[invoiceId]` includes `blitzpayHostedCheckout` from `getPortalBlitzpayHostedCheckoutEligibility`. |
| **Tests** | `pnpm test:blitzpay-phase-2c-portal` — portal idempotency token shape + `customer_portal` metadata round-trip. |

#### Manual test checklist (Phase 2C)

1. Enable `BLITZPAY_INVOICE_PAY_ENABLED=true`, org `blitzpay_invoice_pay_enabled`, and a Connect account with `stripe_charges_enabled` (test mode).  
2. Sign in to the **customer portal** as a contact with access to a customer that has a **sent** (or similar payable) invoice with balance due **≥ $0.50**.  
3. Open **Invoices → invoice detail**; confirm “Pay online (BlitzPay)” shows **Pay with BlitzPay**.  
4. Click pay → redirect to Stripe Checkout (connected account); complete or cancel.  
5. **Success:** land on portal invoice without query string noise; banner explains confirmation delay; after webhook, balance / payment status update (same as staff-paid flow).  
6. **Cancel:** return to same invoice; banner indicates cancel.  
7. With BlitzPay org pay **disabled** or Connect **not ready**, confirm explanatory disabled copy (no pay button).  
8. Open an invoice id that belongs to **another** customer (same org): expect **404** on GET and prepare-pay.  
9. Staff invoice Payments tab **Pay with BlitzPay (hosted)** still works unchanged.

**Deferred (not Phase 2C):** payout UI; refunds/disputes ship in **Phase 2E** (§12.5).

### 12.4 Phase 2D (shipped in repo) — receipts foundation, payment history, confirmation UX

| Area | Details |
|------|---------|
| **Portal confirmation** | After Stripe success (`?blitzpay=1&status=success`), **Payment update** explains webhook delay; if invoice is already paid / zero balance → **Payment received**; otherwise **confirming** copy + short poll of `GET /api/portal/invoices/[id]` until paid or timeout. Does **not** assert funds captured until allocation shows on the invoice. |
| **Portal payment history** | `GET /api/portal/invoices/[invoiceId]` returns `paymentHistory` (from `org_invoice_payments`) via `mapOrgInvoicePaymentRowToPortalHistory` — masks `blitzpay_pi:*` references as **Electronic confirmation on file**; no Stripe ids, fees, or internal UUIDs in payloads. |
| **Staff visibility** | `GET …/blitzpay/activity` — same permissions; returns **attempts** (as above) plus **refunds** and **disputes** summary rows (tails only where applicable). **Payments tab** lists attempts with source (staff vs customer portal) and status (pending / succeeded / failed / canceled / expired). Recorded payments table shows **BlitzPay (online)** instead of raw `blitzpay_pi:` reference. **Phase 2E** adds per-payment refund sub-rows, disputes card, and **BlitzPay diagnostics** (`GET …/blitzpay/diagnostics`). |
| **Receipt foundation** | `lib/blitzpay/invoice-payment-receipt.ts` — `InvoicePaymentReceiptShape` + `buildInvoicePaymentReceiptShape`. **Phase 2F** wires customer + staff emails and resend (§12.6). |
| **Tests** | `pnpm test:blitzpay-phase-2d` — portal history masking + receipt builder. |

#### Manual test checklist (Phase 2D)

1. Portal invoice with balance due shows **Pay online (BlitzPay)**.  
2. Complete Stripe Checkout (test).  
3. Return URL: **Payment update** shows confirming copy until webhook posts; then **Payment received** when balance is zero / status paid.  
4. **Payment history** lists the posted row with customer-safe reference (no `pi_` / `cs_` strings).  
5. Staff **Payments** tab: recorded payment shows **BlitzPay (online)**; **BlitzPay online attempts** shows the attempt with correct **Source** and **Status**.  
6. Failed or canceled Checkout: attempt row shows **Failed** / **Canceled** (or **Expired**) without marking the invoice paid unless a separate successful webhook posted.  
7. Portal JSON and UI never expose full Stripe ids, platform/application fees, or `blitzpay_payment_intents` internal UUIDs to customers.

**Next (not Phase 2D):** email/PDF receipts using `buildInvoicePaymentReceiptShape`; dispute evidence workflow.

### 12.5 Phase 2E (shipped in repo) — refunds, disputes, diagnostics, reporting helpers

| Area | Details |
|------|---------|
| **Migration** | `20260913120000_blitzpay_phase_2e_refunds_disputes.sql` — `blitzpay_invoice_refunds` (unique `stripe_refund_id`, optional staff `idempotency_key`), `blitzpay_invoice_disputes` (unique `stripe_dispute_id`); RLS **SELECT** for org members; writes service-role / server only. |
| **Staff refund API** | `POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/refund` — body `{ orgInvoicePaymentId, amountCents? }`; `canEditInvoices` **or** `canViewFinancials`; Stripe `refunds.create` on connected account via `createBlitzpayConnectRefund` with `refund_application_fee: true`; books via `applyBlitzpaySucceededRefund` (`lib/blitzpay/blitzpay-refund-apply.ts`). |
| **Net balance** | `reconcileOrgInvoiceFromPayments` and admin invoice hydration subtract **succeeded** rows in `blitzpay_invoice_refunds` from gross `org_invoice_payments` sums. `sumNetRecordedPaymentsCentsForBlitzpay` gates hosted prepare-pay. |
| **Webhooks** | `charge.refunded` → `dispatchBlitzpayChargeRefunded` (expand refunds, idempotent per `stripe_refund_id`). `charge.dispute.created` / `updated` / `closed` → `upsertBlitzpayInvoiceDisputeFromStripe`. |
| **Portal** | `GET /api/portal/invoices/[id]` — **no** dispute payloads; payment summary uses **net** paid; `paymentHistory` appends customer-safe **Card refund (BlitzPay)** lines via `mapBlitzpayRefundToPortalHistory` (negative `amountCents`, no Stripe ids). |
| **Diagnostics** | `GET …/blitzpay/diagnostics` — PI mirror tails, recent `blitzpay_webhook_inbox` for the org Connect account, refunds/disputes for the invoice, and `fetchBlitzpayOrgReportingSnapshot` (optional `?since=` ISO). |
| **Reporting helper** | `lib/blitzpay/blitzpay-reporting-snapshot.ts` — gross ledger `payment_captured`, refunded ledger `refund`, net, online BlitzPay payment row count, completed attempt source split (`portal_link` vs staff channels). |
| **Tests** | `pnpm test:blitzpay-phase-2e` — webhook type coverage + portal refund line shape. |

#### Manual test checklist (Phase 2E)

1. **Full refund** on a BlitzPay card payment succeeds; invoice balance returns toward due; `blitzpay_invoice_refunds` row `succeeded`.  
2. **Partial refund** then second partial until fully refunded — each step respects remaining refundable.  
3. **Duplicate** `charge.refunded` webhook delivery does **not** double-book (unique `stripe_refund_id`).  
4. **Dispute** webhook creates/updates a staff-visible dispute row; **portal** JSON has **no** dispute fields.  
5. **Diagnostics** JSON shows PI rows + inbox tail + replay-safety notes.  
6. **Idempotency-Key** / server idempotency: repeat staff refund POST with same key returns the same outcome without double Stripe calls (Stripe idempotency window).

### 12.6 Phase 2F (shipped in repo) — receipt email, staff alerts, resend, idempotency

| Area | Details |
|------|---------|
| **Migration** | `20260913150000_blitzpay_phase_2f_receipt_dispatches.sql` — `blitzpay_payment_receipt_dispatches` (append-only log + idempotency). **Partial unique indexes:** at most one `webhook_auto` row per `(blitzpay_payment_intent_id, customer_receipt)` and per `(blitzpay_payment_intent_id, staff_alert)` so Stripe webhook replays do not enqueue duplicate automatic sends. `20260913151000_blitzpay_receipt_dispatch_skipped_preference.sql` extends `send_status` with `skipped_preference` when automatic customer email is suppressed by `customers.invoice_delivery_preference`. |
| **View model** | `lib/blitzpay/blitzpay-payment-receipt-view-model.ts` + `blitzPayPaymentReceiptViewModelToCustomerJson` — customer-safe fields only (no raw Stripe ids, fees, or ledger metadata). |
| **Dispatch** | `lib/blitzpay/blitzpay-receipt-email-dispatch.ts` — builds receipt from `buildInvoicePaymentReceiptShape` + Resend templates in `lib/email/templates/blitzpay-payment-receipt-content.ts`. **Webhook:** `completeBlitzpayPaymentIntentSucceeded` calls `dispatchBlitzpayPaymentReceiptEmails` **after** first successful `org_invoice_payments` insert (same block as ledger `payment_captured`), wrapped so email never fails booking. **Staff resend:** `POST …/blitzpay/resend-receipt` with `{ blitzpayPaymentIntentInternalId }` → `executeStaffBlitzpayReceiptResend`. |
| **Preferences** | `lib/blitzpay/blitzpay-receipt-email-policy.ts` — automatic customer receipt is skipped when `invoice_delivery_preference` is `portal`, `mail`, or `manual` (null/`email` allows send). Staff resend **overrides** preference. |
| **Staff UI** | Invoice **Payments** tab: **Resend** on succeeded BlitzPay attempts when `GET …/blitzpay/activity` reports `outboundEmail.configured` (mirrors `isOutboundEmailConfigured()`). |
| **Tests** | `pnpm test:blitzpay-phase-2f` — receipt JSON safety + policy + idempotency notes. |

#### Manual test checklist (Phase 2F)

1. With Resend env set, pay an invoice via BlitzPay: customer receives **Payment received** email (masked reference, portal link, no `pi_` in body).  
2. Replay the same `payment_intent.succeeded` delivery (Stripe CLI or duplicate event): **no second** automatic customer receipt (DB unique + skip).  
3. Customer with **no** invoice/customer billing email: payment still books; dispatch row `skipped_no_email` (check logs / DB if needed).  
4. Customer with `invoice_delivery_preference = portal`: automatic receipt skipped (`skipped_preference`); **Resend** from staff still sends if mail is configured.  
5. Staff digest email arrives for owner/admin when configured; contains no Stripe object ids.  
6. **Resend** from Payments tab succeeds and appends a `staff_resend` dispatch row (multiple resends allowed).

### 12.7 Schema health (deployments)

| Area | Details |
|------|---------|
| **Helper** | `lib/blitzpay/blitzpay-schema-health.ts` — service-role probes for onboarding diagnostic columns on `organizations` and for core BlitzPay tables (`blitzpay_org_settings`, `blitzpay_payment_intents`, `blitzpay_invoice_payment_attempts`, `blitzpay_fee_snapshots`, `blitzpay_invoice_refunds`, `blitzpay_invoice_disputes`, `blitzpay_webhook_inbox`, `blitzpay_payouts`, `blitzpay_balance_transactions`, `blitzpay_reconciliation_runs`, `blitzpay_customer_payment_profiles`). Results are cached ~60s. |
| **Routes** | BlitzPay **status**, **enable**, **sync**, **account-link**, invoice **activity**, **diagnostics**, **prepare-pay** (staff + portal), **refund**, **resend-receipt**, and **payout-ledger** call the guard first. On drift, APIs return **503** with `error: "blitzpay_schema_incomplete"` and a stable `message` for UI (not raw PostgREST text). |
| **Logs** | `source: "blitzpay-schema-health"` JSON logs include `missing` (e.g. `table:blitzpay_invoice_refunds` or `organizations.blitzpay_last_onboarding_attempt_at`) and a short `detail` from Postgres/PostgREST. |
| **Fix** | Point the app at the correct Supabase project and **apply pending migrations** (`supabase db push` / CI migration pipeline). The guard only treats **known** missing-relation/column signals as drift; other failures still surface from the underlying handlers. |

### 12.8 Phase 2G (platform-managed fee disclosure, payout visibility)

| Area | Details |
|------|---------|
| **Platform-managed fee policy** | Migration `20260914120000_blitzpay_phase_2g_merchant_controls.sql` extends `blitzpay_org_settings` with fee policy fields (`pass-through`, mode, percentage snapshot, cap, disclosure). Workspace Settings no longer exposes fee editing; platform/admin paths control fee policy server-side. |
| **Fee disclosure** | `previewBlitzpayInvoiceHostedCheckout` in `lib/blitzpay/blitzpay-prepare-invoice-pay.ts` computes balance/processing-fee/total. Staff + portal prepare-pay routes expose `GET` preview and UI shows pricing disclosure before redirect to Stripe Checkout. |
| **Charge math** | Hosted Checkout now charges `invoiceBalance + convenienceFee` when pass-through is enabled. `blitzpay_payment_intents.convenience_fee_cents` stores customer convenience fee separately while existing `application_fee_amount` behavior remains platform-fee controlled. |
| **Payout visibility** | `fetchBlitzpayOrgReportingSnapshot` now includes convenience fees collected, estimated Stripe fees, refunded fee estimate, and estimated net merchant payout. |
| **Safety controls** | Normal workspace PATCH calls cannot update fee percentage/cap/disclosure/pass-through fields. Online payments toggle remains workspace-configurable; fee controls are platform-managed. Status API returns test/live mode hint from Stripe secret key prefix. |

#### Manual test checklist (Phase 2G)

1. Merchant absorbs fees: disclosure shows zero processing fee and Checkout total equals invoice balance.  
2. When platform pass-through is enabled, disclosure shows fee + total and Checkout total matches disclosure.  
3. Portal and staff both show fee disclosure before Stripe redirect.  
4. Refund flow still caps by remaining refundable amount and avoids replay double-booking.  
5. Settings payout visibility loads without exposing Stripe object ids.  
6. Workspace owners/admins cannot modify convenience-fee fields via settings PATCH; platform admins can via internal/admin-level code paths.

### 12.9 Phase 2H (payout ledger, balance transactions, reconciliation)

| Area | Details |
|------|---------|
| **Migrations** | `20260915130000_blitzpay_phase_2h_payout_ledger.sql` — `blitzpay_payouts` (Stripe `po_…`, org-scoped), `blitzpay_balance_transactions` (Stripe `txn_…`, unique per org), `blitzpay_reconciliation_runs` (manual + `payout.paid` audit). RLS: org members **select** only; writes are service-role/server. |
| **Stripe sync** | `lib/blitzpay/blitzpay-payout-sync.ts` — resolves workspace from `organizations.stripe_connect_account_id`, **upserts** payouts on webhook, lists **balance transactions per payout** on the connected account (paginated), **upserts** rows and links `blitzpay_payment_intent_id` when the charge id matches a `payment_captured` ledger row. |
| **Webhooks** | `payout.created` / `paid` / `updated` / `failed` / `canceled` are Phase-2 routed (`webhook-phase2-events.ts`); handler is idempotent via Stripe id + DB upsert keys. `payout.paid` appends a `blitzpay_reconciliation_runs` success row with counts. |
| **Reconciliation math** | `lib/blitzpay/blitzpay-reconciliation-math.ts` — pure sums by balance `type` (excludes `payout*` rows from “activity” totals). Used in reporting, invoice diagnostics, and tests. |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` prefers synced balance transactions in the window (`reportingSource: balance_transactions`) for fees + net; adds `paidOutToBankCents` from paid payouts. Falls back to Phase 2G estimates when no rows exist. |
| **APIs** | `GET/POST /api/organizations/[organizationId]/blitzpay/payout-ledger` — GET: `canEditInvoices` **or** `canViewFinancials`; POST: owner/admin BlitzPay gate (`gateBlitzPayManagement`), pulls recent payouts from Stripe. |
| **UI** | Settings → **Payments**: “Payout ledger (staff)” for financial viewers; **not** exposed on portal. Invoice **BlitzPay diagnostics** JSON adds `balanceTransactionReconciliation` when synced lines exist for the invoice’s payment intents. |
| **Tests** | `pnpm test:blitzpay-phase-2h` |

#### Manual test checklist (Phase 2H)

1. After a successful BlitzPay payment and Stripe payout, **webhook** or **POST payout-ledger** creates/updates `blitzpay_payouts` and non-duplicate `blitzpay_balance_transactions`.  
2. **Refunds** reduce net via negative refund balance lines (and existing ledger refund entries unchanged).  
3. **Disputes** appear as dispute-typed balance lines when Stripe includes them in the payout’s transaction set.  
4. **Replay** the same payout webhook or sync: row counts stable (upsert keys).  
5. Staff with financial permissions see payout ledger + diagnostics reconciliation; **portal** APIs unchanged (no payout payloads).  
6. **prepare-pay** / invoice pay flow still succeeds (schema guard includes new tables).

### 12.10 Phase 2I (multi-method, ACH foundation, stored payment profiles)

| Area | Details |
|------|---------|
| **Migrations** | `20260916110000_blitzpay_phase_2i_multi_method_profiles.sql` adds org method toggles (`card`, `us_bank_account`), ACH timeline/fee knobs, save-method toggle, PaymentIntent method metadata columns, and `blitzpay_customer_payment_profiles` (org+customer unique, Stripe reference-only). |
| **Checkout architecture** | `prepareBlitzpayInvoiceHostedCheckout` now returns `availablePaymentMethods` + ACH timing + save-method eligibility in preview. POST accepts optional `paymentMethodType` to pin Stripe Checkout to the selected method and keep fee disclosure aligned. |
| **Stripe safety** | Stripe-hosted collection remains required (no local bank/PAN storage). Checkout session uses `payment_method_types`, `customer_creation`, and optional `setup_future_usage=off_session` when org allows save-method foundation. |
| **Stored profiles** | `lib/blitzpay/blitzpay-payment-profiles.ts` upserts reference-only profile rows from succeeded PaymentIntents (`stripe_customer_id`, last/default method type flags, off-session authorization markers, autopay-eligibility foundation bit). |
| **Autopay foundations** | `lib/blitzpay/blitzpay-autopay-foundation.ts` exposes pure eligibility hooks for future off-session invoice charging. No automatic charging or recurring billing is enabled in this phase. |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` adds method mix (`card` vs `us_bank_account`) and ACH settlement state counters (pending/settled/failed). Status endpoint includes stored-profile summary for staff/admin visibility. |
| **UI** | Portal and staff payment UX show method options and ACH timing copy before redirect. Settings → Payments adds method toggles, ACH fee/timeline controls, and stored-profile counts. Portal does not expose payment-method management surfaces. |
| **Tests** | `pnpm test:blitzpay-phase-2i` and updated 2G fee tests for ACH fee gating. |

#### Manual test checklist (Phase 2I)

1. Card-only org still shows card checkout flow unchanged.  
2. ACH-enabled org shows ACH option in portal/staff payment preview before redirect.  
3. ACH timing copy appears for ACH selection.  
4. Completed payment upserts/updates a stored payment profile row without exposing raw PM ids in portal payloads.  
5. Webhook replay keeps profile rows stable (upsert on org+customer).  
6. Refund/dispute/payout reconciliation paths still operate and existing tests stay green.

### 12.11 Phase 2J (automated collections, recovery, hosted payment links)

| Area | Details |
|------|---------|
| **Migrations** | `20260917120000_blitzpay_phase_2j_collections_automation.sql` adds `blitzpay_payment_links`, `blitzpay_payment_reminders`, `blitzpay_reminder_runs`, `blitzpay_recovery_cases`, and `blitzpay_collections_timeline` with org-scoped RLS select policies for staff visibility. |
| **Reminder orchestration** | `lib/blitzpay/blitzpay-collections.ts` introduces run-safe reminder scheduling (`before_due`, `due_date`, overdue windows), suppression rules (paid/void/archived/preference/email guardrails), and idempotent keys per invoice+reminder window. |
| **Payment links** | Hosted invoice links are minted as opaque tokens (`bpl_…`), stored hashed (`sha256`) and resolved through `GET /portal/pay/[token]` to keep customer routing in portal-safe flow. Staff generate/copy links via `POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/payment-link`. |
| **Recovery foundations** | Recovery case rows track stage/status/reason/recommendations and last reminder/attempt metadata (no auto-charge/autopay execution). Activity API now returns collections + recovery payload for invoice-level support operations. |
| **AI-assisted insights** | Read-only recommendations are derived from invoice attempts/history (abandonment trend, ACH candidate, overdue collectible signal) and surfaced to staff in invoice Payments activity. |
| **Revenue reporting** | Status API now includes `collectionsReporting` snapshot: reminder effectiveness rate, average payment delay days, recovered revenue estimate, and abandoned checkout invoice count. |
| **Operational APIs** | `POST /api/cron/blitzpay-reminders` runs reminder dispatch behind `CRON_SECRET`; retries are replay-safe via DB idempotency keys and status updates. |
| **Tests** | `pnpm test:blitzpay-phase-2j` covers reminder eligibility/suppression, idempotency key stability, payment-link token shape, and recovery recommendation baseline logic. |

#### Manual test checklist (Phase 2J)

1. Reminder sends include valid `/portal/pay/{token}` links and can be opened safely.  
2. Paid/void invoices and archived customers are suppressed from reminder dispatch.  
3. Overdue invoices appear with recovery stage/status in staff activity panel.  
4. Repeated unsuccessful attempts surface abandonment insight text in staff UI.  
5. Card/ACH flows from hosted payment remain unchanged after payment-link entry.  
6. Replaying reminder runs does not duplicate the same reminder kind for the same invoice window.  
7. Portal entry from payment-link keeps customer experience limited to safe hosted invoice pay flow.

### 12.12 Phase 2K (autopay authorization, scheduled invoice payments, partial payments)

| Area | Details |
|------|---------|
| **Migrations** | `20260918120000_blitzpay_phase_2k_autopay_schedule_partial.sql` — org toggles for partial + scheduled pay; autopay authorization columns on `blitzpay_customer_payment_profiles`; `blitzpay_autopay_consent_events` and `blitzpay_scheduled_invoice_payments`; attempt channel `scheduled_off_session`; timeline event types for schedule/autopay. |
| **Consent & copy** | `lib/blitzpay/blitzpay-consent-copy.ts` — version token `BLITZPAY_AUTOPAY_CONSENT_COPY_VERSION` and customer-facing `BLITZPAY_FUTURE_PAYMENT_AUTHORIZATION_COPY`. Portal **POST** `prepare-pay` requires `acknowledgeFuturePaymentAuthorization` when save-methods are allowed. |
| **Partial math** | `lib/blitzpay/blitzpay-phase2k-partial-math.ts` — `effectivePartialPaymentsEnabled`, `clampInvoicePortionCents`, `remainingBalanceAfterPortion`, `buildScheduledExecutionStripeIdempotencyKey`. Org + platform flags gate partial pay; minimum portion defaults to 50¢. |
| **Prepare / preview** | `previewBlitzpayInvoiceHostedCheckout` / `prepareBlitzpayInvoiceHostedCheckout` accept optional `invoicePortionCents`; preview returns `paymentTowardInvoiceCents`, `remainingBalanceAfterPaymentCents`, and `phase2k` dashboard payload. **GET** prepare-pay (staff + portal) supports `?invoicePortionCents=` for repricing. |
| **Scheduled execution** | `lib/blitzpay/blitzpay-scheduled-payments.ts` — create/cancel schedule; `runBlitzpayScheduledPaymentsDue` locks `pending` → `processing`, validates invoice balance + active autopay + default PM with Stripe, creates off-session PI with stable Stripe idempotency key `blitzpay:scheduled_pi:v1:{scheduleId}`; failures upsert recovery case + `logCommunicationEvent`. `POST /api/cron/blitzpay-scheduled-payments` (CRON_SECRET). |
| **Webhooks** | Completion handler updates `blitzpay_scheduled_invoice_payments` when PI metadata includes `scheduled_payment_id`. |
| **Staff / portal UI** | Invoice Payments tab: Phase 2K summary (profile, authorization, schedules, partial history), cancel pending schedule, staff schedule form with consent checkbox, revoke autopay. Attempt table labels `scheduled_off_session` as “Scheduled payment”. Portal: optional partial amount, authorization checkbox when save-methods on, read-only schedule status + schedule form when eligible. |
| **Settings** | `PATCH /api/organizations/[organizationId]/blitzpay/settings` exposes partial + schedule toggles; `blitzpay_platform_partial_payments_allowed` is **platform-admin only** (`picksPlatformOnlyOrgSettings`). |

#### Manual test checklist (Phase 2K)

1. With partial payments disabled, Checkout preview and charge always target **full** balance due.  
2. With partial enabled (org + platform), portal/staff preview shows **toward invoice**, **fee**, and **remaining** when a portion is set.  
3. Customer cannot start portal Checkout with save-methods on until **authorization** checkbox is checked.  
4. Creating a schedule requires saved profile + **active** autopay authorization + schedule consent; server rejects ineligible invoices.  
5. Cron run on a due schedule is **idempotent** (second pass skips non-pending rows).  
6. Successful scheduled payment still triggers receipt path like other succeeded intents; failure surfaces recovery/notification (not silent).  
7. Staff can **cancel** a pending schedule and **revoke** autopay; raw Stripe PM ids never appear in API/UI payloads tested here.

### 12.13 Phase 2L (admin operations, rollout controls, launch readiness)

| Area | Details |
|------|---------|
| **Migrations** | `20260919120000_blitzpay_phase_2l_operations_rollout.sql` — org toggles `blitzpay_reminders_enabled`, `blitzpay_receipt_emails_enabled`; reminder run `trigger` accepts `dry_run`; receipt dispatch status `skipped_org_disabled`. |
| **Platform admin** | `GET /api/platform/blitzpay/operations` aggregates enabled orgs, volume, failed attempts, disputes/refunds, webhook dead rows (24h), reminder health, stale Connect sync, schema health, and computed **alerts**. Platform Admin UI tab **BlitzPay Ops** (`components/admin/blitzpay-operations-content.tsx`) surfaces the summary, alert strip, dry-run / manual reminder dispatch (`POST /api/platform/blitzpay/reminder-dispatch`), and run history (`GET /api/platform/blitzpay/reminder-runs`). |
| **Reminder controls** | `runBlitzpayReminderDispatch(admin, { dryRun, manual })` — dry run records a `dry_run` trigger row and skips writes/sends; manual platform POST always passes `manual: true`. Cron `POST /api/cron/blitzpay-reminders` keeps default cron trigger. |
| **Payment links** | `POST .../blitzpay/payment-links/[linkId]` with `action: revoke \| expire \| regenerate` — staff (`canEditInvoices`); regenerate expires the prior link then mints a new hashed token; response returns `{ url }` once for clipboard copy only. |
| **Org rollout & staff UX** | `PATCH .../blitzpay/settings` includes reminder + receipt email toggles (not fee policy). `GET .../blitzpay/status` adds `operationalAlerts` (schema, platform-wide dead webhooks count, Connect charges readiness). Settings → Payments shows alerts, toggles, and **launch readiness** from `GET .../blitzpay/launch-readiness` (gated by `gateBlitzPayManagement`). |
| **Launch checklist** | `lib/blitzpay/blitzpay-launch-readiness.ts` — **`buildBlitzpayLaunchWorkspaceChecklist`**: product copy only (no raw env var names) for workspace owners/admins. **`buildBlitzpayLaunchTechnicalDiagnostics`**: env keys + schema probe text, returned as `technicalDiagnostics` **only** when the caller is a platform admin. Response includes `presentation` (`statusPhrase`, `subline`) for “Launch readiness: …” UI. |
| **Tests** | `pnpm test:blitzpay-phase-2l` — launch checklist / rollout expectations, reminder trigger selection, static checks that platform routes enforce `isPlatformAdminEmail`, payment-link route gates `canEditInvoices`. |

#### Manual test checklist (Phase 2L)

1. Non–platform-admin receives **403** on `/api/platform/blitzpay/operations`, `reminder-dispatch`, and `reminder-runs`.  
2. Platform admin **dry run** increments `blitzpay_reminder_runs` with `trigger=dry_run` and does not send mail.  
3. **Revoke / expire** updates link status; **regenerate** leaves only one active link and copies the new URL once.  
4. Org owners toggle **reminders** and **receipt emails**; reminder dispatch skips disabled orgs; receipt dispatch can mark `skipped_org_disabled`.  
5. **Launch readiness** shows the same friendly checklist to workspace admins and platform admins; platform admins also receive `technicalDiagnostics` and can expand **Technical details** on Settings → Payments or use **Admin → BlitzPay Ops**.  
6. Settings **operational alerts** surface schema and webhook signals without exposing fee policy internals.

### 12.14 Phase 2M (estimates, deposits, financing foundations)

| Area | Details |
|------|---------|
| **Migrations** | `20260920120000_blitzpay_phase_2m_estimates_deposits.sql` — `org_quotes` deposit mode (`none`, `acceptance`, `fixed`, `percentage`, `full_prepay`), fixed/% fields, collected + target cents, `blitzpay_converted_invoice_id`, financing flag + JSON metadata; `blitzpay_payment_intents.org_quote_id`; `blitzpay_payment_links` / `blitzpay_invoice_payment_attempts` / `blitzpay_ledger_entries` XOR invoice vs quote targets. |
| **Deposit math** | `lib/blitzpay/blitzpay-estimate-deposit-math.ts` — pure target + remaining balance helpers. |
| **Prepare / hosted checkout** | `lib/blitzpay/blitzpay-prepare-quote-pay.ts` — `previewBlitzpayQuoteHostedCheckout` / `prepareBlitzpayQuoteHostedCheckout` (staff + portal); Stripe metadata `blitzpay-estimate-stripe-metadata`; ledger completion `webhook-estimate-deposit-completion.ts` with `revenue_recognition: "estimate_deposit"` (does not replace invoice revenue). |
| **Invoice credit** | `lib/blitzpay/blitzpay-quote-deposit-apply.ts` — idempotent `org_invoice_payments` row keyed by `blitzpay_quote_deposit_apply:{quoteId}`; `POST .../quotes/[quoteId]/blitzpay/apply-deposit-credit` after **estimate → invoice** conversion. |
| **Refunds** | `applyBlitzpayStripeRefundToQuoteDeposit` routes quote-only intents; decrements `blitzpay_deposit_collected_cents` when applicable. |
| **Payment links** | `createBlitzpayQuotePaymentLink`; `resolveBlitzpayPaymentLinkToken` returns `kind: "invoice" \| "quote"`; portal `/portal/pay/[token]` redirects to invoice or **quote** detail with `blitzpay_link=1`. |
| **APIs** | Org: `GET/POST .../quotes/[quoteId]/blitzpay/prepare-pay`, `GET/POST .../payment-link`, `POST .../apply-deposit-credit`, `POST .../payment-links/[linkId]` (revoke/expire/regenerate). Portal: `GET /api/portal/quotes/[quoteId]`, `GET/POST .../blitzpay/prepare-pay`. |
| **UX** | Portal quote detail (`/portal/quotes/[quoteId]`) shows estimate total, deposit, remaining, fee preview, financing-ready copy. Staff **quote drawer** shows BlitzPay block (mode, collected, remaining, financing flag, hosted checkout + payment link). |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` adds `estimateDepositCapturedCents`, `invoiceStylePaymentCapturedCents`, `quotesWithBlitzpayDepositCollected`, `financingReadyQuotesCount` (estimate deposit volume is split from invoice-style captured ledger rows). |
| **Tests** | `pnpm test:blitzpay-phase-2m` — deposit math, apply reference stability, static route/source checks. |

#### Manual test checklist (Phase 2M)

1. Staff sets deposit mode on a quote; **preview** shows correct deposit + fee before redirect.  
2. Customer completes hosted checkout; `blitzpay_deposit_collected_cents` increases once (webhook idempotent).  
3. **Convert to invoice** applies deposit credit without duplicate `org_invoice_payments` rows on retry.  
4. **Payment link** for a quote opens portal quote pay flow (not invoice).  
5. Refund on a quote-only PI reduces collected deposit when ledger rules allow.  
6. Reporting snapshot shows estimate deposit volume separately from invoice-style captures.

### 12.15 Phase 2N (native customer wallet, credits, unified balance)

| Area | Details |
|------|---------|
| **Migrations** | `20260921120000_blitzpay_phase_2n_customer_wallet.sql` — `blitzpay_customer_wallets` (org + customer unique; `available_credit_cents`, `refundable_credit_cents`); `blitzpay_customer_wallet_ledger` (`entry_kind`, signed `amount_cents`, `idempotency_key` partial unique per org, optional `org_invoice_id` / `org_quote_id` / `work_order_id`). RLS: authenticated **select**; writes via service role in APIs. |
| **Core** | `lib/blitzpay/blitzpay-customer-wallet.ts` — `getOrCreateBlitzpayCustomerWallet`, replay-safe `appendBlitzpayCustomerWalletLedger`, `creditBlitzpayWalletOverpaymentFromInvoicePayment` (Stripe PI–keyed), `appendBlitzpayManualWalletCredit`, `sumUnappliedEstimateDepositCentsForCustomer`, `fetchBlitzpayCustomerWalletSummary`, `applyBlitzpayWalletCreditToInvoice` (ledger debit then `org_invoice_payments` with rollback credit on insert failure), `clawbackBlitzpayWalletOverpaymentForStripeRefund`. |
| **Webhooks / refunds** | Invoice pay completion posts overpayment to wallet when `customer_id` is known; refund apply triggers wallet clawback for credited overpayments. |
| **APIs** | `GET …/customers/[customerId]/blitzpay/wallet` (`canViewFinancials` **or** `canViewBilling`); `POST …/wallet/manual-credit` (`canViewFinancials`); `POST …/wallet/apply-invoice` (**both** `canEditInvoices` and `canViewFinancials`); `GET /api/portal/wallet` — customer-safe JSON (no raw Stripe objects). |
| **Staff UX** | Customer profile: `CustomerBlitzpayWalletCard`. Invoice **Payments** tab: wallet summary + apply-credit form when permitted. |
| **Portal UX** | Dashboard “Account balance” — credit on account, applied credits, deposits on open estimates, outstanding invoices (plain language). |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` adds wallet totals (`customerWalletSpendableCreditTotalCents`, `customerWalletRefundableCreditTotalCents`, `customerUnappliedEstimateDepositTotalCents`, windowed `customerWalletAppliedToInvoicesWindowCents`, `customerWalletCreditInflowWindowCents`); exposed on `GET …/blitzpay/status` under `payoutVisibility`. |
| **Tests** | `pnpm test:blitzpay-phase-2n` — static/idempotency/refund/ledger integrity checks. |

#### Manual test checklist (Phase 2N)

1. Overpayment on hosted invoice pay increases **spendable** wallet credit once (replay webhook → no double credit).  
2. **Apply credit** to an invoice debits wallet and creates a single `org_invoice_payments` reference; repeat with same idempotency → no duplicate payment.  
3. **Manual credit** (financials role) increases balance; billing-only can view wallet but not post manual credit.  
4. **Refund** of an overpayment-backed PI runs wallet clawback up to credited amount.  
5. Portal wallet response contains **no** Stripe payment intent or PM identifiers.  
6. Reporting snapshot / status includes org-wide wallet and unapplied estimate deposit totals.

### 12.16 Phase 2O (financing integrations, installment plans, revenue acceleration)

| Area | Details |
|------|---------|
| **Migrations** | `20260922120000_blitzpay_phase_2o_financing_installments.sql` — `blitzpay_org_settings` flags (`blitzpay_financing_enabled`, `blitzpay_installment_plans_enabled`, `blitzpay_financing_monthly_estimate_disclosure`); catalog `blitzpay_financing_providers`; org toggles `blitzpay_org_financing_providers`; `blitzpay_financing_sessions` / `blitzpay_financing_offers` (opaque `external_*_ref` only, no underwriting payloads); `blitzpay_payment_plans` + `blitzpay_payment_plan_installments` (anchor invoice or quote; payments still via `org_invoice_payments`). |
| **Pure libs** | `blitzpay-financing-status.ts`, `blitzpay-payment-plan-math.ts`, `blitzpay-financing-eligibility.ts`, `blitzpay-revenue-acceleration-insights.ts`, `blitzpay-portal-financing-copy.ts`, `blitzpay-payment-plan-service.ts` (idempotent plan create; cancels prior active/draft plans on same invoice). |
| **APIs** | `GET …/blitzpay/financing/summary` (staff); `GET/POST …/invoices/[invoiceId]/blitzpay/payment-plan` (POST requires `canEditInvoices` + `canViewFinancials`, installments org-flag). |
| **UX** | Settings → Payments: revenue acceleration toggles + optional monthly estimate copy. Quote drawer: read-only insights. Invoice Payments: installment schedule + templates. Portal quote: customer-safe “Payment options” card from `portalFinancing`. |
| **Reporting** | Snapshot adds active plan count, installment paid cents total, financing session counts, deposit-before-work quote counts; surfaced on `GET …/blitzpay/status` `payoutVisibility`. |
| **Tests** | `pnpm test:blitzpay-phase-2o` — math, eligibility, migration markers, API wiring static checks. |

#### Manual test checklist (Phase 2O)

1. Enable **installment plans** in Payments settings; create a **25/50/25** plan on an open invoice; reload — same idempotency key does not duplicate rows.  
2. **Financing summary** lists provider catalog + org toggles (no secrets).  
3. Portal quote shows **Payment options** when org financing is on; copy stays non-committal (not a credit offer).  
4. Reporting / status includes new **payoutVisibility** fields when migrations are applied.

### 12.17 Phase 2P (work order BlitzPay panel, field collection, WO-linked plans)

| Area | Details |
|------|---------|
| **Migrations** | `20260923210000_blitzpay_phase_2p_work_order_collection.sql` — `work_orders.blitzpay_field_invoice_later_at` (technician “invoice by email later” preference); index `idx_blitzpay_payment_plans_org_work_order` for `(organization_id, work_order_id)` lookups. |
| **Permissions** | `canAssistBlitzpayCollection` — work-order scoped **collection** (copy/create hosted pay links, open checkout URL, mark invoice-later). Does **not** grant refunds, disputes, fee settings, or wallet apply (those stay on `canEditInvoices` / `canViewFinancials` combinations as before). |
| **Server** | `fetchWorkOrderBlitzpaySummary` aggregates linked invoices/quotes, wallet buckets (no Stripe ids), payment plans (including `work_order_id`), sanitized recent payments (`displayReference` only), payment link activity rows, financing session counts. `assertInvoiceLinkedToWorkOrder` guards collect routes. |
| **APIs** | `GET …/work-orders/[workOrderId]/blitzpay/summary` (`canViewFinancials` **or** `canAssistBlitzpayCollection`); `POST …/collect/payment-link` (metadata `source: "work_order_collect"`); `POST …/collect/open-checkout` returns **`{ url }` only** in field mode (no `checkoutSessionId`); `POST …/field-invoice-later`; `POST …/blitzpay/payment-plans/[planId]/link-work-order` (`canEditInvoices` + `canViewFinancials`). Invoice `POST …/blitzpay/payment-plan` accepts optional `workOrderId` when the invoice is linked to that WO. |
| **UX** | Work order drawer → **BlitzPay** compact section (`WorkOrderBlitzpayPanel`): balances, estimates/deposits, wallet visibility, apply-credit (edit invoice + view financials only), installment progress, staff “attach plan” by UUID, field-safe pay actions + QR hint (`mailto` / copy / hosted tab). |
| **Reporting** | Snapshot adds `blitzpayWorkOrderCollectPaymentLinksWindowCount` (payment links with `metadata @> { source: "work_order_collect" }`) and `workOrdersFieldInvoiceLaterWindowCount`; exposed on `GET …/blitzpay/status` `payoutVisibility`. |
| **Tests** | `pnpm test:blitzpay-phase-2p` — static wiring, permission matrix spot checks, no raw Stripe strings in work-order summary module, field checkout JSON shape. |

#### Manual test checklist (Phase 2P)

1. Open a work order with a linked invoice — **BlitzPay** section loads; balances match invoice tab (no Stripe ids in the payload).  
2. As **technician** with assist permission: create pay link, open checkout (response has URL only), mark **invoice later** — no wallet apply or plan attach UI.  
3. As **billing staff**: apply wallet credit to a linked invoice from the panel; idempotency replay does not double-apply.  
4. Attach an existing plan UUID whose invoice is linked to the WO — `work_order_id` updates on the plan row.  
5. Reporting / status shows new **payoutVisibility** counters after activity in the window.

### 12.18 Phase 2Q (revenue intelligence, forecasting, executive reporting)

| Area | Details |
|------|---------|
| **Pure libs** | `blitzpay-revenue-forecast-math.ts` — wallet liability sum, overdue recovery multiplier, horizon forecast composition. `blitzpay-revenue-recommendations.ts` — read-only heuristic insights (no LLM). |
| **Server** | `blitzpay-revenue-intelligence.ts` — `fetchBlitzpayOrgRevenueIntelligence` composes `fetchBlitzpayOrgReportingSnapshot`, `computeBlitzpayCollectionsReporting`, overdue AR (invoice allocation), scheduled payments, installment remainders, disputes, pending payouts, recovery cases, ACH pending settlement; returns `dashboard`, `forecasts`, extended `collections`, `recommendations`, and `reportingSource` for UI consistency. `fetchBlitzpayPlatformRevenueRollup` — bounded platform-wide ledger sum, PI count, open disputes sample, wallet liability sum (capped rows). |
| **APIs** | `GET …/blitzpay/revenue-intelligence?windowDays=` — `canViewFinancialReports` **or** `canViewFinancials` (platform admins bypass via `requireAnyOrgPermission`). `GET /api/platform/blitzpay/revenue-rollup` — platform admin only. |
| **UX** | Settings → **Payments** — **BlitzPay revenue intelligence** panel (`BlitzpayRevenueIntelligencePanel`). Insights hub links to Payments anchor `#blitzpay-revenue-intelligence`. Admin → **BlitzPay Ops** shows platform revenue rollup strip. |
| **Portal** | No portal routes reference revenue intelligence APIs. |
| **Tests** | `pnpm test:blitzpay-phase-2q` — forecast + wallet math, recommendations smoke, API gates, portal scan, reportingSource wiring. |

#### Manual test checklist (Phase 2Q)

1. As owner or financial role, open **Settings → Payments** — revenue panel loads without 403; numbers move when you refresh.  
2. Forecast horizons increase 7 → 30 → 60 days; ACH pending line reflects unsettled bank transfers.  
3. Platform admin: **Admin → BlitzPay Ops** shows rollup card from `/api/platform/blitzpay/revenue-rollup`.  
4. Customer portal: confirm no new BlitzPay executive surfaces.

### 12.19 Phase 2R (contractor treasury, instant payout foundations, payout intelligence)

| Area | Details |
|------|---------|
| **Migrations** | `20260924120000_blitzpay_phase_2r_treasury_balances.sql` — `blitzpay_org_settings.blitzpay_reserve_target_cents`, `blitzpay_instant_payout_interest`; `blitzpay_org_balances` (derived available / pending / held reserve / operating / payout-in-transit / velocities / instant heuristic / speed lane); `blitzpay_balance_snapshots` (append-only, app-throttled ~1/day/org). RLS: authenticated **select**; writes via **service role** only. |
| **Pure libs** | `blitzpay-treasury-math.ts` — partition activity BTs by `available_on`, reserve + operating balance, payout delay average, upcoming-transfer estimate, speed lane classification, instant eligibility helper. `blitzpay-treasury-insights.ts` — deterministic read-only recommendations. |
| **Server** | `blitzpay-contractor-treasury.ts` — `aggregateBlitzpayTreasuryMetrics`, `persistBlitzpayOrgTreasury`, `refreshBlitzpayOrgTreasuryState`, `fetchBlitzpayTreasuryDashboard` (sanitized payout tails + truncated failure copy only). Payout webhook + manual payout sync refresh treasury **best-effort** (non-fatal on drift). |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` adds treasury fields (`treasuryAveragePayoutDelayDays`, pending payout totals, failed 30d count, instant flag, reserve exposure, velocity 7d/30d, estimate upcoming transfer, speed lane). `GET …/blitzpay/status` exposes them under `payoutVisibility`. |
| **Revenue intelligence** | `pendingPayoutsCents` is sourced from the same treasury aggregate as reporting for consistency; dashboard includes `treasuryEstimateUpcomingTransferCents`. |
| **Platform** | `fetchBlitzpayPlatformRevenueRollup` adds in-flight payout cents (bounded), failed payouts (30d), and org count with instant-payout interest flag. Admin **BlitzPay Ops** strip shows the new cards. |
| **APIs** | `GET …/blitzpay/treasury` — `canEditInvoices` **or** `canViewFinancials`; schema guard. `PATCH …/blitzpay/settings` accepts optional `blitzpay_reserve_target_cents` / `blitzpay_instant_payout_interest` (owner/admin BlitzPay gate). |
| **UX** | Settings → **Payments** — `BlitzpayTreasuryPanel` (balances, reserve vs target, payouts in transit, recent payouts, insights). No instant payout execution in-app. |
| **Portal** | No portal routes reference `/blitzpay/treasury`. |
| **Tests** | `pnpm test:blitzpay-phase-2r` — pure math, insights smoke, API gate strings, migration + schema markers, reporting/revenue wiring, portal scan. |

#### Manual test checklist (Phase 2R)

1. With Connect payouts mirrored, open **Settings → Payments** — treasury panel shows available vs pending and recent payouts without full Stripe payout ids.  
2. Run **Sync from Stripe** on payout ledger; treasury row updates (or refresh panel).  
3. Platform admin: **Admin → BlitzPay Ops** revenue rollup includes payout health tiles.  
4. Customer portal: confirm treasury API is not referenced.

### 12.20 Phase 2S (vendor payables, AP scheduling, treasury/AP intelligence)

| Area | Details |
|------|---------|
| **Migrations** | `20260925120000_blitzpay_phase_2s_vendor_payables.sql` — `blitzpay_vendor_payables` (vendor_kind, counterparty_label, due_date, scheduled_payout_date, paid_at, status lifecycle, approval fields, WO/invoice/PO links, reimbursement/material flags); `blitzpay_vendor_payouts` (internal row when payable marked **paid** — not Stripe `po_`). RLS: authenticated **select** via `is_org_member`; writes via **service role** APIs only. |
| **Pure libs** | `blitzpay-payable-lifecycle.ts` — status graph + `isOpenVendorPayableStatus`. `blitzpay-ap-math.ts` — obligation buckets (7/30/60, overdue, WO-linked), internal vendor payout velocity, projected outgoing (AP 7d + Stripe upcoming-transfer estimate), reserve stress ratio. `blitzpay-ap-insights.ts` — read-only operational strings. |
| **Server** | `blitzpay-vendor-payables.ts` — list/dashboard, `insertBlitzpayVendorPayable`, `patchBlitzpayVendorPayable` (valid transitions, approval stamp, insert internal payout on paid), `fetchWorkOrderVendorPayablesSlice`, `fetchApReportingExtras` for reporting. |
| **Reporting** | `fetchBlitzpayOrgReportingSnapshot` adds `apOpenOutstandingCents`, `apDue7/30/60OpenCents`, `apVendorInternalVelocity7dCents`, `apProjectedOutgoingCents7d`. `GET …/blitzpay/status` `payoutVisibility` mirrors those fields. |
| **Platform** | `fetchBlitzpayPlatformRevenueRollup` adds bounded scan: orgs with open payables, total open cents, overdue open line count. Admin **BlitzPay Ops** strip shows AP tiles. |
| **APIs** | `GET/POST …/blitzpay/vendor-payables`; `PATCH …/blitzpay/vendor-payables/{id}` — `canViewFinancials` **and** `canEditInvoices` for writes; `canViewFinancials` **or** `canEditInvoices` for reads. `GET …/blitzpay/ap-dashboard` — composite treasury + AP + insights. |
| **Work orders** | `fetchWorkOrderBlitzpaySummary` adds `vendorPayablesField` (aggregates) + `vendorPayablesStaff` (detail). WO BlitzPay API strips staff rows when `fieldView` (technician-safe). |
| **UX** | Settings → **Payments** — `BlitzpayApPanel` under treasury. Work order **BlitzPay** panel shows vendor obligations. |
| **Portal** | No customer portal routes reference vendor-payables or ap-dashboard. |
| **Tests** | `pnpm test:blitzpay-phase-2s` — aggregation + lifecycle + insights + API path strings + portal scan + migration marker. |

#### Manual test checklist (Phase 2S)

1. Financial user: **Settings → Payments** — AP panel loads; create a draft payable; advance status via API or future tooling.  
2. Link a payable to a work order; confirm WO BlitzPay panel shows totals; field-only role sees aggregates without vendor list.  
3. Platform admin: **BlitzPay Ops** rollup shows AP health tiles.  
4. Customer portal: confirm no AP API paths.

### 12.21 Phase 2T (financial command center, owner scorecards, platform rollup)

| Area | Details |
|------|---------|
| **Pure libs** | `blitzpay-command-center-math.ts` — AR/AP combined net cash positions (7/30/60) vs payout pressure + risk notes. `blitzpay-owner-scorecards.ts` — Healthy / Watch / Needs attention scorecards. `blitzpay-command-center-recommendations.ts` — deterministic automation strings layered on revenue context. |
| **Server** | `blitzpay-financial-command-center.ts` — `fetchBlitzpayOrgFinancialCommandCenter` composes revenue intelligence, reporting snapshot, treasury metrics, pending-approval AP counts, drilldown hrefs (no Stripe ids). `blitzpay-platform-command-center.ts` — bounded platform rollup (vendor AP org coverage, overdue AP orgs, Connect launch gaps, stale sync, disputes/refunds sample, schema health). |
| **APIs** | `GET …/blitzpay/financial-command-center?windowDays=` — `canViewFinancialReports` **or** `canViewFinancials`. `GET /api/platform/blitzpay/command-center-rollup` — platform admins only. |
| **UX** | `BlitzpayFinancialCommandCenterPanel` — **Settings → Payments** (`#blitzpay-financial-command-center-anchor`) and **Insights → BlitzPay command center** (`/insights/financial-command-center`). Sidebar **Financial** adds entry. **Admin → BlitzPay Ops** adds platform command-center strip. |
| **Portal** | No customer portal routes reference financial-command-center or command-center-rollup. |
| **Tests** | `pnpm test:blitzpay-phase-2t` — forecast + scorecards + recommendations + API wiring + portal scan + drilldown safety. |

#### Manual test checklist (Phase 2T)

1. As owner/financial role, open **Insights → BlitzPay command center** (or Settings → Payments anchor) — panel loads without 403.  
2. Scorecards show Healthy / Watch / Needs attention; combined AR/AP net row updates on refresh.  
3. Drilldown links navigate to in-app routes only (no `pi_` / `po_` tails in the panel).  
4. Platform admin: **BlitzPay Ops** shows the second rollup card for cross-org signals.  
5. Customer portal: confirm no command-center API paths.

### 12.22 Phase 2U (executive business health engine — deterministic, staff-only)

| Area | Details |
|------|---------|
| **Pure libs** | `blitzpay-executive-recommendations.ts` — threshold-based insight strings from numeric facts only. `blitzpay-business-health-types.ts` — shared payload types for server + client (no `server-only`). |
| **Server** | `blitzpay-customer-payment-behavior.ts` — bounded invoice scan + wallet/financing counts; aggregates only (no customer names in concentration strings). `blitzpay-workflow-cash-pipeline.ts` — bounded WO/quote samples for service-to-cash leakage notes. `blitzpay-business-health.ts` — `fetchBlitzpayBusinessHealth` composes revenue intelligence, reporting snapshot, pipeline + customer summaries, technician concentration helpers (capped). `blitzpay-platform-business-health.ts` — samples ≤10 Connect orgs for admin rollup averages. |
| **APIs** | `GET …/blitzpay/business-health?windowDays=` — same financial gate as command center + schema guard. `GET /api/platform/blitzpay/business-health-rollup` — platform admins only. |
| **UX** | `BlitzpayExecutiveDashboard` — **Settings → Payments** (`#blitzpay-executive-dashboard-anchor`) and **Insights → Financial command center**. **Admin → BlitzPay Ops** adds sampled health rollup card. |
| **Portal** | No portal routes reference `business-health` or `business-health-rollup`. |
| **Tests** | `pnpm test:blitzpay-phase-2u` — deterministic recommendations, API gate strings, bounded-limit markers, portal isolation, no `pi_`/`po_` in executive libs. |

#### Manual test checklist (Phase 2U)

1. Financial role: **Settings → Payments** — executive dashboard loads; scores stay within 0–100; refresh works.  
2. **Insights → Financial command center** — executive strip appears above the command center panel.  
3. Platform admin: **BlitzPay Ops** — business health rollup card renders when at least one sampled org returns health (empty sample hides card).  
4. Customer portal: confirm no business-health API paths.

### 12.23 Phase 2V (collections copilot + cash acceleration — deterministic, staff-only)

| Area | Details |
|------|---------|
| **Pure libs** | `blitzpay-collections-playbooks.ts` — rule-based recommended actions/channels/recovery windows. `blitzpay-collections-priority.ts` — `buildCollectionsPriorityQueue` urgency ordering. `blitzpay-collections-automation-insights.ts` — automation strings + `buildCustomerPaymentBehaviorProfile` from bounded aggregates. `blitzpay-collections-copilot-types.ts` — client-safe payload types. |
| **Server** | `blitzpay-collections-acceleration-metrics.ts` — bounded overdue + WO scheduled-window heuristics, technician leaderboard (paid-invoice sample), recovery multipliers. `blitzpay-collections-copilot.ts` — `fetchBlitzpayCollectionsCopilot` composes revenue intelligence, customer payment summary, acceleration metrics, bounded reminder/PI/plan enrichment for priority rows. `blitzpay-platform-collections-rollup.ts` — ≤10 Connect org sample for platform ops. |
| **Reporting / intelligence** | `fetchBlitzpayOrgReportingSnapshot` adds Phase 2V cents/rate fields (recoverable overdue, field-collectible, ACH/installment opportunity heuristics, technician-assisted recovery sample rate, reminder conversion %, field recovery %, WO collectible count). `fetchBlitzpayOrgRevenueIntelligence` exposes `paymentMethodMix` + wallet spendable + those fields on `dashboard`. `fetchBlitzpayBusinessHealth` surfaces the same facts on `BlitzpayBusinessHealthPayload.facts`. |
| **APIs** | `GET …/blitzpay/collections-copilot?windowDays=` — `canViewFinancialReports` **or** `canViewFinancials` + schema guard. `GET /api/platform/blitzpay/collections-rollup` — platform admins only. |
| **UX** | `BlitzpayCollectionsCopilotPanel` — **Settings → Payments** and **Insights → Financial command center** (`#blitzpay-collections-copilot-anchor`). **Admin → BlitzPay Ops** adds collections rollup strip. Executive dashboard lists acceleration lines under collections. |
| **Portal** | No customer portal routes or bootstrap references `collections-copilot` / `collections-rollup`. |
| **Tests** | `pnpm test:blitzpay-phase-2v` — deterministic priority/playbook, recovery multiplier bounds, API gate strings, bounded scan markers, portal isolation string check, no `pi_`/`po_` tails in Phase 2V libs. |

#### Manual test checklist (Phase 2V)

1. Financial role: **Settings → Payments** — collections copilot card loads; refresh works; drilldowns stay in-app.  
2. **Insights → Financial command center** — copilot appears between executive health and command center.  
3. Platform admin: **BlitzPay Ops** — collections rollup renders when sampled orgs exist.  
4. Customer portal: confirm no collections-copilot API paths.

### 12.24 Phase 2W (recurring revenue, membership renewals, service agreements — deterministic, staff-only)

| Area | Details |
|------|---------|
| **Pure libs** | `blitzpay-recurring-autopay-rules.ts` — deterministic retry schedule math + idempotency key namespace for renewal retries (documentation / future wiring; existing scheduled payment runner unchanged). `blitzpay-renewal-forecast.ts` — maintenance/contract window counters + projected inflow helper. `blitzpay-membership-health.ts` — churn-risk scoring + retention recommendation strings. `blitzpay-recurring-revenue-types.ts` — client-safe payload types. `blitzpay-recurring-collections-bridge.ts` — pure mapping into collections copilot signals (no `server-only`). |
| **Server** | `blitzpay-recurring-billing.ts` — `fetchBlitzpayRecurringRevenueMetrics` + `fetchBlitzpayRecurringRevenuePulse` + `buildRecurringCollectionsCopilotSlice` with **capped** reads across `maintenance_plans`, `org_service_contracts`, `blitzpay_scheduled_invoice_payments`, `blitzpay_customer_payment_profiles`, and active installment slices. `blitzpay-platform-recurring-revenue-rollup.ts` — **≤12** Connect org sample averages for BlitzPay Ops. |
| **Reporting / intelligence / health** | `fetchBlitzpayOrgReportingSnapshot` adds Phase 2W cents/% fields (planned recurring 30/90d, ARR proxy, mix %, autopay adoption, renewal success proxy, churn risk, stability score, projected renewal 90d, recovery opportunity heuristics). `fetchBlitzpayOrgRevenueIntelligence` mirrors them on `dashboard` and applies a **small churn-adjusted bump** to forecast horizons from recurring stability + planned 30d inflows. `fetchBlitzpayBusinessHealth` surfaces the same facts. `fetchBlitzpayTreasuryDashboard` adds optional `recurringCashSignals` (stability + planned 30d + confidence note). `fetchBlitzpayCollectionsCopilot` adds `recurringCollectionsSignals`. |
| **APIs** | `GET …/blitzpay/recurring-revenue?windowDays=` — `canViewFinancialReports` **or** `canViewFinancials` + schema guard. `GET /api/platform/blitzpay/recurring-revenue-rollup` — platform admins only. |
| **UX** | `BlitzpayRecurringRevenuePanel` — **Settings → Payments** and **Insights → Financial command center** (`#blitzpay-recurring-revenue-anchor`). Command center tiles + revenue intelligence metrics + executive dashboard facts + treasury panel strip. **Admin → BlitzPay Ops** recurring rollup card. Collections copilot links to recurring anchor. |
| **Portal** | No customer portal routes or bootstrap references `recurring-revenue` / `recurring-revenue-rollup`. |
| **Tests** | `pnpm test:blitzpay-phase-2w` — retry schedule determinism, idempotency key shape, churn/membership math, renewal forecast helper, copilot slice, API gate strings, bounded caps, portal isolation, no `pi_`/`sub_` in Phase 2W libs. |

#### Manual test checklist (Phase 2W)

1. Financial role: **Settings → Payments** — recurring revenue panel loads; refresh works; drilldowns stay in-app.  
2. **Insights → Financial command center** — panel appears above collections copilot.  
3. Platform admin: **BlitzPay Ops** — recurring rollup renders when sampled orgs exist.  
4. Customer portal: confirm no recurring-revenue API paths.

### 12.25 Phase 2X (native memberships, service agreements ops, recurring invoice engine — deterministic)

| Area | Details |
|------|---------|
| **Schema** | `blitzpay_memberships`, `blitzpay_membership_invoices` (link to `org_invoices`), `blitzpay_membership_payment_failures`, `blitzpay_membership_events`, `blitzpay_membership_retention_snapshots` — RLS aligned with other BlitzPay tables (`is_org_member` + authenticated read). `work_order_template_id` is optional UUID without FK until a canonical templates table exists. |
| **Pure / server libs** | `blitzpay-memberships.ts` — bounded list/retention reads, billing period math, dashboard + reporting slice, event logging, health/churn wiring to `blitzpay-membership-health.ts`. `blitzpay-recurring-billing-engine.ts` — due-invoice generation with **idempotency** (`blitzpayMembershipInvoiceGenerationKeyV1`), duplicate prevention via membership-invoice link + key, capped due scans, failure retry + delinquency transitions, retention snapshot upsert. `blitzpay-platform-membership-rollup.ts` — capped org sample for ops. |
| **Cron** | `POST /api/cron/blitzpay-memberships` — Bearer `CRON_SECRET`; runs engine tick (invoices, retries, delinquency, snapshots); schema drift guard. |
| **Org APIs** | `GET/POST …/blitzpay/memberships`, `GET/PATCH …/memberships/[id]`, pause/resume/cancel/retry-payment, `GET …/membership-insights`, `GET …/retention-report`. Reads: financial reports **or** financials. Mutations: **invoice edit + financials** + schema guard. |
| **Portal** | `GET /api/portal/memberships` + `GET …/[membershipId]` — renewal dates, included services summary from plan linkage when present, payment history via org invoices only; **no** internal analytics, **no** raw Stripe identifiers. |
| **Reporting / command center** | Snapshot adds Phase 2X cents/bps (MRR, ARR, delinquent membership revenue, renewal pipeline, recovered membership revenue, autopay adoption bps, churn-risk revenue proxy). Financial command center tiles + drilldown to `/memberships`. |
| **Platform** | `GET /api/platform/blitzpay/membership-rollup` — bounded org sample; BlitzPay Ops card. |
| **UX** | Financial nav **Memberships** → dashboard; customer profile + work order + invoice drawers show membership context; invoice drawer calls `membership-insights?orgInvoiceId=` for “generated from membership” banner. |
| **Tests** | `pnpm test:blitzpay-phase-2x` — migration presence, idempotency key, caps, billing math, route guards, portal isolation, schema-health table names. |

#### Manual test checklist (Phase 2X)

1. Financial role: **Financial → Memberships** — dashboard loads; metrics bounded.  
2. Create/patch membership via org API or future form — next invoice scheduling advances after cron (staging).  
3. Invoice linked to membership shows banner in invoice drawer.  
4. Portal session: **memberships** list/detail — no Stripe IDs, no staff-only insight fields.  
5. Cron: invoke with valid secret — no duplicate invoices for same period (idempotency).

### 12.26 Phase 2Y (payroll-style accruals, technician commissions, contractor settlements, revenue share — deterministic)

| Area | Details |
|------|---------|
| **Schema** | `blitzpay_payroll_runs`, `blitzpay_technician_compensation_profiles`, `blitzpay_work_order_commissions`, **`blitzpay_contractor_settlements`** (WO/invoice-linked subcontractor/partner settlements), `blitzpay_revenue_share_rules`, `blitzpay_revenue_share_ledger`. **Does not** recreate `blitzpay_vendor_payouts` (Phase 2S internal AP “paid” marker table). RLS: org-scoped `SELECT` for authenticated members; writes via service-role org APIs only. |
| **Pure engine** | `blitzpay-payroll-engine.ts` — commission math, hybrid hourly+commission helper, revenue basis with optional overlap input, period summaries, technician payout breakdown, approval queue ordering (no DB). |
| **Server libs** | `blitzpay-payroll-accrual.ts` — idempotent `syncBlitzpayPayrollAccrualForOrgInvoice` after collections change (bounded WO/invoice/membership link reads). `blitzpay-payroll-runs.ts` — draft/approve/finalize orchestration (**accounting only; no ACH payroll**). `blitzpay-platform-payroll-rollup.ts` — bounded org sample for Admin ops. |
| **Org APIs** | `GET …/blitzpay/payroll`, `GET/POST …/blitzpay/payroll-runs`, `POST …/payroll-runs/[runId]/approve`, `POST …/payroll-runs/[runId]/finalize`, `GET …/blitzpay/commissions` (`technicianUserId`, `workOrderId`, `status`, `limit`), `GET …/blitzpay/vendor-payouts` (returns **contractor settlements** payload key `vendorSettlements` for route-name compatibility). Reads: `canViewFinancialReports` **or** `canViewFinancials` + schema guard. Mutations: `canManageSettings` **and** `canViewFinancials`. |
| **Platform** | `GET /api/platform/blitzpay/payroll-rollup` — platform admin email gate; bounded org sample. |
| **Reporting / CC / treasury / revenue** | `fetchBlitzpayOrgReportingSnapshot` adds Phase 2Y cents; financial command center tiles + drilldown anchor `#blitzpay-payroll-anchor`; revenue intelligence dashboard mirrors snapshot fields; treasury dashboard adds `payrollTreasurySignals`; business health facts include payroll KPIs. |
| **UX** | Settings → Payments + Insights → Financial command center — payroll dashboard, commission queue, vendor settlements panel; work-order BlitzPay strip; technician drawer performance tab (financial roles). **Portal:** no payroll internals. |
| **Tests** | `pnpm test:blitzpay-phase-2y` — migration + table split note, engine math, idempotency keys, bounded caps, no Stripe substrings in new client components, permission gates, platform rollup auth, `server-only` isolation for accrual vs pure engine. |

### 12.27 Phase 2Z (internal cash buckets, reserve rules, runway snapshots — planning only)

| Area | Details |
|------|---------|
| **Schema** | `blitzpay_cash_accounts`, `blitzpay_cash_account_allocations`, `blitzpay_cash_reserve_rules`, `blitzpay_cash_runway_snapshots` — org-scoped `SELECT` for authenticated members; **writes via service-role org APIs** only. **No stored-money custody**; rows are internal planning mirrors layered on Connect treasury + AP + payroll signals. |
| **Pure + server libs** | `blitzpay-cash-accounts.ts` — `estimateOperatingBalance`, `calculateReserveTargets`, `allocateCollectionsToCashAccounts`, `releaseCashAccountAllocation`, `buildCashAccountSummary`, `buildCashAccountHealth`, `buildCashRunwaySnapshot`, `deriveBlitzpayCashPlanningMetrics` (no I/O). `blitzpay-cash-accounts-service.ts` — bounded loads + `fetchBlitzpayOrgCashPlanningPayload`, reserve rule CRUD helpers, runway snapshot upsert. `blitzpay-platform-cash-accounts-rollup.ts` — capped org sample for Admin ops. |
| **Org APIs** | `GET …/blitzpay/cash-accounts` (includes recent allocation sample), `GET …/blitzpay/cash-runway` (best-effort daily snapshot upsert), `GET/POST …/blitzpay/cash-reserve-rules`, `PATCH …/blitzpay/cash-reserve-rules/[ruleId]`. Reads: `canViewFinancialReports` **or** `canViewFinancials`. Mutations: `canManageSettings` **and** `canViewFinancials`. |
| **Treasury API** | `GET …/blitzpay/treasury` returns `{ treasury, cashPlanning? }` — `cashPlanning` is optional when schema lags. |
| **Platform** | `GET /api/platform/blitzpay/cash-accounts-rollup` — platform admin email gate; bounded org sample (`PLATFORM_CASH_ORG_SAMPLE_CAP`). |
| **Reporting / dashboards** | `fetchBlitzpayOrgReportingSnapshot` adds `openDisputesAmountCents` (bounded) + Phase 2Z runway/reserve/inflow/outflow/bps fields. Financial command center, executive dashboard, revenue intelligence, business health, treasury panel, BlitzPay Ops strip consume the same signals. |
| **UX** | Contractor-friendly copy (“Available operating cash”, “Money to reserve”, “Upcoming obligations”) — **no** “bank account” / “insured balance” claims. **Portal:** no cash-planning APIs. |
| **Tests** | `pnpm test:blitzpay-phase-2z` — migration tables, pure math, double-count guard, runway status, route permission strings, portal exclusion grep, no Stripe id patterns in new panel, schema-health table names, bounded caps. |

---

*Phase 2A–2T vertical slice for hosted invoice pay + estimate deposits + native customer wallet/credits + financing/installment foundations + collections automation + work-order-native collection + **revenue intelligence / forecasting** + **contractor treasury / payout intelligence** + **owner financial command center** (staff + portal + confirmation/history + operational refunds/disputes + receipt comms + platform-managed fee policy + payout ledger + multi-method foundations + recovery/reminders/payment links + consent-based autopay/schedule/partial pay + platform ops / rollout / launch readiness) is implemented; sections §1–§11 remain the design reference for later sub-phases.*
