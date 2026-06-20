# GS-RG-1 Rollback Guide

Infrastructure-only rollback reference for `20270901120000_growth_runtime_guardrails_gs_rg_1.sql`.

**Use when:** deployment fails, guardrails cause unexpected throttling, or observability tables cannot be reached.

**Do not use when:** GS-RG-1 code is deployed and actively protecting production — prefer kill switches first.

---

## Immediate rollback (no migration revert)

Disable runtime paths via existing kill switches in `growth.runtime_guardrail_settings`:

| Key | Effect when `enabled = false` |
|-----|-------------------------------|
| `wake_execution_enabled` | Stops sequence wake evaluation and timeout processing |
| `media_rollup_enabled` | Skips incremental rollup writes on ingest |
| `search_execution_enabled` | Returns 429-equivalent block on prospect search |
| `retention_worker_enabled` | Stops raw event deletion |
| `cascade_budget_enforcement_enabled` | Stops cascade fan-out enforcement (audit only) |

```sql
-- Emergency: disable all GS-RG-1 runtime enforcement
update growth.runtime_guardrail_settings
set enabled = false, updated_at = now()
where key in (
  'wake_execution_enabled',
  'media_rollup_enabled',
  'search_execution_enabled',
  'retention_worker_enabled',
  'cascade_budget_enforcement_enabled'
);
```

Revert application code to pre-GS-RG-1 deploy. Kill switches remain but unused if code paths are removed.

---

## Migration rollback (schema revert)

### Safe to drop (disposable data)

All GS-RG-1 tables contain **operational telemetry only**. No customer-facing content. Safe to drop if rollback is required before production traffic depends on them.

| Table | Disposable? | Notes |
|-------|-------------|-------|
| `growth.runtime_budgets` | Yes | Budget counters reset on redeploy |
| `growth.runtime_guardrail_settings` | Yes | Re-seeded by migration |
| `growth.runtime_wake_batch_state` | Yes | Cursors re-seeded; wake backlog re-processes |
| `growth.growth_event_retention_config` | Yes | Re-seeded with 90d defaults |
| `growth.runtime_cascade_budgets` | Yes | Per-event audit only |
| `growth.runtime_search_audit_log` | Yes | Search audit trail |
| `growth.runtime_guardrail_audit_log` | Yes | Throttle/warning audit |
| `growth.runtime_retention_batch_state` | Yes | Retention cursors |

### Conditional drop

| Object | Disposable? | Notes |
|--------|-------------|-------|
| `growth.video_page_rollups` | **Partial** | Rollup aggregates; rebuild from `video_page_events` if needed |
| `growth.media_asset_event_rollups.total_watch_seconds` | **Partial** | Column additive; can drop columns without losing core rollups |
| `growth.media_asset_event_rollups.watch_session_count` | **Partial** | Same as above |

### Must preserve

| Object | Why |
|--------|-----|
| `growth.media_asset_event_rollups` (core columns) | Existing S2-D analytics; do not drop table |
| `growth.media_asset_events` | Raw events; retention may have deleted old rows only |
| `growth.video_page_events` | Raw events |
| `growth.share_page_events` | Raw events |
| `growth.sequence_enrollment_step_waits` | Sequence runtime; not GS-RG-1 owned |
| All rollup/analytics snapshot tables listed in `GROWTH_RETENTION_PROTECTED_TABLES` | Never delete |

---

## Column rollback

If only incremental media columns cause issues:

```sql
alter table growth.media_asset_event_rollups
  drop column if exists total_watch_seconds,
  drop column if exists watch_session_count;
```

Ingest falls back to pre-column behavior if application code is reverted. Existing rollup counters (`views`, `unique_views`, etc.) are unchanged.

---

## Full schema drop (ordered)

Run only after application code revert and kill-switch disable:

```sql
drop table if exists growth.runtime_retention_batch_state;
drop table if exists growth.runtime_guardrail_audit_log;
drop table if exists growth.runtime_search_audit_log;
drop table if exists growth.runtime_cascade_budgets;
drop table if exists growth.video_page_rollups;
drop table if exists growth.growth_event_retention_config;
drop table if exists growth.runtime_wake_batch_state;
drop table if exists growth.runtime_guardrail_settings;
drop table if exists growth.runtime_budgets;

alter table growth.media_asset_event_rollups
  drop column if exists total_watch_seconds,
  drop column if exists watch_session_count;
```

---

## Data recovery

| Data | Recovery path |
|------|-----------------|
| Media asset rollups | `POST /api/platform/growth/runtime/media-rollups/rebuild` (500 rows/batch) |
| Video page rollups | Rebuild job not yet implemented — recompute from `video_page_events` or replay ingest |
| Budget counters | Auto-reset on new window boundaries |
| Wake cursors | Reset to null; cron re-processes from start |
| Retention deleted events | **Not recoverable** — raw events only |

---

## Rollback decision tree

1. **Throttling too aggressive** → adjust caps in `growth-runtime-guardrail-config.ts` + redeploy, or disable specific kill switch
2. **Rollup incorrect** → disable `media_rollup_enabled`, run admin rebuild
3. **Migration failed mid-apply** → drop partially created GS-RG-1 tables, fix migration, re-apply
4. **Full revert** → kill switches off → code revert → schema drop above

---

## Pre-rollback checklist

- [ ] Kill switches disabled
- [ ] Cron `/api/cron/growth-event-retention` removed from schedule (if added)
- [ ] Application deploy reverted
- [ ] Confirm no downstream features depend on `video_page_rollups`
- [ ] Document incident in guardrail audit log review
