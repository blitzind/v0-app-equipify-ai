# Equipify — Scale, Performance, and Mass-Scale Readiness Audit

**Scope:** Read-only review of database design, API/query patterns, frontend data loading, caching, RLS, Stripe/BlitzPay, AI metering, jobs, observability, rate limits, and deployment/runtime. No code or schema changes were made for this document.

**Stack context:** Next.js App Router (16.x per build output), Supabase (PostgreSQL + RLS + Auth), Vercel-style serverless, Stripe SaaS billing + BlitzPay Phase 1 (Connect onboarding only), multi-tenant SaaS for field service businesses. **Update (BlitzPay Phase 3A):** internal **general ledger** tables and capped staff reads add bounded accounting workload; keep GL APIs off hot navigation paths at very large scale. **Update (BlitzPay Phase 3B):** vendor bill / pay-run / allocation tables are **staff-only** (finance roles), **capped** list queries per org, and **not** on portal or public caches — treat like other BlitzPay internal finance surfaces. **Update (BlitzPay Phase 3C):** tax jurisdictions/rules/calculations, compliance audit, ACH authorization metadata, vendor tax profiles, and liability snapshots are **finance-role reads** with **explicit list caps** in services; **no portal routes** — same “internal books” traffic profile as Phase **3A–3B** (avoid high-frequency polling). **Update (BlitzPay Phase 3D):** financing marketplace tables (`blitzpay_marketplace_financing_providers`, applications, application offers, contractor advance models, financing audit, provider matches) are **staff-first** with **capped** reads; **portal** exposure is limited to **narrow** `/api/portal/financing/*` summaries scoped to the signed-in customer — avoid expanding payloads with internal match scores or treasury diagnostics. **Update (BlitzPay Phase 4A):** AI financial copilot tables (`blitzpay_ai_financial_insights`, `blitzpay_ai_recommendation_actions`, `blitzpay_ai_forecast_snapshots`, `blitzpay_ai_audit_log`) are **staff finance roles only**, **bounded** list reads, **no portal** exposure, and **regeneration** should not be wired to high-frequency polling — treat like other internal BlitzPay planning surfaces (see `docs/BLITZPAY_PHASE_4_ARCHITECTURE.md`). **Update (BlitzPay Phase 4B):** revenue optimization tables add **bounded** staff reads + append-only optimization audit — same traffic profile as Phase **4A** (avoid tight client polling loops). **Update (BlitzPay Phase 5A):** multi-entity finance tables (`blitzpay_financial_groups`, `blitzpay_financial_group_members`, `blitzpay_intercompany_balances`, `blitzpay_consolidated_snapshots`, `blitzpay_multi_entity_audit_log`, `blitzpay_shared_operational_benchmarks`) are **staff finance roles only**, **explicit linkage** for cross-org reporting, **capped** org snapshot aggregation in services, **no portal** exposure — treat as low-volume configuration + reporting surfaces (see `docs/BLITZPAY_PHASE_5_ARCHITECTURE.md`). **Update (BlitzPay Phase 5C):** warranty reserves, claims, protection plans, storm financials, payout tracking, and claims audit tables are **staff finance roles only** with **bounded** list APIs, **no portal** claim administration, `skipClaimsWarranty` on nested reporting fetches, and **opaque** payout reference hashes — internal orchestration visibility only (see `docs/BLITZPAY_PHASE_5_ARCHITECTURE.md`). **Update (BlitzPay Phase 6A):** mobile financial intents, signature authorization hashes, payroll approval queue rows, treasury snapshot bands, sync batches, and append-only mobile audit add **bounded** staff APIs under `/blitzpay/mobile/*` plus reporting snapshot enrichers — **capture/orchestration only** (no offline money movement); keep off hot polling loops like other BlitzPay staff finance modules (see `docs/BLITZPAY_PHASE_6_ARCHITECTURE.md`).

---

## 1. Executive Summary

Equipify has a **strong multi-tenant database foundation**: composite tenant keys `(organization_id, …)`, many **org-scoped indexes** on high-traffic entities (`work_orders`, `customers`, `equipment`, `maintenance_plans`, `org_invoices`, `org_quotes`, communications, inventory, AI ops), and **centralized RLS helpers** (`public.is_org_member`, `public.has_org_role`) marked **STABLE** and **SECURITY DEFINER** — appropriate for repeated policy evaluation.

The **largest scale risks are application-layer**: several **dashboard list pages load entire organization datasets** into the browser (e.g. work orders query with **no `.limit()`**), **client-side filtering/sorting** on large arrays, and **API routes that allow very large row caps** (inventory stock up to **6000** rows in one response). **Global search** (`lib/global-search/run-global-search.ts` + `GET /api/organizations/[organizationId]/global-search`) runs **multiple sequential/section queries** per keystroke; each section is capped (**MAX_PER_SECTION = 5**) which is good, but **equipment** uses broad `OR` + `ilike` patterns that can stress the planner at scale without trigram or FTS.

