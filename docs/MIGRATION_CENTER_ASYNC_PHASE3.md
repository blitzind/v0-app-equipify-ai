# Migration Center - Async Phase 3

## Scope

Additive resiliency and operator controls for async imports:

- resume failed runs using recovery cursor metadata
- stale lease detection and cleanup
- expanded diagnostics and stuck visibility
- cron observability counters

## Added behavior

- `POST /api/organizations/[organizationId]/migration-imports/[jobId]/async`
  - supports `action: "resume"` to resume the latest failed run.
- Resume path reuses persisted `recovery_json` + `resume_cursor`; no sync path changes.
- Cron endpoint now:
  - recovers stale leases before processing
  - returns counters: processed / skipped / retried / failed / lease-skipped
- Run mapping includes:
  - `recovery` JSON diagnostics
  - `isLikelyStuck`
  - `staleLeaseRecoveredAt`
- Job detail UI now includes:
  - stuck run warning
  - resume failed run button
  - expandable per-run diagnostics (retry + recovery + errors)

## Safety

- Existing sync commit flow remains unchanged.
- Existing row outcome tracking and outcome CSV exports remain unchanged.
- Existing projection/duplicate handling is unchanged.
- Existing organization scope and RLS assumptions are preserved.

## TODOs

- optional run-level manual "skip failing row and continue" control
- heartbeat/lease alerting into platform-admin AI operations style alerts
- retry class tuning per DB/storage error family
