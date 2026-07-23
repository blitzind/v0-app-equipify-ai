# FUZOR-ADOPTION-1K — Platform Event Bus Delegation

**Milestone ID:** FUZOR-ADOPTION-1K  
**Status:** Complete (local adoption)  
**Effective:** 2026-07-22  
**Platform prerequisite:** Certified for Multi-Tenant Platform Operation (Hardening 1A)  
**Scope:** Complete delegation of GE-AIOS-2B AI OS Event Bus into `@fuzor/event-bus`

---

## Executive summary

| Item | Result |
|------|--------|
| Event Bus authority | `@fuzor/event-bus` |
| Equipify role | Compatibility consumer (thin wrappers + product telemetry) |
| Import paths | Unchanged |
| Persistence | Equipify-owned schema; platform repository delegates |
| Production validation | **Not performed** — separate milestone |

**Constitutional split:** Platform answers *how do platform capabilities communicate?* Products answer *what should happen when an event occurs?*

**Lifecycle:** **Extracted** · **Adopted** · **Validated (local)** — not Production Validated

---

## Phase 1 — Event audit

### Delegated (GE-AIOS-2B stack)

| Equipify module | Classification |
|-----------------|----------------|
| `ai-event-types.ts` | Event contracts, categories, normalization |
| `ai-event-registry.ts` | Canonical event type catalog |
| `ai-event-repository.ts` | Append-only persistence, subscriptions, deliveries |
| `ai-event-service.ts` | Publish, subscribe, replay, archive |
| `ai-event-subscriber-registry.ts` | In-process handler registry |
| `ai-event-schema-health.ts` | Schema validation probe |

### Retained in Equipify

| Module | Reason |
|--------|--------|
| `ai-event-bridge.ts` | Legacy Growth event bridges (product) |
| `event-bus/growth-ai-event-bus-*` | Growth Engine workflow event orchestration |
| `growth-agent-event-service.ts` | Product agent event producers |
| Revenue director, communication engine, pilots | Business event consumers |
| Draft-factory wake observability telemetry | Product observability layer on publish |

### Dependency graph

```
@fuzor/identity (specialist agents)
        ↓
@fuzor/event-bus
  ├── types / registry
  ├── repository (growth.ai_os_events)
  ├── event-bus-service (publish / subscribe)
  ├── handler-registry (in-process dispatch)
  └── schema-health
        ↑ publishes              ↑ publishes
@fuzor/decision-records    @fuzor/memory
        ↑ read-only
@fuzor/context
        ↑
Equipify wrappers (stable AiOs* import paths)
        ↑
Equipify workflows (business producers/consumers)
```

---

## Phase 2 — Ownership

### Fuzor owns

- Event publishing and subscription management
- Event contracts, routing, metadata, versioning
- Delivery interfaces and in-process handler dispatch
- Tenant-scoped persistence and retrieval
- Schema health probes

### Equipify owns

- Workflow orchestration and business event producers/consumers
- Legacy event bridges (`ai-event-bridge.ts`)
- Growth AI Event Bus engine (`growth-ai-event-bus-*`)
- Product telemetry persistence on publish (`persistAiOsEventHandlerTelemetry`)
- Campaigns, approvals, Ava, DataMoon execution policy

---

## Phase 3 — Delegation

All `ai-event-*` infrastructure modules delegate to `@fuzor/event-bus` under preserved `AiOs*` / `AiEvent*` export names.

**Publish wrapper:** `publishAiOsEvent` and `publishAiOsEventCorrection` call `publishPlatformEvent` then persist Equipify-specific handler telemetry — product observability remains local.

**Package consumption:**

```json
"@fuzor/event-bus": "file:../../fuzor/packages/event-bus"
```

---

## Phase 4 — Tenant validation

- Explicit `organizationId` on all publish, query, and subscription calls
- Fail-closed: repository queries filter by `organization_id`
- Subscription matching scoped per organization
- No tenant inference or process-global defaults

---

## Phase 5 — Platform integration

| Capability | Event Bus role |
|------------|----------------|
| Decision Records | Publishes `decision.*` events via `@fuzor/event-bus` |
| Memory | Publishes `memory.*` events via registry service |
| Context | Read-only — consumes decisions/memory; publishes `context.*` at assembly |
| Knowledge | Independent — no event bus coupling required |

No ownership overlap: Event Bus transports events; platform services publish; products orchestrate reactions.

---

## Phase 6 — Behavioral parity

Parity test: `pnpm test:fuzor-adoption-1k-event-bus-parity`

- QA markers, categories, registry reference-equal to platform
- Repository/service/handler functions reference-equal (except publish wrappers with telemetry)
- Legacy error codes preserved (`ai_event_category_required`, `ai_event_not_found`, etc.)
- Handler dispatch includes discovered/skipped/run telemetry for observability

---

## Phase 7 — Compatibility

Stable import paths unchanged under `lib/growth/aios/ai-event-*`. Existing Equipify callers require no import churn.

---

## Phase 8 — Future architecture

```
Equipify / Ava        ──→ publishAiOsEvent(orgId, …)
Insideify / Ivy       ──→ publishAiOsEvent(orgId, …)
Future Product        ──→ publishAiOsEvent(orgId, …)
                              ↓
                    @fuzor/event-bus
                              ↓
              platform subscribers + product workflows
```

All products share identical event transport while retaining independent business workflow ownership.

---

## Phase 9 — Validation

| Check | Result |
|-------|--------|
| `@fuzor/event-bus` unit tests | PASS |
| `test:fuzor-adoption-1k-event-bus-parity` | PASS |
| `test:ge-aios-2b-ai-event-foundation` | PASS |
| `test:fuzor-adoption-1j-decision-records-parity` | PASS |
| `test:fuzor-adoption-1i-context-platform-parity` | PASS |
| `test:fuzor-adoption-1h-memory-platform-parity` | PASS |

---

## Lifecycle

| Stage | Status |
|-------|--------|
| Extracted | Complete |
| Adopted | Complete |
| Validated (local) | Complete |
| Production validated | Not started |