**Stripe SaaS** webhooks use **DB idempotency** (`public.stripe_webhook_events`) and structured logging (`app/api/stripe/webhook/route.ts`). **BlitzPay Phase 1** mirrors that pattern (`public.blitzpay_stripe_webhook_events`, `app/api/blitzpay/webhook/route.ts`) and uses **Stripe idempotency keys** for Express account creation (per org) in `lib/blitzpay/connect-stripe.ts` — a solid base for Phase 2. **BlitzPay Phase 2O** adds financing-session and installment-plan tables (`blitzpay_financing_*`, `blitzpay_payment_plans`) with org-scoped RLS and **service-role writes** from API routes; volume is expected to stay low versus invoices, but plan/installment queries should stay **indexed on `(organization_id, …)`** as orgs adopt staged billing. **BlitzPay Phase 2U** adds `fetchBlitzpayBusinessHealth` (deterministic, no OpenAI) with **explicit row caps** on invoice/work-order attribution scans and a **platform rollup that samples at most 10** Connect-enabled orgs per request — executive dashboards remain staff-only (no portal routes); operators should treat platform rollup as **approximate** under load and keep cron/admin usage infrequent. **BlitzPay Phase 2V** adds `fetchBlitzpayCollectionsCopilot` plus **reporting-snapshot acceleration fields** with **capped overdue/invoice/WO reads** and a **platform collections rollup** that again samples **≤10** Connect orgs — copilot is staff-only; avoid polling it on hot navigation paths. **BlitzPay Phase 2W** adds deterministic **recurring revenue / renewal** reads (`fetchBlitzpayRecurringRevenueMetrics`, maintenance + service-agreement + scheduled-payment caps) and a **platform recurring rollup** sampling **≤12** Connect orgs — keep these endpoints off high-frequency dashboards if orgs grow very large. **BlitzPay Phase 2X** adds membership tables plus **capped** list/due-scan/org-sample constants in `blitzpay-memberships.ts` / recurring billing engine / platform membership rollup; cron should run on a modest schedule — treat reporting snapshot membership fields as **best-effort** under load (same pattern as other BlitzPay snapshot enrichers).

**Rate limiting** is **partial**: AI-adjacent routes use `lib/ai/operation-rate-limit` / `ai_operation_rate_buckets` (e.g. follow-up evaluate/regenerate, insights generate). There is **no general per-IP or per-org API rate limit** on most authenticated or portal routes (documented as future work in `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`).

**Observability** is uneven: Stripe webhooks emit **JSON `console.info`/`console.error`** with safe fields; many other routes rely on **generic** error responses without a unified correlation id or slow-query telemetry.

**Verdict:** The product can grow to **moderate tenant scale** (hundreds of orgs, thousands of rows per org) with acceptable performance if list views and heavy reports are paginated and indexed thoughtfully. **Mass scale** (very large tenants, high portal traffic, heavy analytics) will require **pagination/virtualization**, **background job queues**, **caching with strict tenant boundaries**, and **operational monitoring** not yet centralized.

---

## 2. Current Scale Readiness Score (1–10)

**6 / 10**

| Strength (+) | Gap (−) |
|----------------|---------|
| RLS + org-scoped schema | Full-table client loads on key pages |
| Many migrations add composite indexes | Some APIs allow multi-thousand row reads |
| Webhook idempotency (SaaS + BlitzPay) | Limited cross-cutting rate limits |
| `nodejs` runtime on sensitive routes | No unified APM / slow-query dashboard |
| AI rate buckets for some paths | Reporting/analytics can aggregate large windows |

---

## 3. Biggest Bottlenecks

1. **`app/(dashboard)/work-orders/page.tsx`** — Loads **all** work orders for the org (Supabase `.from("work_orders").select(...).eq("organization_id", …).order("created_at")` with **no `.limit()`**), then batches related `customers`, `equipment`, `profiles`, `technicians` queries. **Client-side** search/sort/filter. **Primary scale bottleneck** for large orgs.
2. **`app/(dashboard)/customers/page.tsx`** + **`lib/customer-store.tsx`** / **`useWorkspaceData`** — Customer list patterns tied to **in-memory** stores and **browser** Supabase; risk of **full-org hydration** or large bundles depending on code path (see workspace demo bundles in `lib/workspace-data.ts`).
3. **`lib/reporting/compute-analytics.ts`** + **`GET /api/organizations/[organizationId]/reports/analytics`** — Computes **many KPI slices** in one request over date ranges; multiple queries and in-process aggregation — **CPU + DB time** grow with data volume and range width.
4. **Inventory APIs** — `app/api/organizations/[organizationId]/inventory/stock/route.ts` (limits up to **6000** / **2000**), `inventory/reorder-center/route.ts` (**2500**), `catalog-items/[itemId]/usage/route.ts` (multiple **800** caps). High **payload size** and **memory** per request.
5. **RLS + `is_org_member` on every row** — Correct for security; at very large table sizes, **policy evaluation cost** per query grows unless queries are **index-friendly** and selective (see §7).

---

## 4. Database Risks

### 4.1 Tenant isolation and FK patterns

- Core pattern: **`organization_id` + entity `id`** with composite uniqueness (e.g. `customers(organization_id, id)` per `20260501133000_customer_foundation.sql`).
- **Work orders**, **equipment**, **maintenance_plans** use composite FKs to customers — good for integrity; joins always filter by `organization_id` when indexed.

### 4.2 Indexes present (high level)

Evidence from migrations under `supabase/migrations/`:

