# GE-AIOS-GROWTH-3A — Execution Runtime Architecture

**Phase:** GE-AIOS-GROWTH-3A  
**Scope:** Internal-only workflow execution foundation

---

## Runtime rule

> Execution Runtime executes `internal_mutation_only` Growth workflows sequentially — no outbound, no provider calls, no Equipify Core mutations. **Disabled by default.**

---

## Layer stack

```
Planning (1A–1C) → Approval (1D) → Readiness (1E) → Handoff (1F)
→ Boundary (2A) → Preflight (2B) → Simulation (2C)
→ **Execution Runtime (3A)**
```

### Gate chain (hard requirements)

1. `GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED === false` unless explicitly enabled
2. Workflow ∈ `{ verify_email, buying_committee, research_company, meeting_preparation }`
3. Boundary classification === `internal_mutation_only`
4. Approval === `approved_for_future_execution`
5. Readiness === `ready_for_future_execution`
6. Handoff === `handoff_ready`
7. Preflight === `preflight_passed` and `runtimeImplementationAllowed`

---

## Execution states

| State | Description |
|-------|-------------|
| `queued` | Accepted into runtime queue |
| `validating` | Gate chain evaluation |
| `ready` | All gates passed |
| `executing` | Sequential step runner active |
| `paused` | Operator pause |
| `completed` | All steps finished |
| `cancelled` | Operator cancel |
| `failed` | Validation or step failure |

---

## Core modules

| Module | Role |
|--------|------|
| `growth-lead-research-execution-runtime-types.ts` | Types, state machine, gate validation (client-safe) |
| `growth-lead-research-execution-runtime-step-runner.ts` | Deterministic internal mutations (client-safe) |
| `growth-lead-research-execution-runtime-store.ts` | In-memory store (cert) |
| `growth-lead-research-execution-runtime-repository.ts` | Event-backed persistence via `ai_os_events` |
| `growth-lead-research-execution-runtime-lifecycle-service.ts` | Enqueue, run, pause, resume, cancel |
| `growth-lead-research-execution-runtime-service.ts` | Command Center read model |

---

## Persistence

Reuses **`growth.ai_os_events`** — no new schema migration.

Event types:

- `growth.execution_runtime.lifecycle_changed`
- `growth.execution_runtime.step_completed`
- `growth.execution_runtime.audit_recorded`

---

## UI surfaces

- **Command Center** — Execution Runtime section (queue, active, paused, completed, failed, cancelled)
- **Mission Planning Review** — Runtime state per approved plan

---

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/platform/growth/ai-os/execution-runtime` | GET | Read model |
| `/api/platform/growth/ai-os/execution-runtime/enqueue` | POST | Queue + run lifecycle |
| `/api/platform/growth/ai-os/execution-runtime/[executionId]/action` | POST | pause / resume / cancel |

---

## Non-goals (3A)

- SENDR / email / SMS / calls / LinkedIn
- Work Order creation
- Provider integrations
- Customer-facing or Core mutations
- Deployment
