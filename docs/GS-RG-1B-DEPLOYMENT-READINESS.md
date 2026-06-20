# GS-RG-1B Deployment Readiness Report

**Phase:** Production Guardrail Certification Prep  
**Date:** 2026-06-19  
**Migration:** `20270901120000_growth_runtime_guardrails_gs_rg_1.sql`  
**Status:** Local certification complete — migration not applied, not deployed

---

## Phase 1 — Migration Verification

**Ordering:** Timestamp `20270901120000` follows `20270828150000` (video pages). Depends on `public.organizations`. Conditionally alters `growth.media_asset_event_rollups` if present. No forward migration conflicts detected.

| Table | Indexes | Constraints | FKs | Defaults | RLS | Verdict |
|-------|---------|-------------|-----|----------|-----|---------|
| `runtime_budgets` | PASS `(org, resource, window_start)` | PASS unique + checks | PASS → organizations CASCADE | PASS qa_marker, count=0 | PASS service_role only | **PASS** |
| `runtime_guardrail_settings` | PASS (PK on key) | PASS | — | PASS 5 kill switches seeded | PASS | **PASS** |
| `runtime_wake_batch_state` | PASS (PK) | PASS processed/remaining ≥ 0 | — | PASS 2 processor rows | PASS | **PASS** |
| `growth_event_retention_config` | PASS (PK) | PASS retention_days > 0 | — | PASS 90d × 5 families | PASS | **PASS** |
| `video_page_rollups` | PASS org index | PASS counter checks | PASS → organizations CASCADE | PASS zeros | PASS | **WARN** — no FK to `video_pages` |
| `runtime_cascade_budgets` | PASS org+created | PASS side-effect ≥ 0 | PASS → organizations SET NULL | PASS | PASS | **PASS** |
| `runtime_search_audit_log` | PASS org+created | PASS operation enum | PASS → organizations SET NULL | PASS | PASS | **WARN** — unbounded growth, no user_id index |
| `runtime_guardrail_audit_log` | PASS org+created | PASS severity enum | PASS → organizations SET NULL | PASS | PASS | **WARN** — unbounded growth |
| `runtime_retention_batch_state` | PASS (PK) | PASS deleted_count ≥ 0 | — | PASS seeded from config | PASS | **PASS** |

**Column extension:** `media_asset_event_rollups.total_watch_seconds`, `watch_session_count` — **PASS** (conditional, idempotent `IF NOT EXISTS`)

**Migration-level WARNs:**
- No `set_updated_at` triggers on mutable tables (consistent with many growth tables)
- `resource_type` on `runtime_budgets` is free-text (no DB enum)
- Audit tables have no retention/TTL policy yet

---

## Phase 2 — Rollback Documentation

**Deliverable:** [`docs/GS-RG-1-ROLLBACK-GUIDE.md`](./GS-RG-1-ROLLBACK-GUIDE.md)

Covers kill-switch-first rollback, disposable vs preserved data, column rollback, ordered schema drop, and recovery paths.

---

## Phase 3 — Runtime Observability Certification

**Route:** `GET /api/platform/growth/runtime/observability`

| Requirement | Status |
|-------------|--------|
| Budgets: searches, enrichments, wake, media, enrollments, automation | **PASS** (config + service) |
| Queues: wake backlog | **WARN** — uses batch `remainingCount`, not live wait count |
| Queues: retention backlog | **FAIL** — not surfaced |
| Queues: rollup backlog | **WARN** — flag only (`rollupRebuildAvailable: true`) |
| Health: kill switches | **PASS** |
| Health: throttles | **PASS** (limit 25) |
| Health: reads/writes/failures | **FAIL** — not implemented |
| Unbounded queries | **PASS** — throttles limited; budgets N+1 bounded (~18 queries) |
| Missing table graceful handling | **FAIL** — throws on missing schema |
| Read-only | **PASS** |

**Cert script:** `pnpm test:growth-runtime-observability` — passed locally

---

## Phase 4 — Search Guardrail Certification

| Scenario | Result |
|----------|--------|
| Normal traffic | **PASS** — 200 |
| Near limit | **PASS** — 200 |
| Over limit | **PASS** — 429 |
| Reset window | **PASS** — hourly roll resets count |
| Audit logging | **PASS** — query, rows, duration_ms |
| Per-org budgets | **PASS** — via `GROWTH_ENGINE_AI_ORG_ID` |
| Per-user budgets | **FAIL** — not implemented |

**Cert script:** `pnpm test:growth-runtime-search-cert` — passed locally

---

## Phase 5 — Wake Engine Certification

| Load | Evals/run | Runs to drain | Reads/run | Writes/run |
|------|-----------|---------------|-----------|------------|
| 100 | 50 | 2 | ~152 | ~151 |
| 500 | 50 | 10 | ~152 | ~151 |
| 1,000 | 50 | 20 | ~152 | ~151 |
| 10,000 | 50 | 200 | ~152 | ~151 |

**Before:** unbounded wait load per event/cron  
**After:** capped at 50 evals/run, cursor resume, kill switch

**Cert script:** `pnpm test:growth-runtime-wake-cert` — passed locally

---

## Phase 6 — Media Rollup Certification

