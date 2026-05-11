# KPI & analytics standardization (Phase 63.3)

Canonical status sets and windows live in **`lib/kpi/definitions.ts`**. Dashboard hooks, **reports analytics** (`computeReportAnalytics`), **customer rollups**, and **internal notification** evaluation import from there so duplicate literals do not drift.

This phase **documents** intentional differences (e.g. revenue vs. completion timing); it does **not** silently redefine monetary totals.

## KPI dictionary

### Work orders — open pipeline

| Constant | DB statuses | Used for |
| --- | --- | --- |
| `WORK_ORDER_OPEN_PIPELINE_DB` | `open`, `scheduled`, `in_progress` | Open queue counts, unassigned filter, reports **workOrdersInProgress**, dashboard open WO total, dispatch-centric logic |

### Work orders — revenue (labor + parts)

| Constant | DB statuses | Time field | Used for |
| --- | --- | --- | --- |
| `WORK_ORDER_REVENUE_MONTH_ROLLUP_DB` | `completed`, `invoiced` | **`updated_at`** (month prefix / chart window) | Dashboard monthly revenue figure; 12‑month revenue chart |
| `WORK_ORDER_ANALYTICS_REVENUE_PERIOD_DB` | Same | **`updated_at`** within report `from`–`to` | **`computeReportAnalytics`** period revenue |

### Work orders — completions & analytics

| Constant | DB statuses | Time field | Used for |
| --- | --- | --- | --- |
| `WORK_ORDER_COMPLETED_AT_MONTH_DB` | `completed`, `completed_pending_signature`, `invoiced` | **`completed_at`** in calendar month | Executive dashboard **Completed this month** card |
| `WORK_ORDER_ANALYTICS_EXTENDED_COMPLETION_DB` | Same three | **`updated_at`** in report range | Reports cycle metrics + equipment-type **completed** classification |
| `WORK_ORDER_PIPELINE_CHART_ORDER_DB` | Full six-status pipeline order | Per-status **counts** (all time, org scoped) | Dashboard WO status pie |

**Important:** **Monthly revenue** is **not** the sum of “completed this month” rows — it uses **`updated_at`** on **`completed`/`invoiced`** only and excludes **`completed_pending_signature`**. Compare apples to apples when reviewing exec metrics vs. revenue.

### Quotes — pipeline

| Constant | DB statuses |
| --- | --- |
| `QUOTE_PIPELINE_DB_STATUSES` | `draft`, `sent`, `pending_approval` |

### Invoices — aging query

| Constant | DB statuses | Notes |
| --- | --- | --- |
| `INVOICE_AGING_QUERY_DB` | `sent`, `unpaid`, `overdue` | Rows are then filtered to **overdue** by due date / status in analytics (same pattern as before Phase 63.3). |

### Maintenance — analytics helper

| Constant | Statuses |
| --- | --- |
| `WORK_ORDER_ANALYTICS_PM_LINKED_DB` | `completed`, `invoiced` | PM-linked WO rows in report window (`updated_at`). |

### Time windows (days)

| Constant | Value | Usage |
| --- | ---: | --- |
| `REPEAT_REPAIR_LOOKBACK_DAYS` | 90 | Dashboard repeat repair + **reports** repeat window (`computeReportAnalytics` uses end-of-range minus this many days). |
| `WARRANTY_EXPIRY_LOOKAHEAD_DAYS` | 30 | Dashboard “expiring warranties” card. |

## Date & timezone rules

- **Dashboard calendar month** (`boundsThisMonth`) uses the viewer’s **local** date for month start/end ISO strings — consistent with prior behavior.
- **Reports** (`reportRangeFromPreset`, analytics params) use **inclusive `YYYY-MM-DD`** strings on queries; timestamps append `T00:00:00` / end-of-day as implemented per query (server-side **UTC** interpretation — unchanged).

## Permissions & entitlements

- Financial **numbers** still come from **RLS-scoped** queries; UI gates (e.g. quote card for `canViewQuotes`) are unchanged.
- **`reports_advanced`** entitlement remains **partially** wired outside this module — see `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md`.

## Export alignment (Phase 63.1)

- Operational CSV is built from **`ReportAnalyticsResponse`** returned by `computeReportAnalytics` — now driven by the **same** constants as the analytics engine for WO/invoice status filters where refactored.
- No export column semantics were intentionally changed in Phase 63.3.

## Executive dashboard (Phase 63.2)

- Cards **Completed this month**, **Quote pipeline**, **Unassigned open work**, **Active PM plans** reference the definitions above.

## Deferred / known limits

- **Quote conversion rate** — requires agreed numerator/denominator across CRM stages; not invented here.
- **Technician utilization %** — needs capacity model; workload remains proxy via assignments elsewhere.
- Full **dispatch / schedule** modules still embed literal status arrays in places — acceptable duplication until a future consolidation pass (avoid broad refactor risk).

## Related docs

- `docs/EXECUTIVE_DASHBOARD_EXPANSION.md`
- `docs/ADVANCED_REPORTING_EXPORT_CENTER.md`
- `docs/PERFORMANCE_AND_QUERY_OPTIMIZATION_AUDIT.md`
