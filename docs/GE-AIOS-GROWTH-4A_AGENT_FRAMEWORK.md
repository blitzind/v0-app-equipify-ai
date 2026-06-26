# GE-AIOS-GROWTH-4A — Agent Framework Architecture

**Phase:** GE-AIOS-GROWTH-4A  
**Date:** 2026-06-25

---

## Purpose

Introduce a shared agent layer for Growth AI OS before expanding autonomous behavior. The framework defines **what agents exist**, **what they may coordinate**, and **what gates must pass** — without executing agent runs in this phase.

---

## Separation of concerns

```
Agent Framework (4A)     → decides what should happen
Execution Runtime (3A–3C) → decides whether/how it is allowed
```

---

## Agent kinds

| Kind | Permission | 4A mode |
|------|------------|---------|
| `research_agent` | read_only | Definition + dry-run eligible |
| `qualification_agent` | planning_only | Definition + dry-run eligible |
| `planning_agent` | planning_only | Definition only |
| `execution_agent` | internal_mutation | 3C pilot reference only |
| `outreach_agent` | outbound_requires_approval | Blocked — not executable |
| `meeting_agent` | planning_only | Definition only |
| `revenue_operator_agent` | supervisor | Recommendations only |

All agents default to `disabled` status and `disabled` scheduler mode.

---

## Run contract (read-only)

Generated previews include:

- requested action
- permission profile
- required gates (approval, readiness, handoff, preflight, boundary, dry_run, runtime_pilot)
- blocked reasons
- run status (`run_preview`, `run_blocked`, `run_ready_for_dry_run`, `run_ready_for_internal_runtime`, `run_not_allowed`)

No runs are executed in 4A.

---

## Scheduler placeholder

Modes defined: `manual`, `hourly`, `daily`, `event_driven`, `disabled`.

**No background jobs, cron, or queue workers are started.**

---

## Telemetry

All agents expose zeroed counters for provider calls, outbound attempts, and Core mutations in 4A.

---

## Operator surfaces

- **Command Center** — Agent Framework section (read-only registry)
- **Mission Planning Review** — owning agent, gates, blocked reasons per plan

---

## Safety

- No Work Orders
- No provider calls
- No outbound
- No Core mutations
- No migrations
- No new event types
