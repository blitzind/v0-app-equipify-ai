# GE-AIOS-GROWTH-3C — Runtime Pilot Architecture

**Phase:** GE-AIOS-GROWTH-3C — Runtime Pilot for `research_company`  
**Date:** 2026-06-25

---

## Purpose

Prove safe real execution-state mutation for a single internal workflow before expanding runtime enablement. The pilot layers on GE-AIOS-GROWTH-3A (runtime foundation) and GE-AIOS-GROWTH-3B (dry-run harness).

---

## Enablement model

```
effectiveRuntimeEnabled = runtimeEnabled ∧ pilotEnabled
```

| Flag | Default | Env var |
|------|---------|---------|
| Global runtime | `false` | Inherited from 3A (`GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED` + org infrastructure) |
| Pilot | `false` | `GROWTH_AIOS_GROWTH_EXECUTION_RUNTIME_PILOT_ENABLED=true` |

Both flags must be enabled for Command Center enqueue and lifecycle controls.

---

## Pilot allowlist

Only `research_company` may pass `validateExecutionRuntimePilotEnqueue`. All other canonical workflows are blocked at the pilot layer even if they pass 3A internal-mutation classification.

---

## Enqueue gate chain

1. `pilotEnabled`
2. `runtimeEnabled`
3. `isRuntimePilotWorkflow(workflowType)`
4. 3A gate validation (approval, readiness, handoff, preflight, boundary)
5. Latest dry-run status === `dry_run_passed` (3B in-memory cache per plan)

Failed gates return structured `blockCode` + `blockReason` surfaced in Command Center and Mission Planning Review.

---

## Execution path

```
POST /api/platform/growth/ai-os/execution-runtime/enqueue
  → validateGrowthLeadResearchExecutionPilotEnqueue
  → enqueueGrowthLeadResearchExecution (in-memory / AI OS event store)
  → runGrowthLeadResearchExecutionLifecycle
  → runDeterministicExecutionStep (research_company internal mutations only)
```

Lifecycle events use existing `growth.execution_runtime.*` event types. No Work Orders are created.

---

## Operator surfaces

### Command Center — Execution Runtime

- Pilot enabled/disabled banner
- Eligible `research_company` plans with Enqueue action
- Blocked plans with reasons
- Active / completed / cancelled / failed executions
- Lifecycle audit history (recent entries per execution)

### Mission Planning Review

- `pilotEligible`, `pilotSummary`, `pilotBlockedReasons`
- `dryRunRequired`, `latestDryRunStatus`
- Runtime state when an execution record exists

---

## Safety constraints

| Counter | Expected |
|---------|----------|
| providerCallsAttempted | 0 |
| outboundActionsAttempted | 0 |
| coreMutationsAttempted | 0 |
| workOrdersCreated | 0 |

---

## Feature flag

Set `GROWTH_AIOS_GROWTH_EXECUTION_RUNTIME_PILOT_ENABLED=true` in the deployment environment **and** enable global runtime through existing 3A controls to activate the pilot in production.
