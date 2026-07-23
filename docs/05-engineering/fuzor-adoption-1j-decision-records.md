# FUZOR-ADOPTION-1J — Decision Records Platform Delegation

**Milestone ID:** FUZOR-ADOPTION-1J  
**Status:** Complete (local adoption)  
**Effective:** 2026-07-22  
**Platform prerequisite:** Certified for Multi-Tenant Platform Operation (Hardening 1A)  
**Scope:** Delegate GE-AIOS-2D Decision Records into `@fuzor/decision-records`

---

## Executive summary

| Item | Result |
|------|--------|
| Decision Records authority | `@fuzor/decision-records` |
| Equipify role | Compatibility consumer (thin wrappers) |
| Import paths | Unchanged |
| Persistence | Equipify-owned schema; platform repository delegates |
| Context integration | Context reads decisions; does not own persistence |
| Production validation | **Not performed** — separate milestone |

**Constitutional split:** Platform answers *why did the AI make this decision?* Products answer *what should happen because of that decision?*

**Lifecycle:** **Extracted** · **Adopted** · **Validated (local)** — not Production Validated

---

## Phase 1 — Decision audit

### Delegated (GE-AIOS-2D stack)

| Equipify module | Classification |
|-----------------|----------------|
| `ai-decision-record-types.ts` | Decision contracts, normalization helpers |
| `ai-decision-record-registry.ts` | Canonical decision key catalog |
| `ai-decision-record-repository.ts` | Append-only persistence, retrieval |
| `ai-decision-record-service.ts` | Lifecycle orchestration, event publication |
| `ai-decision-record-schema-health.ts` | Schema validation probe |

### Retained in Equipify

| Module | Reason |
|--------|--------|
| `ai-decision-engine-service.ts` | Product decision orchestration |
| `ai-decision-intelligence-bridge-service.ts` | Product reasoning bridge |
| `ai-decision-gate-service.ts` | Operator/workflow gating |
| `lib/growth/decision-engine/*` | Growth Engine business decision engine |
| Work order execution, campaigns, Ava reasoning | Product workflows and policy |
| Database migrations and RLS | Product-owned schema surface |

### Dependency graph

```
@fuzor/identity (owner agents)
        ↓
@fuzor/decision-records
  ├── types / registry
  ├── repository (growth.ai_decision_records)
  ├── service (lifecycle + audit)
  ├── work-order-linkage (decision_record_ids)
  └── schema-health
        ↑ reads                    ↑ reads
@fuzor/context              Equipify wrappers
(read-only composition)     (stable Ai* import paths)
        ↑
Equipify workflows (when to record, business policy)
```

---

## Phase 2 — Ownership

### Fuzor owns

- Decision repository and append-only persistence
- Decision metadata, attribution, confidence, evidence references
- Audit history and lifecycle events
- Retrieval, search filters, schema catalog
- Tenant-scoped queries (`organization_id` required)
- Event publication via `@fuzor/event-bus`

### Equipify owns

- Business decisions and when to invoke recording
- Workflows, prompts, campaigns, autonomous execution
- Operator approvals and execution sequencing
- Domain-specific reasoning (Ava, Growth Engine)
- Database migrations and RLS policies

---

## Phase 3 — Delegation

All `ai-decision-record-*` modules are thin wrappers delegating to `@fuzor/decision-records` under preserved `AiDecision*` export names.

**Package consumption:**

```json
"@fuzor/decision-records": "file:../../fuzor/packages/decision-records"
```

Transitive: `@fuzor/event-bus`, `@fuzor/identity`, `@fuzor/observability`

**Parity note:** Legacy error codes preserved (`ai_decision_record_not_found`, `ai_work_order_not_found`, `ai_decision_invalid_owner_agent`).

---

## Phase 4 — Tenant validation

- Explicit `organizationId` on all repository and service calls
- Fail-closed: queries filter by `organization_id`; no tenant inference
- Organization-scoped retrieval and persistence unchanged from Multi-Tenant Hardening 1A
- No process-global tenant defaults introduced

---

## Phase 5 — Context integration

Context remains a read-only composition layer. `@fuzor/context` consumes decision records from `@fuzor/decision-records` at assembly time.

```
Decision Records (@fuzor/decision-records)
    ↓ read-only fetch by organizationId + ids
Context (@fuzor/context)
    ↓ immutable package
Equipify workflows / AI runtime
```

No ownership overlap: Context never writes decision rows; Decision Records remain canonical for persistence.

---

## Phase 6 — Behavioral parity

Parity test: `pnpm test:fuzor-adoption-1j-decision-records-parity`

- QA markers, schema migration, registry reference-equal to platform
- Normalization helpers produce identical results
- Service/repository functions reference-equal to platform exports
- Wrappers contain no LLM, provider, or business orchestration imports

---

## Phase 7 — Compatibility layer

Stable import paths unchanged under `lib/growth/aios/ai-decision-record-*`. Existing Equipify callers require no import churn.

---

## Phase 8 — Future architecture

Multiple products share identical platform infrastructure while recording decisions independently:

```
Equipify / Ava        → createAiDecisionRecord(orgId, …)
Insideify / Ivy       → createAiDecisionRecord(orgId, …)
Future Product / Orion → createAiDecisionRecord(orgId, …)
                              ↓
                    @fuzor/decision-records
```

Each product retains independent workflows and business policy; only the persistence and audit infrastructure is shared.

---

## Phase 9 — Validation

| Check | Result |
|-------|--------|
| `@fuzor/decision-records` unit tests (25) | PASS |
| `test:fuzor-adoption-1j-decision-records-parity` | PASS |
| `test:ge-aios-2d-decision-record-foundation` | PASS |
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