| Area | Representative indexes / migrations |
|------|--------------------------------------|
| **customers** | `idx_customers_org`, `idx_customers_org_company` (`20260501133000`), hierarchy `idx_customers_parent` / portal `idx_customers_org_parent_active`, sample `idx_customers_org_sample` |
| **equipment** | Org+customer+location (`20260812298000`), intelligence (`20260720120000`), sample flags |
| **work_orders** | Org+archived+status, scheduled, customer, equipment, assigned, created, maintenance_plan (`20260501152000`, `20260719120000`) |
| **invoices / quotes** | `idx_org_invoices_org_issued`, archived-at variants, billing customer, calibration link; quotes `idx_org_quotes_org_created`, archived |
| **maintenance_plans** | Multiple org composite indexes (`20260501170000`) |
| **scheduling** | `idx_wo_scheduling_events_org_created` (`20260507120000_work_order_scheduling_events.sql`) |
| **communications / notifications** | `idx_communication_events_org_*`, internal notification log (`20260910121500`) |
| **audit** | `idx_organization_audit_events_org_created` (`20260607110000`) |
| **AI usage** | `idx_ai_usage_logs_org_created`, `idx_ai_usage_logs_task` (`20260617100000`), `idx_aiden_usage_events_org_created` / feature-month (`20260812291000`) |
| **Stripe** | `stripe_webhook_events` table (`20260518270000`); BlitzPay `blitzpay_stripe_webhook_events` + partial unique on `organizations.stripe_connect_account_id` (`20260813100000`); **Phase 2E** adds `blitzpay_invoice_refunds` + `blitzpay_invoice_disputes` (`20260913120000`) for idempotent refund/dispute bookkeeping |

### 4.3 Missing or weak index risks (analytical, not applied in this audit)

- **Text search (`ilike '%pattern%'`)** on `equipment` / `work_orders` / invoices / quotes (see `lib/global-search/run-global-search.ts`) — **cannot use standard B-tree** indexes effectively; at scale consider **`pg_trgm`** or **FTS** + dedicated migration (listed in §13 only).
- **Ad-hoc analytics filters** in `compute-analytics.ts` — verify each hot subquery uses an existing **org + time/status** index; any new filter dimension may need a **partial** or **composite** index.

### 4.4 Partitioning candidates (later)

- **`ai_usage_logs`**, **`communication_events`**, **`organization_audit_events`**, **`portal_activity_logs`**, **`stripe_webhook_events` / `blitzpay_stripe_webhook_events`**, **`inventory_transactions`** — append-mostly, time-series shaped tables that can dominate storage and vacuum cost at very large scale. **Range partitioning by month** on `created_at` (or org hash + time) is a future option; not required for early growth.

### 4.5 Soft delete / status filters

- Common pattern: **`archived_at is null`** with org indexes (e.g. `idx_*_org_archived_at`). Good alignment when migrations added **`…_archived_at`** indexes (`20260609140000_archive_timestamp_only.sql`).

---

## 5. API / Query Risks

| Risk | Example location | Notes |
|------|------------------|-------|
| **Very large limits** | `inventory/stock/route.ts` (`.limit(6000)`, `2000`), `inventory/reorder-center/route.ts` (`2500`), `catalog-items/[itemId]/usage/route.ts` (multiple `800`) | Single response can be **MBs** of JSON |
| **Moderate list caps** | `service-requests/route.ts` (`200`), `follow-up-tasks/route.ts` (`250`), `communications/route.ts` (`500`) | Better than unbounded; still worth **cursor pagination** |
| **Platform admin listing** | `app/api/platform/ai-operations/route.ts` (uses `.range` with `PAGE_SIZE`) | Pagination pattern exists — reuse as template |
| **Global search** | `app/api/organizations/[organizationId]/global-search/route.ts` → `runOrgGlobalSearch` | Multiple queries; **no debounce** enforced server-side (client should debounce); **assigned scope** can pass large `.in("id", …)` arrays for technicians |
| **N+1** | Work orders page: 1 WO query + batched IN queries for customers/equipment/users | Batching helps; **unbounded first query** does not |
| **Webhook heavy work** | `app/api/stripe/webhook/route.ts` | Inserts id then `dispatchStripeWebhookEvent`; on failure **deletes** idempotency row to allow retry — good for correctness; ensure handler stays **fast** or move to async queue for Phase 2-scale payment fan-out |

**Caching:** Grep showed **little** use of `unstable_cache` / `revalidate` in `app/` — most data paths are **dynamic** (appropriate for tenant-private data) but also means **no shared read-through cache** for safe read-mostly aggregates (e.g. public branding).

---

## 6. Frontend Performance Risks

| Risk | Location | Detail |
|------|----------|--------|
| **Large client pages** | `app/(dashboard)/work-orders/page.tsx` (~1500+ lines), `customers/page.tsx` | `"use client"` + hooks + full lists — **bundle size** and **hydration** cost |
| **Browser Supabase** | Same files — `createBrowserSupabaseClient()` | Bypasses server caching; every user device hits PostgREST directly for large selects |
| **In-memory filter/sort** | Work orders / customers pages (`useMemo`, search) | O(n) per interaction on full dataset |
| **No virtualization cited** | Table components from `@/components/ui/table` | Large lists render **all DOM rows** |
| **Dashboard mock vs live** | `lib/workspace-data.ts`, `lib/tenant-store.tsx` | Demo bundles import **large mock datasets** (medology, precision) — can affect **dev** and any path that still hydrates mock bundles |
| **Charts / reports** | `app/(dashboard)/reports/page.tsx`, insights | Likely client-heavy; combined with `compute-analytics` = **double cost** (server compute + client render) |

**Mobile:** Wide tables and dense filters without virtualization increase **scroll/layout** cost on small screens.

---

## 7. Supabase / RLS Risks

### 7.1 Policy pattern

