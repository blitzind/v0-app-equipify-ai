# GE-AIOS-AUTONOMY-1B — Canonical Wake Wiring

**Phase:** GE-AIOS-AUTONOMY-1B  
**Depends on:** GE-AIOS-AUTONOMY-1A audit

---

## Purpose

Eliminate autonomous dead ends by wiring existing completion events into Draft Factory through the **existing AI OS Event Bus**, and advancing due/capacity work on the **existing Objective Runtime Scheduler** tick.

No new event bus. No new scheduler framework. No new retry/orchestration engine.

---

## Existing runtime reused

| Runtime | Role |
|---------|------|
| AI OS Event Bus (`publishAiOsEvent` / `publishGrowthAiEvent`) | Durable completion transport + in-process handlers |
| Draft Factory durable (`wakeDraftFactoryFromCompletionEvent`, `listDueDraftFactoryStates`, `advanceDraftFactoryCapacityWake`) | Pipeline SoR, leases, idempotent wake receipts, one-stage advance |
| Objective Runtime Scheduler | Canonical autonomy cron tick (hosts DF due/capacity sub-tick) |
| Wake guardrails (`planWakeEvaluationBatch`) | Per-run caps |
| Kill switches (`autonomy_enabled`) | Gate DF bus observation + due tick |
| Sequence wake patterns | Dispatcher shape inspiration only (not duplicated) |

---

## New subscriber

| ID | Module |
|----|--------|
| `draft_factory_wake_observer` | `lib/growth/draft-factory/draft-factory-wake-bus-observer.ts` |

Registered in `GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS` and invoked from `growth-ai-event-bus-subscriber-registry.ts` (same pattern as closed-loop learning / RD correlation).

---

## New emitters (thin publish helpers)

| Emitter | Site |
|---------|------|
| Company Intelligence complete | `company-intelligence-queue.ts` |
| DataMoon complete/fail | `datamoon-dm-service.ts` |
| Contact verified | `company-contact-repository.ts` |
| Personalization complete | `personalization/dashboard.ts` |
| Mission change | `growth-objective-service.ts` (pause/resume) |
| Company profile change | `business-profile-service.ts` (approve) |
| Budget reset | `growth-runtime-budget-service.ts` |
| Research stale | `growth-lead-research-execution-service.ts` (`stale_refresh`) |
| Research complete | Existing `growth.workflow.status_changed` (no parallel wake) |
| Approval | Existing `growth.execution_plan.review_changed`, `growth.ava.outreach_package_approval`, `decision.gate_*` |

---

## Scheduler changes

`runGrowthObjectiveRuntimeScheduler` now also calls `tickDraftFactoryDueStatesForScheduler`:

1. `listDueDraftFactoryStates` → `advanceDraftFactoryForLeadLive` with `scheduled_resume`
2. Deferred states → `advanceDraftFactoryCapacityWake`

**No new Vercel cron.** Kill-switch gated by `autonomy_enabled`.

---

## Runtime flow

```text
Completion producers
        │
        ▼
publishGrowthAiEvent / publishAiOsEvent  (+ ensureGrowthAiEventBusInProcessSubscribers)
        │
        ▼
AI OS Event Bus handlers
        │
        ├── existing observers (RD, learning, HAC, …)
        └── draft_factory_wake_observer
                │
                ▼
        mapAiOsEventToDraftFactoryWakePlans
                │
                ▼
        wakeDraftFactoryFromCompletionEvent  (exactly one stage)
                │
                ▼
        Draft Factory durable receipts / leases / backoff

Objective Runtime Scheduler (existing cron)
        │
        ├── autonomous sales loop (18A)
        └── tickDraftFactoryDueStatesForScheduler (1B)
                ├── listDueDraftFactoryStates
                └── advanceDraftFactoryCapacityWake
```

---

## Certification

```bash
pnpm test:ge-aios-autonomy-1b-canonical-wake-wiring
pnpm test:sv1-5a-production-durable-draft-factory
pnpm test:ge-ai-2b-event-bus-completion
```

---

## Remaining autonomous dead ends

| Gap | Notes |
|-----|-------|
| Org-scoped mission/profile without lead ids | Emits org capacity sweep; per-lead fan-out needs mission priority binding |
| Proactive stale research scanner | Emits only on `stale_refresh` path — no dedicated cron to detect all stale leads |
| Reply / sequence-complete → DF | Still sequence-plane only (by design in 1B) |
| Agent pilot cycles (5B–5G) | Still dormant (`schedulerActive: false`) |
| Server transactional outbox | Still fire-and-forget publish; DF receipts provide idempotency |
| Multi-tenant org resolution for CI/contact/personalization | Uses `getGrowthEngineAiOrgId()` where lead rows lack org column |
