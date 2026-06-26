# GE-AIOS-GROWTH-4B — Revenue Operator Orchestration Architecture

**Phase:** GE-AIOS-GROWTH-4B  
**Date:** 2026-06-25

---

## Purpose

The Revenue Operator Agent supervises Growth AI OS. In 4B it **never performs work directly** — it evaluates system state, determines which specialized agent should own the next action, and produces orchestration decisions and handoff contracts.

---

## Separation of concerns

```
Revenue Operator (4B)     → decides who should own the next action
Agent Framework (4A)      → defines agents, permissions, run contracts
Execution Runtime (3A–3C) → decides whether/how execution is allowed
```

---

## Orchestration model

Each evaluation produces:

- orchestration id and evaluation timestamp
- lead / company identifiers
- current lifecycle stage
- owning agent and candidate agents
- orchestration decision, confidence, reasoning
- required gates, blocked reasons, escalation level
- recommended next action and handoff preview

---

## Decision states

| Decision | Meaning |
|----------|---------|
| `continue_current_agent` | Ownership unchanged |
| `handoff_to_research` | Route to Research Agent |
| `handoff_to_qualification` | Route to Qualification Agent |
| `handoff_to_planning` | Route to Planning Agent |
| `handoff_to_execution` | Route to Execution Agent (3C pilot) |
| `handoff_to_meeting` | Route to Meeting Agent |
| `human_review_required` | Operator review before progression |
| `blocked` | No safe handoff (e.g. outreach) |

---

## Ownership resolver

Examples (deterministic from plan state):

| State | Owning agent |
|-------|--------------|
| `research_company` (pre-approval) | Research Agent |
| `verify_email` / `buying_committee` | Qualification Agent |
| Approved + ready + pilot workflow | Execution Agent |
| `meeting_preparation` | Meeting Agent |
| Readiness / preflight blocked | Human review escalation |

---

## Handoff contracts

Read-only contracts include:

- source and destination agents
- reason and required context
- required gates (approval, readiness, handoff, preflight, boundary, dry_run, runtime_pilot)
- expected outputs

No handoff executes agent work in 4B.

---

## Operator surfaces

- **Command Center** — current owner, recommended next agent, confidence, blocked reasons, escalation, handoff preview
- **Mission Planning Review** — current owner, next owner, handoff summary, orchestration reasoning

No Execute Agent or Start Workflow controls.

---

## Safety

- Recommendation-only — no autonomous execution
- Scheduler inactive
- No Work Orders, provider calls, outbound, or Core mutations
- No migrations or event writes