| Events | Before reads | After reads | Reduction |
|--------|--------------|-------------|-----------|
| 100 | 200,100 | 20,300 | 89.9% |
| 1,000 | 2,001,000 | 203,000 | 89.9% |
| 10,000 | 20,010,000 | 2,030,000 | 89.9% |

Ingest path confirmed: `incrementMediaAssetEventRollup` — no `recomputeMediaAssetEventRollup` on hot path.  
Admin rebuild: 500 assets/request bounded.

**Cert script:** `pnpm test:growth-runtime-media-cert` — passed locally

---

## Phase 7 — Retention Certification

| Requirement | Status |
|-------------|--------|
| 90-day default | **PASS** |
| Batch size 1000 | **PASS** |
| Cursor persistence | **PASS** |
| Resumable (hasMore) | **PASS** |
| Never delete rollups | **PASS** (static verification) |
| Cron route | **PASS** (code exists) |
| Cron scheduled | **FAIL** — not in vercel.json |
| Dry-run plan | **PASS** — documented in cert script |

**Cert script:** `pnpm test:growth-runtime-retention-cert` — passed locally

---

## Phase 8 — Supabase Cost Projection

Assumptions: 10 media events/lead/day, 1 search/10 leads/day, 0.1 wake evals/lead/day, 365-day event retention without GS-RG-1 vs 90-day with.

### Daily reads (approximate)

| Org size | Before GS-RG-1 | After GS-RG-1 | Δ |
|----------|----------------|---------------|---|
| 1k leads | ~20.2M (media full scan) | ~2.0M | **−90%** |
| 10k leads | ~202M | ~20.3M | **−90%** |
| 100k leads | ~2.02B | ~203M | **−90%** |

Wake reads: unbounded → ~152/cron run (bounded).

### Daily writes

| Org size | Before | After | Δ |
|----------|--------|-------|---|
| 1k leads | ~20k media + unbounded wake | ~30k media + budget/audit rows | Slightly higher metadata writes, far fewer read amplification |
| 10k leads | ~200k | ~300k + audit | Acceptable tradeoff |
| 100k leads | ~2M | ~3M + audit | Guardrails prevent read explosion |

### Storage growth

| Component | Before | After |
|-----------|--------|-------|
| Raw events | Unbounded (no retention) | Capped ~90d × ingest rate |
| Rollups | Flat per asset/page | Flat (preserved) |
| Audit tables | None | ~500 bytes/search × searches/hour |

**Conclusion:** GS-RG-1 materially reduces read amplification (~90% on media ingest). Write volume increases slightly for budget/audit metadata — acceptable vs unbounded reads.

---

## Phase 9 — Production Smoke Harness

| Script | Status |
|--------|--------|
| `pnpm test:growth-runtime-observability` | Created, passed |
| `pnpm test:growth-runtime-observability:production` | Created (probes deployed route) |
| `pnpm test:growth-runtime-search-cert` | Created, passed |
| `pnpm test:growth-runtime-wake-cert` | Created, passed |
| `pnpm test:growth-runtime-media-cert` | Created, passed |
| `pnpm test:growth-runtime-retention-cert` | Created, passed |

**Post-deploy smoke sequence:**
1. Apply migration on production Supabase
2. Deploy application bundle
3. `pnpm test:growth-runtime-guardrails` (regression)
4. `pnpm test:growth-runtime-observability:production`
5. Manual: trigger search until 429, verify audit row
6. Manual: POST retention cron with secret, verify batch state
7. Manual: visit `/growth/admin/runtime`, confirm kill switches visible

---

## Phase 10 — Deployment Readiness Checklist

| Area | Verdict | Blockers |
|------|---------|----------|
| Migration readiness | **PASS** | Minor WARNs only; safe to apply |
| Runtime readiness | **WARN** | Per-user search budgets missing; observability gaps |
| Rollback readiness | **PASS** | Guide + kill switches documented |
| Supabase resource readiness | **PASS** | 90% read reduction demonstrated |
| Production certification readiness | **WARN** | Migration not applied; cron not scheduled; production route not deployed |

---

## Remaining Risks Before Bundled Deploy

1. **Per-user search budgets** — org-only today
2. **Observability incomplete** — no reads/writes/failures; retention backlog missing
3. **Missing table graceful degradation** — observability throws if migration not applied
4. **`video_page_rollups` orphan FK** — no reference to `video_pages`
5. **Audit table growth** — search/guardrail logs unbounded
6. **Retention cron** — not in `vercel.json`
7. **Multi-tenant org resolution** — search budgets use platform AI org only

---

## Final Recommendation

```
NOT_READY_FOR_BUNDLED_DEPLOY
```

**Rationale:** Local certification, rollback documentation, and smoke scripts are complete. Core guardrails materially reduce amplification and migration is structurally sound. However, production certification cannot execute until migration is applied and code is deployed, and three certification gaps block full readiness: per-user search budgets, incomplete observability (retention backlog + health metrics), and retention cron scheduling.

**Path to READY:**
1. Apply migration to production Supabase (manual, approved)
2. Bundle deploy application code
3. Add `/api/cron/growth-event-retention` to `vercel.json`
4. Run post-deploy smoke sequence
5. Address WARN items in GS-RG-2 or pre-deploy patch (observability wiring, optional per-user budgets)

**If deploying with known gaps:** Kill switches provide immediate rollback. Media and wake guardrails are the highest-value, lowest-risk components and can ship first with observability gaps documented.
