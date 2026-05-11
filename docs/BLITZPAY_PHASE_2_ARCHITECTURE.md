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
| **Webhook (2A baseline)** | `POST /api/blitzpay/webhook` — Phase 1 `account.updated` unchanged. Phase 2 inbox + **mirror** `blitzpay_payment_intents` for `payment_intent.*`; stubs for charge refund/dispute. **Phase 2B** extends dispatch for succeeded/failed/canceled PI and Checkout completion (see §12.2). |
| **Env** | `BLITZPAY_INVOICE_PAY_ENABLED` — global gate (default off); see `.env.local.example`. Per-org `blitzpay_org_settings.blitzpay_invoice_pay_enabled` for rollout. |

### 12.2 Phase 2B (shipped in repo)

| Area | Details |
|------|---------|
| **API** | `POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay` — authenticated, org-scoped; gates: env `BLITZPAY_INVOICE_PAY_ENABLED`, `blitzpay_org_settings.blitzpay_invoice_pay_enabled`, Connect `charges_enabled` + account id; invoice must belong to org, not void/archived, balance due greater than zero; lightweight rate limits (`lib/blitzpay/blitzpay-rate-limit.ts`, optional `BLITZPAY_RATE_PREPARE_*` env). |
| **Stripe** | **Checkout Session** `mode: payment` on **connected account** (`Stripe-Account`), `payment_intent_data.application_fee_amount`, metadata from `stripe-metadata.ts`, idempotency from `idempotency-keys.ts`, amounts/fees via `money.ts` / `fees.ts`. No client secret or card data in the app UI beyond redirect to Stripe-hosted Checkout. |
| **Persistence** | Before/around Stripe: insert `blitzpay_payment_intents` (stable id), `blitzpay_fee_snapshots`, `blitzpay_invoice_payment_attempts` (`checkout` / `initiated`); retries use new `attemptToken` / idempotency key to avoid duplicate Checkout sessions for the same logical retry policy. |
| **Webhook** | `payment_intent.succeeded` / `payment_intent.payment_failed` / `payment_intent.canceled` + `checkout.session.completed` (paid): mirror PI, then idempotent `org_invoice_payments` via `reference = blitzpay_pi:{payment_intent_id}` and `lib/billing/invoice-payment-allocation.ts` path; ledger `payment_captured` + optional `application_fee_received`; attempt row terminal status; inbox `done` / `dead` per existing inbox rules. |
| **UI** | Minimal: invoice Payments tab — “Pay with BlitzPay (hosted)” when permitted (`components/drawers/invoice-detail-view.tsx`). |
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

**Deferred (not Phase 2C):** portal payment history list, refunds/disputes beyond webhook stubs, payout UI.

---

*Phase 2A–2C vertical slice for hosted invoice pay (staff + portal) is implemented; sections §1–§11 remain the design reference for later sub-phases.*
