# BlitzPay Phase 3A — General ledger & internal accounting

Phase **3A** introduces **contractor-native double-entry books** inside Equipify: chart of accounts, journal batches and entries, journal lines, financial periods, deferred revenue schedules, and account balance snapshots. It is **foundational infrastructure** — not a replacement for Stripe Connect settlement.

## Authority boundaries

| Concern | Source of truth |
|--------|------------------|
| Payment captured / refunded / disputed on Connect | **Stripe** (webhooks, balance transactions, payouts) |
| Internal accrual view, COA, posted journals, reversals | **BlitzPay GL** (Postgres tables under `blitzpay_*` accounting names) |

Staff UIs and org APIs must **not** expose raw Stripe identifiers in customer-facing or general staff payloads; GL payloads use **org-scoped UUIDs** and **internal batch/entry references** only.

## Double-entry model

- Amounts are **integer cents** everywhere in the engine; no floating-point money math.
- Every journal entry has **two or more lines**; debits must equal credits before post.
- **Posting** marks the parent batch `posted` and triggers DB enforcement: **lines and entry totals are immutable** after post.
- **Corrections** are **reversal entries**: a new posted batch with **offsetting** debits/credits (and `is_reversing_entry` semantics in the service layer). No destructive edits to posted rows.

## Determinism & ordering

- Journal lines are sorted deterministically (`account_id`, `line_type`, `amount`) before validation and persistence.
- Bounded list caps (`BLITZPAY_GL_*` constants in `lib/blitzpay/blitzpay-general-ledger.ts`) apply to APIs and reporting helpers.

## Revenue recognition & deferred revenue (foundations)

- `blitzpay_deferred_revenue_schedules` tracks original, recognized, and remaining amounts plus a `next_recognition_date`.
- Pure helpers in `lib/blitzpay/blitzpay-revenue-recognition.ts` compute the next slice and updated schedule state deterministically.
- `POST …/blitzpay/accounting/revenue-recognition/run` (staff, schema-guarded) applies bounded runs using the service role after permission checks.

## AP / AR / treasury / payroll (control-plane foundations)

- `lib/blitzpay/blitzpay-ledger-reconciliation.ts` compares **GL account 1100 / 2000 / 1000** style proxies from the trial balance to **operational** AR/AP/treasury snapshots for **warning-only** signals (tolerance-based).
- Reporting snapshot adds **Phase 3A** totals (`totalAssetsCents`, `glPayrollLiabilityCents` for ledger payroll liability vs. existing payroll accrual `payrollLiabilityCents`, trial balance health, draft batch count proxy, pending recognition count).

## RLS & access

- Tables are **organization-scoped** with policies aligned to existing BlitzPay patterns (finance roles / org members per migration).
- **Customer portal** does not receive GL routes; accounting APIs require financial staff capabilities and `blitzpaySchemaGuardNextResponse` on each request.

## Key files

| Area | Path |
|------|------|
| Migration | `supabase/migrations/20261010120000_blitzpay_phase_3a_general_ledger.sql` |
| COA / posting service | `lib/blitzpay/blitzpay-general-ledger-service.ts` |
| Pure GL types & validation | `lib/blitzpay/blitzpay-general-ledger.ts` |
| Engine (periods, reversal lines, rollups) | `lib/blitzpay/blitzpay-accounting-engine.ts` |
| Revenue recognition math | `lib/blitzpay/blitzpay-revenue-recognition.ts` |
| AP/AR/treasury compare helpers | `lib/blitzpay/blitzpay-ledger-reconciliation.ts` |
| Org APIs | `app/api/organizations/[organizationId]/blitzpay/accounting/**` |
| Reporting snapshot | `lib/blitzpay/blitzpay-reporting-snapshot.ts` |
| Staff UI | `components/blitzpay/blitzpay-accounting-overview-panel.tsx` |

## Tests

- `pnpm test:blitzpay-phase-3a-general-ledger` — deterministic pure-function and static guard tests (no DB).

## Optional environment

- `BLITZPAY_GL_SOURCE_PEPPER` — server-only secret mixed into `hashAccountingSourceReference` for stable fingerprints of external references (see `.env.local.example`).

---

# BlitzPay Phase 3B — Native AP automation & bill pay foundations

Phase **3B** adds **vendor records**, **vendor bills** (header + lines), **approval-flow rows**, **payment-run + allocation orchestration**, **vendor aging snapshots** (table for future scheduled jobs), and **append-only AP audit events**. It extends the **Phase 3A GL** with **bill accrual** posting on **approve** (debit expense / credit accounts payable), **integer cents**, **deterministic ordering**, and **paid-bill immutability** at the database (updates blocked when `bill_status = paid`; corrections go through reversals / new entries, not silent edits).

## Non-goals (this phase)

- **No autonomous outbound payments** — allocations and pay runs are **planning and bookkeeping scaffolding** only; nothing in this phase transmits ACH/wire/check on a timer.
- **No OCR / ML extraction** — ingestion is **manual, imported, or integration-typed** with deterministic validation and hashed external references where applicable.
- **No customer portal** — all AP routes are **org staff** with financial capability gates and schema health guards.

## Workflow (deterministic)

- Bills: **draft → pending_approval → approved → scheduled → paid** (plus **partially_paid**, **disputed**, **voided** as modeled in the migration).
- **Approval** is **threshold-based** (`BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS` in `blitzpay-ap-automation.ts`); optional **approval flow** row when `approval_required` is true — **no AI approval**.
- **Schedule** creates a **payment run** (orchestration) and **allocation** rows with `provider` ∈ `stripe | external | manual` and **metadata only** for provider references (hashed where stored on bills).

## Treasury-aware scheduling

- Helpers combine **treasury operating balance** (from existing contractor treasury aggregation) with **approved bills awaiting payment** to produce **coverage basis points** and bounded **health / cash optimization** scores (`blitzpay-ap-automation.ts`, `fetchApHealthDashboard` in `blitzpay-ap-service.ts`).

## Purchase order linkage

- `linked_purchase_order_id` is validated against **`org_purchase_orders.organization_id`** before insert (`assertPurchaseOrderOrgMatch`).

## Reporting & command center

- `fetchApReportingSnapshotFields` feeds **bounded** snapshot fields: open AP, approved awaiting pay, overdue vendor bills, average payment days from **completed** allocations (capped), concentration, treasury coverage (bps), aging health score.
- Financial command center tiles and **Settings → Payments → Vendor bills & pay planning** (`BlitzpayApBillPayPanel`) surface the same signals in contractor-friendly copy.

## Key files

| Area | Path |
|------|------|
| Migration | `supabase/migrations/20261012120000_blitzpay_phase_3b_ap_automation.sql` |
| Pure AP math / caps | `lib/blitzpay/blitzpay-ap-automation.ts` |
| Aging buckets | `lib/blitzpay/blitzpay-vendor-aging.ts` |
| Service (CRUD, approve, GL accrual, health) | `lib/blitzpay/blitzpay-ap-service.ts` |
| Default vendor COA lines | `BLITZPAY_VENDOR_COA_EXTENSION` in `lib/blitzpay/blitzpay-general-ledger.ts` |
| Org APIs | `app/api/organizations/[organizationId]/blitzpay/ap/**` |
| Staff UI | `components/blitzpay/blitzpay-ap-bill-pay-panel.tsx` |

## Tests

- `pnpm test:blitzpay-phase-3b-ap-automation` — deterministic helpers, migration immutability string, API permission/schema guards, schema health table list (no DB).
