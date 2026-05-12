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
