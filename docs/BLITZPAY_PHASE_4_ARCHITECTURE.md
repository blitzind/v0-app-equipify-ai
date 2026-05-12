# BlitzPay Phase 4 — AI Financial Copilot (architecture)

This document describes **Phase 4A** (shipped in codebase as migration `20261116120000_blitzpay_phase_4a_ai_financial_copilot.sql` and `lib/blitzpay/blitzpay-ai-*.ts`) and **Phase 4B** (migration `20261117120000_blitzpay_phase_4b_revenue_optimization.sql` plus `lib/blitzpay/blitzpay-revenue-optimization*.ts`). Later Phase 4 sub-phases may extend models **without** changing the deterministic-first contract.

## Design principles

1. **Deterministic-first** — Every insight and recommendation carries a **deterministic score** (0–100) and **supporting_metrics** derived from existing BlitzPay reporting aggregates (GL health, AP/AR, collections, treasury, procurement, financing, memberships, payroll). No score is produced from opaque model output alone.
2. **Recommendation-only** — The system **never** autonomously moves money, approves financing, posts GL, pays vendors, changes tax rules, runs treasury transfers, or contacts customers/vendors. APIs are read-heavy; mutations only **dismiss**, **acknowledge**, or **mark complete** advisory rows.
3. **Explainable** — Titles and summaries reference concrete metrics (counts, cents where shown as aggregates, runway labels). “Hybrid” rows add a **template** `ai_reasoning_summary` line that repeats the deterministic anchor; there is **no** unbounded LLM orchestration in Phase 4A.
4. **Auditable** — `blitzpay_ai_audit_log` is **append-only** (update/delete blocked by trigger). Rows include `immutable_hash` (SHA-256 over canonical JSON + optional `BLITZPAY_AI_AUDIT_PEPPER`).
5. **Bounded** — List APIs cap at 50 rows; regeneration archives prior `active` insights then inserts a fresh bounded set (≤24 prioritized insights + forecast snapshots + recommendation rows).
6. **Not authoritative** — Insights and forecasts are **advisory artifacts**. They do **not** become authoritative accounting state; GL remains sourced from journals and existing engines.

## Tables

| Table | Role |
|-------|------|
| `blitzpay_ai_financial_insights` | Advisory cards (`insight_type`, `severity`, `deterministic_score`, `supporting_metrics`, optional `recommendation_summary`, `generated_by`, lifecycle `insight_status`). |
| `blitzpay_ai_recommendation_actions` | Human queue (`action_status`, `action_type`, `deterministic_basis`, optional `ai_reasoning_summary`) linked to `insight_id`. |
| `blitzpay_ai_forecast_snapshots` | Bounded deterministic projections per `snapshot_type` and `forecast_window_days`. |
| `blitzpay_ai_audit_log` | Immutable audit trail for generation and manual disposition events. |

## RLS

Same pattern as Phase **3E** procurement finance tables: **`has_org_role(organization_id, ['owner','admin','manager'])`** for `SELECT` to `authenticated`. **No** grants to `anon`/`public`. Writes use the **service role** from trusted API routes (session-gated by org permissions first).

## APIs (org-scoped)

All under `GET|POST /api/organizations/[organizationId]/blitzpay/ai/…` with `requireAnyOrgPermission(..., ['canViewFinancialReports','canViewFinancials'])` and `blitzpaySchemaGuardNextResponse`:

- `GET …/insights` — optional `?regenerate=1&windowDays=` to refresh artifacts.
- `GET …/recommendations`, `GET …/forecasts`, `GET …/executive-summary`, `GET …/health`
- `POST …/insights/[id]/dismiss`, `POST …/recommendations/[id]/acknowledge`, `POST …/recommendations/[id]/complete`

## Reporting snapshot extension

`fetchBlitzpayOrgReportingSnapshot` adds integer fields: `aiFinancialRiskScore`, `treasuryPressureScore`, `marginRiskScore`, `collectionsOptimizationScore`, `payrollPressureScore`, `procurementEfficiencyScore`, `vendorConcentrationRiskScore`, `aiInsightCoverageRate` (see `blitzpay-ai-snapshot-scores.ts`).

## UI

- **Financial Command Center** (`/insights/financial-command-center`) embeds `BlitzpayAiFinancialCopilotPanel` and `BlitzpayRevenueOptimizationPanel`.
- **Insights hub** (`/insights`) shows the same panels for finance-capable users.
- Required disclaimers are rendered in-panel (copilot vs revenue optimization copy differs).

## Environment

- **`BLITZPAY_AI_AUDIT_PEPPER`** (optional) — server-only; strengthens audit hashes. Distinct from `BLITZPAY_GL_SOURCE_PEPPER`.
- **`BLITZPAY_REVENUE_OPT_AUDIT_PEPPER`** (optional) — server-only; strengthens `blitzpay_revenue_optimization_audit_log` hashes (Phase 4B).

## Phase 4B — Revenue optimization foundations (deterministic)

**Scope:** Advisory **opportunities**, **human action queue**, **per-customer payment behavior scores** (bounded customer scan), **experiment tracking** rows, and an **append-only optimization audit log**. All math is integer-based (cents, scores 0–100, experiment lift in basis points). **No** autonomous customer messaging, **no** automatic price or membership mutations, **no** financing approvals, **no** treasury movement, **no** override of Phase **2AB** retry caps, and **no** hidden model reasoning.

### Tables (4B)

| Table | Role |
|-------|------|
| `blitzpay_revenue_optimization_opportunities` | Advisory queue (`opportunity_type`, `priority`, deterministic scores, `supporting_metrics`, optional revenue impact cents). |
| `blitzpay_revenue_optimization_actions` | Staff disposition (`action_status`, `action_type`, `deterministic_basis`) — acknowledge/complete only; **no execution**. |
| `blitzpay_revenue_optimization_experiments` | Operational experiment metadata (control/treatment labels, baseline/observed integers, lift bps). **No** auto rollout. |
| `blitzpay_customer_payment_behavior_scores` | Daily per-customer deterministic scores from bounded `org_invoices` + billing profile hints. |
| `blitzpay_revenue_optimization_audit_log` | Immutable audit (`immutable_hash` + optional `BLITZPAY_REVENUE_OPT_AUDIT_PEPPER`). |

### APIs (4B)

Under `GET|POST /api/organizations/[organizationId]/blitzpay/revenue-optimization/…` with the same org permission + schema guard pattern as 4A:

- `GET …/opportunities`, `POST …/generate`, `GET …/actions`, `POST …/actions/[id]/acknowledge|complete`, `POST …/opportunities/[id]/dismiss`
- `GET|POST …/experiments`, `GET …/payment-behavior`, `GET …/health`

### Reporting

`fetchBlitzpayOrgReportingSnapshot` adds bounded Phase **4B** fields (`revenueOptimizationScore`, `estimatedRevenueOpportunityCents`, coverage + opportunity counts, `optimizationExperimentCount`) computed in `blitzpay-revenue-optimization-metrics.ts`.

## Future boundaries

Optional LLM enrichment must remain **strictly bounded**, **never** overwrite deterministic fields, and **never** trigger side effects without explicit human-driven flows outside this module.
