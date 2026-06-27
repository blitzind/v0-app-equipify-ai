# GE-AI-3D-PROD-1 — Durable Closed-Loop Learning Store

**Phase:** GE-AI-3D-PROD-1  
**Status:** Complete locally — not committed, not deployed  
**QA marker:** `growth-ge-ai-3d-prod-1-durable-closed-loop-learning-v1`

## Objective

Replace the GE-AI-3D in-memory learning store with a durable, organization-scoped, idempotent persistence layer — still **advisory-only**.

## Persistence Audit

| Existing Pattern | Table/File | Strength | Limitation | Reuse Strategy |
| ---------------- | ---------- | -------- | ---------- | -------------- |
| Revenue Director ledger | `growth.revenue_director_*` | Idempotent upsert, append events, service_role RLS | Decision-specific | **Template** for outcomes/insights/events |
| Autonomous outbound scopes | `growth.autonomous_outbound_*` | Org-scoped, audited | Outbound-specific | Mirror RLS + idempotency index pattern |
| AI OS events | `growth.ai_os_events` | Canonical bus persistence | Not normalized for learning | Future replay source |
| Attribution touches | `growth.attribution_touches` | Cross-channel spine | Not on Event Bus | Batch replay (deferred) |
| Performance snapshots | `growth.*_performance_snapshots` | Rollups | Not outcome-level | Feature store input (deferred) |
| Schema health probes | `growth-postgrest-table-probe` | Graceful degradation | — | **Reuse** for learning tables |
| In-memory 3D store | `growth-closed-loop-learning-service.ts` | Fast cert | Not durable | Test doubles via `GROWTH_LEARNING_IN_MEMORY_STORE=1` |

## Migration Summary

**File:** `20271001230000_growth_ai_3d_prod_1_closed_loop_learning_store.sql`

| Table | Purpose |
| ----- | ------- |
| `growth.closed_loop_learning_outcomes` | Normalized outcomes — unique `(organization_id, idempotency_key)` |
| `growth.closed_loop_learning_insights` | Advisory insights — unique `(organization_id, idempotency_key)` |
| `growth.closed_loop_learning_events` | Append-only audit trail |

RLS: **service_role only** (matches GE-AI-3B / GE-AI-2I-PROD-1).

## Repository API

- `upsertClosedLoopLearningOutcome` — idempotent by org + idempotency key
- `upsertClosedLoopLearningInsight` — idempotent by org + idempotency key + daily window
- `appendClosedLoopLearningEvent` — append-only audit
- `listRecentClosedLoopLearningOutcomes` / `listCurrentClosedLoopLearningInsights`
- `summarizeClosedLoopLearningByOrganization`

## Idempotency Model

| Entity | Key format |
| ------ | ---------- |
| Outcome | `learning-outcome:{organizationId}:{eventId}` |
| Insight | `learning-insight:{organizationId}:{insightType}:{YYYY-MM-DD}` |

Replayed Event Bus events do not duplicate outcomes. Regenerated insights for the same window do not duplicate insight rows.

## Replay Readiness (Documented, Not Implemented)

Future batch replay sources:

1. `growth.ai_os_events` — canonical bus history
2. `growth.autonomous_outbound_scope_events` — action outcomes
3. `growth.revenue_director_decision_events` — dispatch lifecycle
4. `growth.attribution_touches` — email/SMS/meeting/reply spine
5. `growth.message_events` — campaign engagement
6. SENDR/video analytics tables — view/click outcomes

Requirements: service_role batch job, idempotency keys preserved, no automatic policy mutation.

## Read-Only Boundaries

Unchanged from GE-AI-3D — no score/ICP/channel/autonomy mutation, no transport, no Core writes.

## Files Changed

See implementation under `lib/growth/aios/learning/` + migration + command center + UI.

## Tests Run

```bash
pnpm test:ge-ai-3d-prod-1-durable-closed-loop-learning-store
pnpm test:ge-ai-3d-closed-loop-learning-foundation
```

## Remaining Risks

- Migration not applied in production until deploy pipeline runs
- Insight evidence stored as JSON snapshot — not live-linked to outcome rows after supersede
- Batch replay job not implemented
- Process restart no longer loses data once migration applied

## Controlled Adaptive Calibration

**Largely unblocked.** Durable outcomes and insights enable operator-reviewed calibration in a follow-on phase. Automatic weight changes remain out of scope.
