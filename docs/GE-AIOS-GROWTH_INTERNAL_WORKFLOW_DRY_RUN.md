# GE-AIOS-GROWTH — Internal Workflow Dry Run

**Phase:** GE-AIOS-GROWTH-3B  
**Depends on:** GE-AIOS-GROWTH-3A Execution Runtime Foundation

---

## Purpose

Provide operators a **deterministic dry-run harness** to validate internal Growth workflows before enabling real execution-state mutation in the 3A runtime.

---

## Allowed workflows

Same as 3A internal runtime:

- `verify_email`
- `buying_committee`
- `research_company`
- `meeting_preparation`

Blocked (planning-only / outbound):

- `outreach_generation`
- `monitoring`
- `approval`
- `close`

---

## Dry-run flow

1. Operator submits approved plan to `POST /api/platform/growth/ai-os/execution-runtime/dry-run`.
2. Service builds gate validation via `buildDryRunGateValidation` (runtime treated as enabled for simulation).
3. Engine `runInternalWorkflowDryRun` simulates:
   - State transitions: queued → validating → ready → executing → completed (or failed)
   - Each plan step via `runDeterministicExecutionStep`
   - Predicted audit events (in-memory labels only — **not published**)
4. Report returned to client; optional process-scoped cache for Mission Planning Review latest summary.

---

## Dry-run statuses

| Status | Meaning |
|--------|---------|
| `dry_run_passed` | Gates passed and all steps simulated |
| `dry_run_failed_gate_validation` | Gate chain blocked execution |
| `dry_run_not_allowed` | Workflow not in internal runtime allowlist |
| `dry_run_blocked` | Simulation failed (invalid transition or step failure) |

---

## Report model

- `dryRunId`, `planId`, `workflowType`
- `gateResults`
- `simulatedStateTransitions`, `simulatedSteps`, `simulatedInternalMutations`
- `blockedReasons`, `predictedAuditEvents`
- `sideEffectCounters` (always zero for provider/outbound/Core/Work Orders)
- `finalStatus`, `generatedAt`
- `nonPersistent: true`

---

## Safety guarantees

- No execution state persisted
- No AI OS runtime events written
- No provider calls
- No outbound actions
- No Work Orders
- No Equipify Core mutations
- Real runtime remains disabled by default

---

## Operator surfaces

### Command Center

Execution Runtime section includes **Internal Workflow Dry-Run (non-persistent)** with actions per eligible approved plan and latest session report.

### Mission Planning Review

Each lead research execution plan shows dry-run eligibility, latest status (when run in session), and blocked reasons on failure.

---

## Certification

```bash
pnpm test:ge-aios-growth-3b-internal-workflow-dry-run
```

Includes regressions for GE-AIOS-GROWTH-2B, 2C, and 3A.