- Typical pattern: `using (public.is_org_member(organization_id))` or `has_org_role(organization_id, array[...])`.
- Functions are **STABLE** + **SECURITY DEFINER** + `search_path` pinned — **good** for planner caching of function results within a statement.

### 7.2 Performance considerations

- Each row under RLS still evaluates policies — **narrow selects** (specific columns) and **strong filters** (`organization_id` + indexed predicates) are critical.
- **Technician assigned-scope** policies (`20260812280000_technician_assigned_scope_rls.sql`) add complexity; ensure list queries use **indexed columns** that match policy predicates (e.g. `assigned_user_id`, `customer_id`).

### 7.3 Service role

- **`createServiceRoleSupabaseClient`**** (`lib/billing/service-role-client.ts`)** is used from **trusted server routes** only (webhooks, platform/cron paths, some org writes after authz — e.g. `lib/blitzpay/org-write-client.ts`, QuickBooks, demo reset, workspace updates per grep).
- **Risk class:** any route that uses service role **without** a prior **authorization gate** — review each call site before scaling team size (internal abuse / bug → cross-tenant write).

---

## 8. Stripe / BlitzPay Scale Risks

**Phase 2Y (payroll accruals):** org APIs and `syncBlitzpayPayrollAccrualForOrgInvoice` use **capped selects** (`PAYROLL_COMMISSION_SCAN_CAP`, `PAYROLL_SETTLEMENT_SCAN_CAP`, membership/rule caps). Platform payroll rollup samples at most **`PLATFORM_PAYROLL_ORG_SAMPLE_CAP`** organizations per request — webhook accrual sync remains best-effort and must stay non-blocking.

**Phase 2Z (cash planning):** `blitzpay-cash-accounts-service.ts` caps cash account rows (**`CASH_ACCOUNTS_ROW_CAP`**), reserve rules (**`CASH_RESERVE_RULES_CAP`**), allocation history (**`CASH_ALLOCATIONS_SCAN_CAP`**), and open-dispute scan (80 rows) inside reporting snapshot. Platform cash rollup samples at most **`PLATFORM_CASH_ORG_SAMPLE_CAP`** orgs per request — planning payloads must stay read-only for members except explicit reserve-rule mutations.

**Phase 2AA (billing profiles + payment method metadata + autopay enrollments):** `blitzpay-billing-profiles-service.ts` uses explicit caps (**`BLITZPAY_BILLING_PROFILE_LIST_CAP`**, **`BLITZPAY_PAYMENT_METHOD_LIST_CAP`**, **`BLITZPAY_AUTOPAY_LIST_CAP`**, **`BLITZPAY_PHASE_2AA_REPORTING_PROFILE_CAP`**) on all list/reporting paths; only **hashed** Stripe references and **masked** display fields are persisted. Portal billing routes must remain narrow (no staff treasury/reporting payloads). Sync is **metadata-only** — watch Stripe list API volume only if orgs trigger sync very frequently; prefer debounced staff actions until a webhook-driven incremental sync exists.

**Phase 2AB (collections engine):** `blitzpay-collections-service.ts` caps state/attempt/flow/activity/reporting scans (`BLITZPAY_COLLECTION_*_CAP`, `BLITZPAY_PHASE_2AB_REPORTING_SCAN_CAP`). Staff “retry” schedules **metadata-only** follow-up windows (no email worker in this phase). Portal billing routes are narrow summaries only.

### 8.1 SaaS Stripe (`/api/stripe/webhook`)

- **Idempotency:** insert into `stripe_webhook_events` by `event.id`; duplicate → `200` + `duplicate: true`.
- **Failure handling:** on handler error, **row deleted** so Stripe retry can re-process — correct for at-least-once delivery; ensure handlers remain **idempotent** internally.

### 8.2 BlitzPay Phase 1 (`docs/BLITZPAY_PHASE_1.md`, `app/api/blitzpay/webhook/route.ts`)

- Separate signing secret; **`account.updated`** only; idempotency table **`blitzpay_stripe_webhook_events`**.
- **Express account creation** uses **Stripe idempotency key** per organization (`lib/blitzpay/connect-stripe.ts`) — mitigates duplicate accounts on retries.

### 8.3 Before BlitzPay Phase 2 (invoice payments, Connect charges)

| Risk | Mitigation direction |
|------|---------------------|
| **PaymentIntent / Checkout idempotency** | Keys keyed by `organization_id` + `invoice_id` + intent purpose |
| **Webhook volume** | Separate events table or partition; consider **async worker** off Vercel for fan-out |
| **Application fees / transfers** | Ledger tables + unique constraints on “applied fee for invoice X” |
| **Payouts / disputes** | New tables indexed by `stripe_connect_account_id` + `event_id` |
| **Invoice sync** | Outbox pattern: write local state then enqueue Stripe action; reconcile cron |

### 8.4 BlitzPay Phase 2E (operational refunds / disputes)

- **Refund idempotency:** unique `stripe_refund_id` on `blitzpay_invoice_refunds` plus ledger `(organization_id, entry_type, stripe_object_id)` dedupe replays; ingress still dedupes by `blitzpay_stripe_webhook_events.id`.
- **Volume:** refund/dispute rows are **low cardinality** per invoice; `blitzpay_webhook_inbox` remains the first place to watch if Stripe retry storms grow — same async-worker note as §8.3.

### 8.5 BlitzPay Phase 2G (merchant controls + fee disclosure + payout visibility)

