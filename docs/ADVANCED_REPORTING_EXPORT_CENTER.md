# Advanced reporting & export center (Phase 63.1)

Focused **export infrastructure** pass: shared CSV helpers, consistent filenames, permission-safe behavior, and honest UX — not a new BI product.

**KPI definitions** used by the underlying analytics engine are documented in **`docs/KPI_AND_ANALYTICS_STANDARDIZATION.md`** and implemented in **`lib/kpi/definitions.ts`** (Phase 63.3).

## Architecture

| Layer | Role |
| --- | --- |
| **APIs** | Org-scoped report endpoints (e.g. `GET /api/organizations/:id/reports/analytics`, `.../reports/financial-invoices`, `.../communications/feed`) enforce membership + permissions. Exports do **not** bypass these; the client builds CSV from already-authorized JSON. |
| **Client CSV** | `lib/reporting/export-csv.ts` — `escapeCsvCell`, `rowsToCsv`, `withUtf8Bom`, `downloadCsv` (optional UTF-8 BOM, default **on** for Excel). |
| **Naming** | `lib/reporting/export-filename.ts` — `equipifyExportFilename({ slug, range \| dateStamp })` → `equipify-{slug}-{from_to}.csv`. |
| **Safety constants** | `lib/reporting/export-constants.ts` — `CLIENT_CSV_EXPORT_ROW_WARN_THRESHOLD` (5,000) for in-browser row counts; **informational** copy in UI / toasts. |

## Staff app surfaces

- **`/reports` — Export center** — `components/reporting/report-export-center.tsx` explains where exports live, permissions, Excel/BOM behavior, and links to **Communications** for feed CSV. Primary **Operational CSV** and **Print/PDF** stay in the filter toolbar; financial CSV remains on **Invoice & payment financials**.
- **Operational CSV** — Built from `ReportAnalyticsResponse` (same payload as charts/KPIs). Filename: `equipify-operational-report-{from}_{to}.csv`.
- **Financial invoice CSV** — `FinancialInvoiceReportSection`; server loads invoices with **`INVOICE_ROW_CAP` = 8000** (`lib/reporting/financial-invoices-report.ts`); `truncated` is surfaced in the payload — CSV matches loaded rows only.
- **Communications feed CSV** — Refactored to shared helpers; exports **currently loaded** feed rows (API `limit=100` in UI); filename uses daily stamp. Warn copy if row count exceeds threshold (future-proof if limits rise).

## Permissions & entitlements

- **Analytics API:** `canViewOperationalReports` **or** `canViewFinancialReports` (platform admin bypass unchanged).
- **Financial invoices API:** `canViewBilling` **or** `canViewFinancials` (`requireAnyOrgPermission`).
- **`reports_advanced` / plan entitlements:** Not wired into these endpoints in this phase (see `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` — partial coverage). Future work may tighten **advanced** analytics separately without changing CSV mechanics here.

## Portal customer reports (`/portal/reports`)

- Lists **mock/sample** entries (`portalReports`). **Download** does not fabricate a file — it shows a **Sonner** toast explaining preview-only content and directs users to their provider for real exports.

## Settings audit log

- **Export preview CSV** exports the **filtered sample rows** displayed on the page with honest toast copy — not a live SIEM export.

## Supported formats

- **CSV only** in this phase for unified operational exports (no new XLSX generator in-app; migration/import continues to use `xlsx` for **upload** parsing elsewhere).

## Large dataset safeguards

- Server-side invoice report **cap** (8000 rows) with `truncated` flag.
- Client uses `queueMicrotask` + **busy** state on heavy CSV buttons to avoid double-clicks and yield to the browser before large string work.
- Communications threshold constant documents risk for very large in-memory lists.

## Deferred / future

- Server-streamed CSV for unlimited historical pulls (job queue).
- Entitlement gate for `reports_advanced` on specific widgets/endpoints.
- True portal PDF generation tied to org-branded templates.

## Related docs

- `docs/EXECUTIVE_DASHBOARD_EXPANSION.md` — home dashboard metrics vs. export/report definitions.
- `docs/PERFORMANCE_AND_QUERY_OPTIMIZATION_AUDIT.md`
- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md`
- `docs/ERROR_BOUNDARY_AND_FAILURE_STATE_STANDARDS.md`
- `docs/SETTINGS_WIRING_AUDIT.md` (audit preview honesty)
