# Migration Center - Async Phase 2

## Scope

Additive hardening for async import processing:

- cron-driven server ticks
- lease/locking protections
- retry/backoff for transient failures
- failed-run recovery metadata
- run history in job detail
- safer status messaging

## Added

- `app/api/cron/process-import-runs/route.ts`
  - secured by `CRON_SECRET`
  - batch-drains runnable async runs
- `organization_import_job_runs` lease/retry columns via migration
- runner enhancements in `lib/migration-imports/async-runner.ts`:
  - lease claim before chunk work
  - transient error retries with `next_retry_at`
  - terminal recovery metadata in `recovery_json`
  - run history query helper
- job detail API now returns `runHistory`
- job detail page now shows run history table

## Safety

- Existing sync commit path is unchanged.
- Existing row outcomes and export CSV behavior are unchanged.
- Existing organization scoping and RLS policy patterns are preserved.
- QuickBooks skip-sync semantics remain unchanged for historical invoice commits.

## Remaining TODOs

- add per-run manual "resume from failed run" action
- worker heartbeat anomaly alerts (stuck leases, stale queued retries)
- configurable retry classes by error code source
- optional chunk checksum diagnostics
