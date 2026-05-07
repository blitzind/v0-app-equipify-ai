# Migration Center - Async Phase 1

## Scope

Additive infrastructure for long-running historical imports without replacing the existing synchronous flow.

## What was added

- `organization_import_job_runs` table for per-run progress and resumable cursor metadata.
- `organization_import_jobs` additive progress fields:
  - `active_run_id`
  - `processed_count`
  - `cancel_requested_at`
- Async execution API:
  - `GET /api/organizations/[organizationId]/migration-imports/[jobId]/async`
  - `POST /api/organizations/[organizationId]/migration-imports/[jobId]/async` with `action: start|tick|cancel`
- Chunked runner (`lib/migration-imports/async-runner.ts`) that:
  - processes CSV slices
  - appends/upserts row outcomes
  - updates run and job progress counters
  - supports cancellation checkpoints
- UI foundations in `CsvImportFlow`:
  - "Start background import (beta)"
  - live progress panel
  - cancel request action
- Job detail/list now surface processing progress.

## Operational notes

- Existing synchronous commit remains unchanged and still supported.
- Async processing in Phase 1 is client-driven polling (`tick`) to avoid introducing a queue worker dependency yet.
- Row outcomes and export CSV endpoints continue to work (same source table).

## Next TODOs

- Server-side worker/cron trigger for autonomous ticks.
- Locking/lease mechanism for multi-worker concurrency.
- Retry policies and exponential backoff for transient DB/storage failures.
- Persisted projection snapshots for chunk-level drift detection.
- Resume from last successful chunk after deploy/restart without open tab.
