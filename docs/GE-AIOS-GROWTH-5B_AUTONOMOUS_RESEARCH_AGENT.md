# GE-AIOS-GROWTH-5B — Autonomous Research Agent Architecture

**Phase:** GE-AIOS-GROWTH-5B  
**Date:** 2026-06-25

---

## Purpose

GE-AIOS-GROWTH-5A prepared scheduler readiness. This phase activates the **Research Agent** as the first autonomous agent — gathering and refreshing intelligence only, within strict budgets and operator controls.

---

## Scope

| Agent | 5B status |
|-------|-----------|
| Research Agent | Autonomous pilot active when operator resumes |
| All other agents | Disabled (recommendation only) |

---

## Scheduler

- **Mode:** `controlled_agent_wake` (Research Agent only)
- **Wake conditions:** stale research, newly discovered lead, manual refresh, scheduled refresh
- **Budget:** 10 autonomous runs/hour, 100/day

---

## Allowed autonomous actions

- Wake from scheduler when pilot is active
- Refresh company intelligence (internal deterministic summary)
- Update AI OS research snapshots via `growth.workflow.status_changed`
- Publish `agent.wake` events for audit

**Not allowed:** qualify leads, execution plans, runtime, outbound providers, Work Orders, Core mutations.

---

## Operator controls

| Control | Effect |
|---------|--------|
| Pause | Block autonomous wakes |
| Resume | Enable autonomous wakes |
| Disable | Shut down pilot |

---

## Revenue Operator supervision

Read-only monitoring:

- Approve wake recommendation
- Budget consumption
- Failure tracking
- Pause / escalation recommendations

---

## Telemetry

Tracks successful, failed, and skipped runs; average duration and confidence; budget consumption; stale research resolved.

---

## UI surfaces

### Command Center — Autonomous Research Agent

Enabled state, scheduler mode, run counts, budget, confidence, latest refreshes, Pause/Resume/Disable.

### Mission Planning Review

Autonomous research status, last refresh, stale status, confidence, next scheduled refresh.

---

## Persistence

In-memory pilot store for run history and control state. Research snapshots persisted via existing AI OS event bus — no new schema.

---

## Certification

`pnpm test:ge-aios-growth-5b-autonomous-research-agent`
