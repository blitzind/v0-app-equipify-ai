# GE-AIOS-GROWTH-4E — Mission & Goal Planning Architecture

**Phase:** GE-AIOS-GROWTH-4E  
**Date:** 2026-06-25

---

## Purpose

Move the Revenue Operator from event-only reactions to long-running business objectives. A **Mission** represents a goal (qualify a lead, book a meeting, close an opportunity). The Revenue Operator coordinates specialized agents through planning only — no execution in this phase.

---

## Mission model

Each mission includes:

- Identity: mission id, type, lead/company
- Objective, priority, owner and supporting agents
- Stage, status, progress
- Gates, completion and success criteria
- Blocked reasons, escalation, confidence
- Decomposition, dependencies, health, next recommendation

### Statuses

`proposed`, `planned`, `active`, `blocked`, `waiting_for_human`, `completed`, `abandoned`

### Mission types

| Type | Objective |
|------|-----------|
| `qualify_lead` | Qualify lead with evidence |
| `enrich_account` | Enrich account research |
| `identify_buying_committee` | Map buying committee |
| `prepare_outreach` | Plan outreach (blocked) |
| `prepare_meeting` | Prepare meeting brief |
| `monitor_account` | Monitor account signals |
| `recover_failed_workflow` | Recover from failure |
| `close_opportunity` | Close or abandon opportunity |

---

## Revenue Operator mission planner

Pure reasoning outputs:

- Active missions
- Completed missions
- Stalled missions
- Recommended new missions
- Recommended retiring missions

---

## Mission decomposition

Example — Close Opportunity:

- Planning Agent — document close rationale
- Execution Agent — confirm runtime state (reference only)
- Meeting Agent — capture meeting outcome
- Revenue Operator — supervise archive

No agent executes work in 4E.

---

## Dependencies

- **Prerequisites** — must complete first
- **Blocking** — prevents downstream missions
- **Optional** — may run in parallel
- **Parallel** — concurrent mission paths

---

## Mission health

| State | Meaning |
|-------|---------|
| `healthy` | Progressing normally |
| `blocked` | Guardrails or blockers |
| `stalled` | No progress in expected window |
| `waiting` | Human review required |
| `completed` | Success criteria met |

---

## Derivation

Missions are derived read-only from shared agent memory (4D) — no new persistence.

---

## Operator surfaces

- **Command Center** — Missions section
- **Mission Planning Review** — mission summary, stage, blockers, health, next milestone

No Execute Mission controls.

---

## Safety

- Recommendation-only planning
- No scheduler, execution, outbound, providers, Work Orders, or Core mutations
