# Migration Center — Phase 2

## Summary

Phase 2 hardens CSV imports: **merge strategies**, **duplicate-aware commit** paths (customers, equipment, invoices, work orders), **created / updated / skipped / failed** counts, **outcome CSV exports**, **preview projections**, **commit confirmation**, **import job detail** (`/settings/imports/[jobId]`), and **history** columns — without rewriting Phase 1 pipelines.

## Database

Apply migration:

`supabase/migrations/20260506140000_organization_import_jobs_phase2.sql`

Adds nullable/default-safe columns on `organization_import_jobs`: `skipped_count`, `updated_count`, `strategy`, `committed_by`. Extends `organization_import_job_rows.status` check to allow `updated`.

## API

| Route | Change |
|-------|--------|
| `POST .../migration-imports` | Initial preview includes `projection` (default strategy `skip_duplicates`). List `GET` returns strategy and counts. |
| `POST .../migration-imports/[jobId]/preview` | Body: `{ columnMapping?, options?: { strategy?, duplicateStrategy? } }`. Response includes `projection` and persisted `strategy` in `validation_summary`. |
| `POST .../migration-imports/[jobId]/commit` | Persists `strategy`, `committed_by`, per-row outcomes; job counts: `success_count` = created, `updated_count`, `skipped_count`, `error_count`. |
| `GET .../migration-imports/[jobId]` | Job metadata + sanitized row sample (`recordRef` short ref, no raw UUIDs). `canExport` when a CSV is stored. Query: `rowLimit` (max 500). |
| `GET .../migration-imports/[jobId]/export?filter=all\|failed\|skipped` | Outcome CSV (matched record uses label or short ref). |

## UI

- `components/migration/csv-import-flow.tsx` — strategy select, projection cards, duplicate/ref warnings, safety copy, commit `AlertDialog`, post-commit downloads + job detail link.
- `app/(dashboard)/settings/imports/page.tsx` — history: strategy, counts, link to detail, warning icon for `completed_with_errors`.
- `app/(dashboard)/settings/imports/[jobId]/page.tsx` — job detail.

## Future (not in Phase 2)

- AI-assisted duplicate suggestions and column mapping.
- Full rollback / replay job.
- Async processing for very large files beyond current caps.