- Fee policy fields live in `blitzpay_org_settings`, but tenant/workspace editing should remain disabled for convenience-fee values (platform-managed pass-through policy).
- Staff/portal prepare-pay preview endpoints provide pricing disclosure before redirect, reducing charge-surprise support incidents.
- Reporting adds estimated Stripe fee / net payout fields; still estimate-based and not a full payout-ledger sync.

### 8.6 BlitzPay Phase 2I (multi-method + ACH + stored payment profiles)

- Checkout now supports org-configurable payment method capability (`card`, `us_bank_account`) while keeping Stripe-hosted collection.
- ACH timeline and convenience-fee behavior are configurable at org level; fee math must remain method-aware to avoid customer-facing mismatches.
- Stored payment profile records should remain reference-only (`stripe_customer_id`, method type flags) with no local PAN/bank account details.

### 8.7 BlitzPay Phase 2J (collections automation + recovery visibility)

- Collections automation tables (`blitzpay_payment_reminders`, `blitzpay_reminder_runs`, `blitzpay_recovery_cases`, `blitzpay_payment_links`, `blitzpay_collections_timeline`) add operational history for reminders and recovery decisions.
- Reminder dispatch uses deterministic idempotency keys (`organization_id + idempotency_key`) to remain replay-safe during cron retries and deploy restarts.
- Reminder suppression should remain strict for paid/void invoices, archived customers, and non-email preferences to avoid noisy/unsafe outreach.
- Hosted payment links use hashed opaque tokens and route into portal-safe pay pages; no raw banking or Stripe method secrets are exposed.
- New scaling watchpoint: reminder cron fan-out across large org counts. Add per-org batching/leases when volume grows.

### 8.8 BlitzPay Phase 2AA (billing profiles, saved method metadata, autopay preferences)

- Tables are **low cardinality** per customer; unique constraints dedupe hashed payment-method rows per org.
- **No** full credential storage; RLS grants members **read** on profile/method/enrollment rows for support visibility — **writes** remain on authenticated org APIs using service role after permission gates (same pattern as other BlitzPay staff tables).
- Portal surface is intentionally minimal to avoid leaking internal billing ops or raw processor references at scale.

### 8.9 BlitzPay Phase 2AB (invoice collection states + recovery orchestration)

- **Orchestration tables** (`blitzpay_invoice_collection_states`, `blitzpay_collection_attempts`, flows, activity log) stay **low volume** per invoice; indexes on `(organization_id, invoice_id)` / status support bounded staff queries.
- **Stripe authority:** settlement truth remains on Stripe + existing PI mirror; Phase **2AB** only **reads** `blitzpay_payment_intents` to refresh safe failure categories — no new money-movement paths.
- **Portal:** `/api/portal/billing/invoices` + `payment-status` + `/portal/billing` must stay summary-only as adoption grows (avoid expanding payloads with internal scoring).

### 8.10 BlitzPay Phase 3B (vendor bills + pay-run orchestration)

- **Staff-only finance APIs** under `…/blitzpay/ap/*` with explicit **row caps** on bills, vendors, and runs — keep off high-frequency customer paths.
- **No autonomous payouts:** allocation rows are bookkeeping / planning; volume scales with **manual** scheduling discipline, not webhook fan-out.
- **GL posting** on approve adds journal work bounded like other Phase **3A** batches — monitor orgs with very large daily bill volume separately.

### 8.11 BlitzPay Phase 3C (tax & compliance foundations)

- **Staff-only finance APIs** under `…/blitzpay/tax/*`, `…/blitzpay/compliance/*`, `…/blitzpay/ach-authorizations`, and `…/blitzpay/vendor-tax-profiles` — **no customer portal** exposure; payloads avoid raw TINs and raw ACH references (hashed retention only).
- **Append-only audit:** `blitzpay_compliance_audit_log` is **update/delete blocked** at the database — growth is **append-mostly** like other audit tables; retention/archival policy is a future ops concern if volume spikes.
- **Bounded reads:** list caps in `blitzpay-tax-engine.ts` / `blitzpay-tax-service.ts` bound jurisdictions, rules, calculations, audit tail, ACH rows, and vendor tax profiles per request — keep reporting snapshot enrichers on the same modest cadence as other BlitzPay snapshot fields.

### 8.12 BlitzPay Phase 3D (financing marketplace foundations)

- **Staff finance APIs** under `…/blitzpay/financing/*` with **row caps** in `blitzpay-financing-service.ts` / `blitzpay-financing-marketplace.ts` — orchestration only; **no** custodial balances or autonomous underwriting.
- **Append-only audit:** `blitzpay_financing_audit_log` is **update/delete blocked** in Postgres — growth is append-mostly; keep staff list reads capped (`BLITZPAY_FINANCING_AUDIT_LIST_CAP`).
- **Portal:** `/api/portal/financing/applications` + `/api/portal/financing/offers` must remain **summary-only** (status, amounts, illustrative APR where present) — do not expose internal compatibility scores or staff treasury payloads to customers.

### 8.13 BlitzPay Phase 3E (procurement & inventory finance foundations)

- **Staff finance APIs** under `…/blitzpay/procurement/*` with **row caps** in `blitzpay-procurement-finance-service.ts` — **no** autonomous purchasing, **no** portal exposure.
- **Append-only audit:** `blitzpay_procurement_audit_log` is **update/delete blocked** in Postgres — growth is append-mostly; keep staff list reads capped (`BLITZPAY_PROCUREMENT_AUDIT_LIST_CAP`).
- **Inventory movements** are append-only ledger rows (corrections via additional rows, not destructive edits).

