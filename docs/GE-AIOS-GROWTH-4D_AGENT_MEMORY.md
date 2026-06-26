# GE-AIOS-GROWTH-4D — Agent Memory Architecture

**Phase:** GE-AIOS-GROWTH-4D  
**Date:** 2026-06-25

---

## Purpose

Agents should not reconstruct context independently. GE-AIOS-GROWTH-4D aggregates one deterministic shared memory model per lead from existing Growth AI OS sources. Agents read scoped views — they do not write memory in this phase.

---

## Shared memory model

Each record includes:

- Identity: memory id, lead id, company id/name
- Intelligence: research, qualification, opportunity, next best action
- Planning: execution plan, approval, readiness, handoff
- Guardrails: boundary, preflight, simulation
- Runtime: dry-run, pilot, runtime state
- Orchestration: owning agent, routed events, Revenue Operator recommendation
- Quality: completeness, missing fields, conflicts, confidence, remediation

---

## Memory sources (read-only)

Aggregated from existing modules:

- Research workflow snapshots
- Qualification and opportunity assessment
- Execution plans and review events
- Readiness reports and audit trail
- Handoff contracts
- Boundary audit and preflight checklist
- Execution simulation
- Runtime read model and dry-run summaries
- Pilot eligibility
- Revenue Operator orchestration
- Agent Events queue

No new persistence layer in 4D.

---

## Agent-specific views

Each of the seven Growth agents receives a read-only view:

- What the agent needs to know
- Allowed actions (permission profile)
- Required gates
- Blocked capabilities
- Recommended next action
- Missing context
- Confidence

All views derive from the same shared memory record.

---

## Completeness states

| State | Meaning |
|-------|---------|
| `complete` | Required fields present for current stage |
| `partial` | Some gaps remain |
| `missing_research` | Research not captured |
| `missing_qualification` | Qualification missing |
| `missing_plan` | Execution plan missing |
| `missing_approval` | Operator approval missing |
| `missing_runtime_context` | Dry-run/runtime context missing |
| `blocked` | Blocked reasons prevent use |

---

## Conflict detection

Conflicts are reported, not auto-resolved:

- Approved plan but readiness blocked
- Handoff ready but preflight blocked
- Runtime eligible but dry-run missing
- Execution recommended but pilot blocked
- Outbound workflow while Outreach Agent blocked
- Core mutation risk without explicit approval

---

## Operator surfaces

- **Command Center** — Agent Memory section per lead
- **Mission Planning Review** — compact completeness, conflicts, remediation

No Run Agent controls.

---

## Safety

- Read-only aggregation — no memory writes
- No scheduler, execution, outbound, providers, Work Orders, or Core mutations
