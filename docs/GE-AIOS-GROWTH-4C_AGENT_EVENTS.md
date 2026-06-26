# GE-AIOS-GROWTH-4C — Agent Event & Scheduling Architecture

**Phase:** GE-AIOS-GROWTH-4C  
**Date:** 2026-06-25

---

## Purpose

Define **when** Growth AI OS agents wake up and evaluate work. Events flow through the Revenue Operator for ownership recommendations. Agents remain recommendation-only — no execution in this phase.

---

## Architecture stack

```
Events (4C)
  ↓
Revenue Operator (4B)
  ↓
Agent Registry (4A)
  ↓
Agent Run Contract (4A)
  ↓
Runtime (3A–3C, future activation)
```

Planning and runtime layers remain unchanged; 4C adds the event activation layer above orchestration.

---

## Agent event model

Each event includes:

- event id, type, source, timestamp
- affected lead/company and workflow
- priority and triggering reason
- candidate agents and owning agent
- required gates and blocked reasons

Event types: `lead_discovered`, `research_completed`, `qualification_completed`, `opportunity_changed`, `execution_plan_created`, `execution_plan_approved`, `readiness_changed`, `dry_run_completed`, `runtime_completed`, `meeting_booked`, `meeting_completed`, `workflow_failed`, `human_review_requested`, `daily_review`, `manual_operator_request`.

---

## Event → agent routing

| Event | Routed agent |
|-------|--------------|
| lead_discovered | Research Agent |
| research_completed | Qualification Agent |
| qualification_completed | Planning Agent |
| execution_plan_approved | Revenue Operator |
| runtime_completed | Revenue Operator |
| meeting_booked | Meeting Agent |

Routing produces recommendations only — never executes agent work.

---

## Scheduling modes

Modes defined per agent: `manual`, `event_driven`, `hourly`, `daily`, `disabled`.

All schedulers are **inactive** in 4C. No cron, no background workers.

---

## Event queue

Read-only partitions:

- **pending** — awaiting operator review
- **ignored** — placeholder ticks (e.g. daily review when scheduler disabled)
- **blocked** — routing blocked (e.g. outreach)
- **completed recommendations** — ownership recommendation produced

Not an execution queue.

---

## Revenue Operator consumption

For each queued event, the Revenue Operator layer produces:

- owning agent and recommended next agent
- recommendation text
- blocked reasons and escalation level
- handoff preview (when applicable)

---

## Operator surfaces

- **Command Center** — Agent Events section
- **Mission Planning Review** — latest triggering event, owner, routing explanation

No Run Agent or Start Workflow controls.

---

## Safety

- Read-only — reuses AI OS event bus for observation
- No migrations or new event writes in 4C
- No Work Orders, providers, outbound, or Core mutations
