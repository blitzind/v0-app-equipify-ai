# GE-AIOS-GROWTH-5A — Scheduler Readiness Architecture

**Phase:** GE-AIOS-GROWTH-5A  
**Date:** 2026-06-25

---

## Purpose

GE-AIOS-GROWTH-4F ranks missions and allocates conceptual capacity. This phase defines **how agents would be awakened, prioritized, budgeted, throttled, and blocked** when the scheduler is eventually activated — readiness only, no activation.

---

## Scheduler modes

| Mode | 5A status |
|------|-----------|
| `disabled` | Current default |
| `manual_review` | Defined, not allowed in 5A |
| `priority_queue_preview` | Allowed — read-only queue preview |
| `controlled_agent_wake` | Defined, not allowed in 5A |
| `autonomous` | Defined, not allowed in 5A |

---

## Activation statuses

| Status | Meaning |
|--------|---------|
| `not_configured` | Readiness record not yet evaluated |
| `ready_for_manual_activation` | All gates pass for preview mode transition |
| `blocked_missing_priority_queue` | No immediate/today missions |
| `blocked_missing_budget_limits` | Budget/throttle incomplete |
| `blocked_missing_kill_switch` | Kill switches not armed |
| `blocked_missing_agent_permissions` | All agents still disabled (4A default) |
| `blocked_runtime_risk` | Runtime missions in high-priority queue |
| `blocked_outbound_risk` | Outbound missions not archived |

---

## Priority queue integration

Scheduler readiness consumes the 4F read model:

- Immediate, today, this week, backlog, archive candidate counts
- Capacity lane allocation
- Starvation warnings

Priority source is always `GE-AIOS-GROWTH-4F`. Recommendation-only.

---

## Agent wake rules

Deterministic rules per agent (Research, Qualification, Planning, Execution, Outreach, Meeting, Revenue Operator):

- Allowed scheduler modes (future)
- Required mission types
- Permission profile and gates
- Cooldown and max runs per period
- Budget ceiling
- Blocked capabilities
- `wakeAllowedInPhase: false` in 5A

---

## Budget and throttle model

Conceptual controls (reporting only in 5A):

- Max agent previews per hour
- Max internal runtime candidates per day
- Max outbound candidates per day (0)
- Max estimated spend per day
- Max failed attempts per mission
- Cooldown after block/failure

---

## UI surfaces

### Command Center — Scheduler Readiness

Mode, activation status, eligible queues, wake rules, budget/throttle, blocked reasons, recommended activation path. No Activate Scheduler or Wake Agent buttons.

### Mission Planning Review

Scheduler eligibility, queue source, wake recommendation, blocked reasons, cooldown/budget summary.

---

## Certification

`pnpm test:ge-aios-growth-5a-scheduler-readiness`
