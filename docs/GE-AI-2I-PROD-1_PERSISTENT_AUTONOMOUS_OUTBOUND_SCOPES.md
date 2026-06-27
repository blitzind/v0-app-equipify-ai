# GE-AI-2I-PROD-1 — Persistent Autonomous Outbound Scopes

**Phase:** GE-AI-2I-PROD-1  
**Status:** Complete locally (not committed)  
**Layer:** Persistence + activation hardening (no new autonomy permissions)  
**QA marker:** `growth-ge-ai-2i-bounded-autonomous-outbound-v1`  
**Migration:** `20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql`

---

## Objective

Replace GE-AI-2I in-memory scope store with organization-scoped, audited PostgreSQL persistence so approved scopes survive server restarts, Vercel cold starts, multi-instance execution, and operator handoffs — without enabling scheduler activation or increasing autonomy permissions.

---

## Persistence audit

| Existing Persistence Pattern | Table/File | Pros | Cons | Reuse Strategy |
| ---------------------------- | ---------- | ---- | ---- | -------------- |
| AI Work Order repository | `growth.ai_work_orders`, `growth.ai_work_order_events` | Org-scoped, service-role RLS, row mappers, schema health probe | Work-order lifecycle not scope-shaped | **Pattern reuse** — repository + schema health |
| Sequence job persistence | `growth.sequence_execution_jobs` | Transport authority, approval metadata | Per-job not scope envelope | **Delegate** transport only; scope references job id |
| AI OS event tables (2B) | `growth.ai_os_events` | Cross-subscriber lifecycle, correlation ids | Not scope budget ledger | **Parallel audit** — publish bus events + append scope events |
| Automation approval persistence | GeV1.5 approval tables | Human approval source of truth | Separate from outbound scope | **Read-only** — scope `source` links to approval id |
| Growth Autonomy audit | Policy engine service | Single policy plane | No scope storage | **Gate** activation + execution |
| AI decision records | `growth.ai_decision_records` | Approval provenance | Not outbound action ledger | Optional future `source_id` linkage |
| Autonomous pilot stores (in-memory) | Various pilot maps | Fast local dev | Lost on cold start | **Replace** for outbound scopes |
| Human Approval Center (2H) | Read model collectors | Unified operator inbox | Read-only | **Extend** — reads persistent scope read model |

---

## Data model

### `growth.autonomous_outbound_scopes`

Human-approved execution envelope: source, audience, limits, stop conditions, channel allow-list, approval metadata, lifecycle timestamps.

### `growth.autonomous_outbound_scope_actions`

Idempotent action ledger keyed by `(organization_id, idempotency_key)`. Tracks selected → blocked/queued/completed/failed with transport reference.

### `growth.autonomous_outbound_scope_events`

Append-only scope lifecycle audit complementing GE-AI-2B event bus.

**RLS:** service_role only (matches AI Work Order pattern).

---

## Repository API

File: `lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository.ts`

| Operation | Function |
| --------- | -------- |
| Create draft scope | `insertAutonomousOutboundScope` |
| Upsert scope | `upsertAutonomousOutboundScopeRecord` |
| Mark approved / activate / pause / complete | `updateAutonomousOutboundScope` |
| Record action (idempotent) | `insertAutonomousOutboundScopeAction` |
| Fetch by org / source / idempotency | `listAutonomousOutboundScopesForOrganization`, `fetchAutonomousOutboundScopeBySource`, `fetchAutonomousOutboundActionByIdempotencyKey` |
| Audit event | `appendAutonomousOutboundScopeEvent` |
| Summarize | `summarizeAutonomousOutboundScopes` |

Schema health: `lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health.ts`

---

## Activation workflow

File: `lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts`

`activateAutonomousOutboundScopeWithValidation` verifies before activation:

1. Scope exists and status is `approved`
2. Human approval metadata (`approvedByUserId`, `approvedAt`)
3. Not expired
4. Audience configured
5. Limits positive
6. Channel allow-list non-empty
7. Growth Autonomy outbound capability enabled (no emergency stop)

Low-level `activateAutonomousOutboundScope` in orchestrator persists status transition only after validation passes.

**Not allowed:** anonymous activation, activation without approval, scheduler/cron activation, Core mutations.

---

## Idempotency model

Action idempotency key: `{scopeId}:{leadId}:{actionType}:{sequenceJobId|none}`

Unique partial index on `growth.autonomous_outbound_scope_actions (organization_id, idempotency_key)`.

Duplicate inserts return existing action row — budgets survive restarts and retries.

---

## Orchestrator wiring

`growth-bounded-autonomous-outbound-orchestrator.ts` now:

- Persists scopes/actions/events via repository (not in-memory store)
- Publishes GE-AI-2B lifecycle events
- Uses idempotency keys on every execution attempt
- Does **not** register cron/scheduler activation

In-memory store (`growth-autonomous-outbound-scope-store.ts`) retained for unit test doubles only.

---

## UI / API

- **AI Operations** and **Human Approval Center** read persistent scopes via `fetchBoundedAutonomousOutboundReadModel`
- GET-only API unchanged: `app/api/platform/growth/ai-os/bounded-autonomous-outbound/route.ts`
- No new ungated “start autonomy” mutation routes

---

## Files changed

| File | Change |
| ---- | ------ |
| `supabase/migrations/20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql` | New tables + RLS |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository.ts` | Persistent repository |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health.ts` | Schema probe |
| `lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts` | Safe activation |
| `lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts` | Repository wiring |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts` | Persistent read model |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts` | PROD-1 constants |
| `lib/growth/aios/outbound/growth-autonomous-outbound-scope-store.ts` | Test doubles only |
| `scripts/test-ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes.ts` | Certification |
| `package.json` | Cert script |

---

## Tests run

```bash
pnpm test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes
pnpm test:ge-ai-2i-bounded-autonomous-outbound
pnpm test:ge-ai-2b-event-bus-completion
pnpm test:ge-ai-2h-human-approval-center
pnpm test:ge-ai-2e-priority-engine-binding
pnpm test:ge-ai-2f-meta-recommender
pnpm test:prod-regression-6-command-center-import-stability
```

---

## Production readiness

**Partially production-ready.** Persistence layer, activation validation, and idempotency are implemented and certified locally. Autonomous outbound is **not** ready for scale rollout until:

1. Migration applied to production Supabase
2. Integration test against live schema (row round-trip + orchestrator E2E)
3. GeV1.5 / sequence approval harmonization review
4. Reply-intelligence auto stop-condition wiring
5. Operator activation UI with explicit approval linkage

---

## Remaining risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Dual approval (scope + sequence job) | Medium | Document operator workflow; future harmonization phase |
| Schema not yet on production DB | High | Apply migration before deploy |
| Stop conditions require manual trigger today | Medium | GE-AI-2J+ reply intelligence integration |
| No cron guard in platform middleware | Low | Orchestrator has no scheduler; enforce in ops runbook |

---

## Next recommended phase

**GE-AI-2I-PROD-2** — Production integration certification: live DB round-trip, bounded manual execution smoke test, sequence approval alignment audit, and operator activation surface (fully gated).
