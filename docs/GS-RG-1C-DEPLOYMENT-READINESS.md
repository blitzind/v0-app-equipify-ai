# GS-RG-1C Deployment Readiness Report

**Phase:** Final Production Readiness Patch  
**Date:** 2026-06-19  
**Status:** Local certification complete — ready for bundled deploy (migrations not yet applied)

---

## Blockers Resolved

| Blocker (GS-RG-1B) | GS-RG-1C Resolution |
|--------------------|---------------------|
| Retention backlog metrics | `getRetentionBacklogSnapshot()` — pending rows, batches, last run/duration |
| Reads/writes/failures metrics | `runtime_health_counters` singleton + dashboard estimates |
| Missing-table handling | `probeRuntimeGuardrailSchema()` — READY/WARN/MISSING, no 500 |
| Per-user search budgets | `runtime_user_budgets` + org AND user evaluation |
| Retention cron scheduling | `vercel.json` daily `0 4 * * *` |
| Observability certification | Updated cert scripts + `test:growth-runtime-production-readiness` |

---

## New Migration

`20270901130000_growth_runtime_guardrails_gs_rg_1c.sql`

- `growth.runtime_user_budgets`
- `growth.runtime_health_counters`
- `runtime_retention_batch_state.last_duration_ms`

Apply **after** GS-RG-1 migration in bundled deploy.

---

## Updated Cost Projections (GS-RG-1C)

| Org size | Reads/day (before) | Reads/day (after) | Metadata writes/day |
|----------|-------------------|-------------------|---------------------|
| 1k leads | ~20.2M | ~2.0M | +~500 (budgets/audit) |
| 10k leads | ~202M | ~20.3M | +~5k |
| 100k leads | ~2.02B | ~203M | +~50k |

Retention worker (5 families, daily): max 5,000 deletes/day at current batch config. At 1M stale rows/family, ~1,000 batches/family over multiple days (not single run).

---

## Tests Executed

All passed locally:

```bash
pnpm test:growth-runtime-guardrails
pnpm test:growth-runtime-observability
pnpm test:growth-runtime-search-cert
pnpm test:growth-runtime-wake-cert
pnpm test:growth-runtime-media-cert
pnpm test:growth-runtime-retention-cert
pnpm test:growth-runtime-production-readiness
```

---

## Deployment Readiness Checklist

| Area | Verdict |
|------|---------|
| Migration readiness | **PASS** |
| Runtime readiness | **PASS** |
| Rollback readiness | **PASS** |
| Supabase resource readiness | **PASS** |
| Production certification readiness | **PASS** (local; post-deploy smoke pending) |

---

## Remaining Risks (Post-Deploy Only)

1. Migrations must be applied in order (GS-RG-1 → GS-RG-1C) before code deploy
2. Post-deploy smoke: `pnpm test:growth-runtime-observability:production`
3. Audit tables grow unbounded — schedule GS-RG-2 audit retention
4. `video_page_rollups` still lacks FK to `video_pages` (WARN from GS-RG-1B)
5. Multi-tenant org resolution for non-platform search still uses `GROWTH_ENGINE_AI_ORG_ID`

---

## Final Verdict

```
READY_FOR_BUNDLED_DEPLOY
```

**Bundled deploy sequence:**
1. Apply `20270901120000_growth_runtime_guardrails_gs_rg_1.sql`
2. Apply `20270901130000_growth_runtime_guardrails_gs_rg_1c.sql`
3. Deploy application + `vercel.json` cron
4. Run post-deploy certification smoke
5. Verify `/growth/admin/runtime` shows status READY

---

## GS-RG-2 Readiness

Growth Engine is safe to proceed with **GS-RG-2 — Dynamic Audiences Foundation** after bundled deploy, without recreating prior Supabase scaling issues. Guardrails now enforce:

1. Max reads per execution (bounded batch/cursor)
2. Max writes per execution (budget counters)
3. Max fan-out (cascade budget)
4. Daily/hourly budgets (org + user)
5. Kill switches (immediate disable)

Dynamic Audiences must plug into `consumeBudget` / `consumeUserBudget` and answer the same five questions before shipping.