### 8.14 BlitzPay Phase 4B (revenue optimization foundations)

- **Staff finance APIs** under `…/blitzpay/revenue-optimization/*` with explicit **list caps** (opportunities, actions, scores, experiments) — same traffic profile as Phase **4A** copilot lists; **no** portal routes.
- **Append-only audit:** `blitzpay_revenue_optimization_audit_log` is **update/delete blocked** — bounded staff reads only; optional `BLITZPAY_REVENUE_OPT_AUDIT_PEPPER` strengthens hashes.
- **Reporting snapshot** adds a small bounded query for experiment counts; keep cadence aligned with other snapshot enrichers (avoid per-navigation hot polling at extreme scale).

### 8.15 BlitzPay Phase 5A (multi-entity / franchise finance foundations)

- **Staff finance APIs** under `…/blitzpay/multi-entity/*` with **bounded** group/member/intercompany lists and **capped** linked-org reporting snapshot aggregation (`BLITZPAY_MULTI_ENTITY_MAX_GROUPS`, `BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS`, etc.) — **no** portal routes, **no** autonomous settlements, **no** automatic GL consolidation postings.
- **Append-only audit:** `blitzpay_multi_entity_audit_log` is **update/delete blocked** — bounded staff reads only; optional `BLITZPAY_MULTI_ENTITY_AUDIT_PEPPER` strengthens hashes.
- **RLS:** policies require finance roles and **explicit** group anchor or active membership visibility — treat growth as low-volume configuration + reporting.

### 8.16 BlitzPay Phase 5B (supplier / vendor network foundations)

- **Staff finance APIs** under `…/blitzpay/supplier-network/*` with **bounded** lists (networks, members, programs, bulk rows, benchmarks, scores) — **no** portal routes, **no** autonomous procurement or financing execution.
- **Append-only audit:** `blitzpay_supplier_network_audit_log` is **update/delete blocked** — optional `BLITZPAY_SUPPLIER_NETWORK_AUDIT_PEPPER` strengthens hashes.
- **Reporting:** `fetchBlitzpayOrgReportingSnapshot` supports `skipSupplierNetwork` on nested linked-org fetches to cap extra reads; treat Phase **5B** enrichers like other bounded snapshot modules.

### 8.17 BlitzPay Phase 5C (warranty reserves, claims workflow, protection foundations)

- **Staff finance APIs** under `…/blitzpay/claims/*`, `…/protection-plans`, and `…/storm-events` with **bounded** list caps — **no** portal routes, **no** autonomous claim approval, **no** money movement from these tables.
- **Append-only audit:** `blitzpay_claims_audit_log` is **update/delete blocked** — optional `BLITZPAY_CLAIMS_AUDIT_PEPPER` strengthens hashes.
- **Reporting:** `fetchBlitzpayOrgReportingSnapshot` supports `skipClaimsWarranty`, `skipMobilePhase6a`, and `skipObservabilityPhase6b` on nested linked-org / health-style fetches to cap extra reads; treat Phase **5C** / **6A** / **6B** enrichers like other bounded snapshot modules.

### 8.18 BlitzPay Phase 7A (production hardening foundations)

- **Reporting snapshot nesting:** `lib/blitzpay/blitzpay-reporting-snapshot-nesting.ts` caps `nestingDepth` at **3** and forces Phase **5A/5B/5C/6A/6B** enrichers off when the cap is hit — additive to existing `skip*` flags on linked-org pulls (`buildPhase5aLinkedOrgReportingSlice` passes `nestingDepth + 1` on member snapshots).
- **No Redis / no workers:** guards are pure skip resolution + deterministic ordering preserved in existing snapshot code paths.
- **FCC additive strip:** `operationalReadiness` on `fetchBlitzpayOrgFinancialCommandCenter` surfaces recursion policy, mobile signal score, and replay governance text for staff only — bounded payload growth.
- **Entitlements:** `lib/billing/blitzpay-entitlements.ts` + **Phase 7A.2** satellite modules (`blitzpay-feature-catalog.ts`, `blitzpay-commercial-tier.ts`, `blitzpay-module-registry.ts`, `blitzpay-plan-metadata.ts`, `blitzpay-commercial-packaging.ts`) define module/feature keys, **packaging tier minimums**, and `canAccessBlitzpayFeature(..., { enforceTierGates })` — **default remains permissive** (no customer lockout); `blitzpayModuleWouldBeGatedAtTier` is a **preview** for upgrade copy. UI: `BlitzpayPlanAwarenessStrip` (informational). No Stripe subscription coupling in these helpers.

### 8.19 BlitzPay Phase 7A.3 (security & sensitive payload hardening)

- **Sanitization module:** `lib/blitzpay/blitzpay-payload-sanitization.ts` centralizes observability JSON deep redaction (Stripe-like string prefixes, raw SHA-256/SHA-1 digests, sensitive nested keys), financial-event and idempotency **list row shaping**, claims payout **hash shaping**, and **portal-only** hosted-checkout success bodies (`url` field only).
- **Platform vs tenant:** `GET /api/platform/blitzpay/observability-rollup` no longer forwards raw exception text in JSON on failure — server logs retain detail via `logBlitzpayServerFailure`.
- **Regression test:** `pnpm test:blitzpay-phase-7a3-security-hardening`.

### 8.20 BlitzPay Phase 7A.4 (performance & reporting efficiency)

- **FCC:** `fetchBlitzpayOrgFinancialCommandCenter` eliminates duplicate `fetchBlitzpayOrgReportingSnapshot` by precomputing collections + snapshot once and passing `precomputedReporting` / `precomputedCollections` into `fetchBlitzpayOrgRevenueIntelligence`.
- **Multi-entity:** nested org reporting snapshots are fetched in small parallel batches (`BLITZPAY_MULTI_ENTITY_SNAPSHOT_FETCH_CONCURRENCY`) while respecting `BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS`.
- **Schema health:** table probes run in fixed-size parallel batches (`BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY`) with unchanged coverage; cached path unchanged.
- **Nesting depth:** `clampBlitzpayReportingNestingDepth` prevents bypass of max depth from malformed inputs.
- **Platform observability rollup:** explicit caps `BLITZPAY_PLATFORM_OBSERVABILITY_QUEUE_SNAPSHOT_ROW_CAP` / `BLITZPAY_PLATFORM_OBSERVABILITY_MAX_ORGS`.
- **Regression test:** `pnpm test:blitzpay-phase-7a4-performance`.

### 8.21 BlitzPay Phase 7A.5 (demo data & showcase readiness)

- **Deterministic presets:** `lib/blitzpay/blitzpay-demo-presets.ts` defines bounded archetype bundles, FCC-style showcase snapshots, humanized activity lines, and coherence validation — **in-memory only** in this phase (no large seed payloads, no UUID storms).
- **Sales posture:** mixed `healthy` / `attention` / `elevated` module tags and staggered reference-day offsets keep demos from reading as uniformly green while staying realistic on totals.
- **Regression test:** `pnpm test:blitzpay-phase-7a5-demo-data`.

### 8.22 BlitzPay Phase 7A.6 (Stripe live readiness & webhook safety)

- **Guards:** `lib/blitzpay/blitzpay-stripe-readiness-guards.ts` adds key-mode parsing, webhook id validation, duplicate-delivery body helper, livemode alignment hints (advisory), operational log sanitization (no `whsec_` / `sk_*` / `pk_*` leakage), expanded Connect webhook checklist notes, `buildBlitzpayStripeLiveReadinessStrip` for staff FCC, and bounded webhook ops narrative for platform summaries.
- **FCC:** `fetchBlitzpayOrgFinancialCommandCenter` includes additive `stripeLiveReadiness` (host/publishable mode labels, webhook signing flag, Connect/payout/dispute/ACH advisory copy — **no secrets**).
- **Platform ops:** `fetchBlitzpayPlatformOperationsSummary` adds bounded webhook inbox pending counts, Connect onboarding-attention org counts, charges-without-payouts org counts, host secret-key **mode** only, BlitzPay webhook secret presence, webhook operational status lines, critical alerts on live-policy vs test-key mismatch, and stable JSON on `GET /api/platform/blitzpay/operations` load failures.
- **Regression test:** `pnpm test:blitzpay-phase-7a6-stripe-live-readiness`.

---

## 9. AI / Usage Scale Risks

| Component | File / table | Risk |
|-----------|--------------|------|
| **Per-request logs** | `ai_usage_logs` (`20260617100000`) | **Unbounded growth**; index exists; consider retention job |
| **Aiden usage events** | `aiden_usage_events` + indexes | Same |
| **AI operation buckets** | `ai_operation_rate_buckets` | Good for **lightweight** rate limits |
| **AI cache** | `ai_cache` (`20260619100000`) | Hits indexed; eviction policy should be monitored |
| **AI jobs** | `lib/ai/jobs/process-ai-job.ts`, cron routes | Long work must stay **off request thread** (`waitUntil` / cron) — verify all heavy paths |

**Rate limits:** `tryConsumeAiOperationSlot` used on a subset of routes; **not universal** across all LLM entry points — inconsistent caps can allow **cost spikes** if one route is missed.

---

## 10. Background Job Needs

| Workload | Current pattern (observed) | Scale recommendation |
|----------|---------------------------|------------------------|
| **Imports** | `organization_import_job_runs`, async phases (`20260506225000`, `20260507040000`) | Continue **lease + retry** pattern; consider **dedicated worker** when queue depth grows |
| **AI generation** | Jobs processor + cron (`process-ai-jobs`, `lib/ai/jobs/process-ai-job.ts`) | **Queue + concurrency limits** per org |
| **Emails / SMS** | Communications send routes | Async queue + delivery log (partially described in comms docs) |
| **Stripe webhooks** | Inline in serverless | OK for low volume; **queue** if dispatch grows |
| **Maintenance due / recurring WOs** | Cron `maintenance-due`, workflow automation | Monitor duration; **split** org batches |
| **QuickBooks sync** | Org routes + tokens via service role | Backoff + rate limit to Intuit |

---

## 11. Observability Gaps

- **No unified** request id across API + client logs.
- **Stripe:** structured JSON logs in webhook — **good template** for other routes.
- **Missing:** Supabase/PostgREST **slow query** log integration, **p95 latency** per route, **tenant-level** usage dashboards, **webhook failure** alerting, **AI cost** daily cap alerts.
- **Errors swallowed:** many `catch` blocks return generic messages — fine for clients; **server-side** should log **stack + route + org id hash** consistently.

---

## 12. Security / Rate Limit Gaps

- **Middleware** (`middleware.ts`): session refresh, portal gate, admin email gate — **no API rate limiting**.
- **Portal** (`portalAuthGate`, portal API routes): auth-dependent; still subject to **credential stuffing**, **token replay**, **enumeration** — recommend **WAF / Vercel firewall** + per-route limits on `POST /api/portal/access/exchange` and similar.
- **Webhooks:** Stripe signature verification — good; **replay** window handled by Stripe; idempotency DB — good.
- **AI routes:** partial AI rate limits — extend coverage.
- **File uploads / imports:** storage and import pipelines — **size limits** and **virus scanning** should be validated at edge/gateway scale (not fully audited here).

---

## 13. Recommended Indexes (for a future migration PR — not applied here)

> **Do not apply blindly** — each should be validated against `EXPLAIN (ANALYZE, BUFFERS)` on production-like data.

1. **Trigram GIN** (if `pg_trgm` enabled) on **searchable text** columns used in global search: `customers.company_name`, `equipment.name`, `work_orders.title`, `org_invoices.invoice_number`, `org_quotes.quote_number` — **tenant-prefixed** queries still need `organization_id` equality first.
2. **Partial indexes** for hot dashboards: e.g. `work_orders (organization_id, created_at desc) where archived_at is null and status in ('open', 'scheduled')` — match actual filter sets from UI.
3. **Foreign-key covering indexes** on any child table missing `organization_id` leading index when FK is only `(org, child_id)` — verify with `pg_indexes` in staging.
4. **BlitzPay Phase 2:** `payment_events (organization_id, stripe_object_id)` unique, `stripe_payment_intent_id` unique partial.

---

## 14. Recommended Refactors (prioritized — design only)

1. **Server-driven pagination** for work orders, customers, invoices, equipment lists (cursor or keyset).
2. **Virtualized tables** (e.g. `@tanstack/react-virtual`) for remaining large lists.
3. **Move heavy list reads** from browser Supabase to **Route Handlers** or **Server Components** with strict `limit` + `cursor`.
4. **Split `compute-analytics`** into **cacheable segments** or **materialized views** per org/day (with invalidation strategy).
5. **Central `withOrgRateLimit`** wrapper for `app/api/organizations/[organizationId]/**` and portal APIs.
6. **Observability middleware** — generate `x-request-id`, log duration + row counts (sanitized).

---

## 15. Phase-by-Phase Scale Hardening Plan

| Phase | Focus | Outcomes |
|-------|--------|----------|
| **0 — Baseline** | Enable Supabase **slow query log** sampling; Vercel **analytics** + function metrics | Know p95/p99 |
| **1 — Quick wins** | Pagination on top 3 lists (WO, customers, invoices); cap inventory default limits | Cut max payload |
| **2 — Search** | Trigram or FTS; debounce client search | Predictable search cost |
| **3 — Jobs** | Queue (e.g. Vercel Queue, Inngest, SQS) for webhooks + imports + AI | Stable tail latency |
| **4 — Data lifecycle** | Archival + retention for logs/AI/events | Control disk + vacuum |
| **5 — BlitzPay Phase 2** | Payment ledger + idempotency + reconciliation cron | Money safety |

---

## 16. Quick Wins

1. Add **default `.limit()`** + “load more” to **work orders** list query in `app/(dashboard)/work-orders/page.tsx`.
2. Lower **inventory** API default/max limits or require **explicit** high cap with permission.
3. Add **server-side debounce** or **minimum query length** enforcement on global search (client already has short query behavior; server should reject abusive `q`).
4. **Log duration** in `GET .../reports/analytics` and `runOrgGlobalSearch` when `NODE_ENV=production` (sanitized).
5. Document **Stripe Dashboard webhook** timeout expectations; keep dispatch **< 10s**.

---

## 17. Do Not Touch Yet

- **RLS policy semantics** without security review — risk of cross-tenant leaks.
- **Core billing price mapping** (`lib/billing/stripe-price-map.ts`) — financial correctness.
- **Webhook idempotency table semantics** — money and subscription state.
- **Large mechanical refactors** of `work-orders/page.tsx` without product QA — high regression risk.

---

## Appendix — Key files referenced

| Area | Paths |
|------|--------|
| Migrations | `supabase/migrations/*.sql` (148 files); foundations: `20260501125600_multi_tenant_foundation.sql`, `20260501133000_customer_foundation.sql`, `20260501152000_work_orders_foundation.sql`, `20260501170000_maintenance_plans_foundation.sql` |
| RLS / technician scope | `20260812280000_technician_assigned_scope_rls.sql` |
| Global search | `lib/global-search/run-global-search.ts`, `app/api/organizations/[organizationId]/global-search/route.ts` |
| Analytics | `lib/reporting/compute-analytics.ts`, `app/api/organizations/[organizationId]/reports/analytics/route.ts` |
| Work orders UI | `app/(dashboard)/work-orders/page.tsx` |
| Stripe SaaS webhook | `app/api/stripe/webhook/route.ts`, `lib/billing/stripe-webhook-sync.ts` |
| BlitzPay | `docs/BLITZPAY_PHASE_1.md`, `app/api/blitzpay/webhook/route.ts`, `lib/blitzpay/*` |
| AI metering | `supabase/migrations/20260617100000_ai_usage_logs.sql`, `20260812291000_aiden_usage_events.sql`, `lib/ai/operation-rate-limit` (pattern) |
| Rate limit roadmap | `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md` |
| Middleware | `middleware.ts` |

---

*End of audit — read-only; no schema or application code was modified to produce this document.*
