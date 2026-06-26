# GE-AIOS-GROWTH-4F — Mission Prioritization Architecture

**Phase:** GE-AIOS-GROWTH-4F  
**Date:** 2026-06-25

---

## Purpose

The Revenue Operator can see what happened, who owns it, and which missions exist (GE-AIOS-GROWTH-4E). This phase answers **which mission should be worked first**, **which can wait**, **which should be abandoned**, and **how finite AI capacity should be allocated** — recommendation only, no execution.

---

## Mission priority model

Each mission receives deterministic scores:

| Field | Meaning |
|-------|---------|
| `priorityScore` / `overallPriority` | Composite 0–100 rank |
| `urgencyScore` | Escalation, SLA, human gates |
| `businessValueScore` | Strategic importance and status |
| `confidenceScore` | Derived from mission confidence |
| `effortScore` | Mission type + remaining progress |
| `estimatedRoi` | Value vs effort ratio |
| `missionAgeDays` | Days since last update |
| `slaPressure` | Age + stalled health |
| `dependencyWeight` | Prerequisite count |
| `strategicImportance` | Mission type baseline |

Outputs: human-readable explanation and `recommendedOrder`.

---

## Conceptual capacity pool

Six logical lanes (no scheduler, no workers):

- Research capacity
- Qualification capacity
- Planning capacity
- Execution capacity
- Meeting preparation capacity
- Revenue Operator review capacity

Each lane has fixed conceptual slot counts. Allocation decrements available slots; exhausted lanes defer missions.

---

## Allocation engine

For each ranked mission:

| Status | Meaning |
|--------|---------|
| `allocated` | Receives conceptual capacity |
| `deferred` | Capacity exhausted or low priority |
| `blocked` | Mission blocked — no capacity |
| `abandon_recommended` | Low ROI or completed |
| `waiting_for_human` | Human review gate |
| `waiting_for_prerequisite` | Dependencies incomplete |

---

## Queue optimization

Deterministic buckets:

- **immediate** — high priority + allocated
- **today** — priority ≥ 55
- **this_week** — priority ≥ 40
- **backlog** — deferred or low priority
- **archive_candidate** — abandon recommended or terminal status

---

## Starvation detection

| Kind | Trigger |
|------|---------|
| `long_waiting` | Age > 14 days, low progress |
| `repeatedly_blocked` | Multiple blockers |
| `duplicate_mission` | Same lead + mission type |
| `conflicting_missions` | > 2 concurrent active missions per lead |
| `stale_mission` | Stalled health + age > 7 days |

Each issue includes recommended remediation.

---

## Revenue Operator guidance

Read-only answers:

- Highest-value work
- What should happen today
- What can safely wait
- Which missions to abandon
- Where to spend AI capacity

---

## UI surfaces

### Command Center — Mission Priorities

Ranking, capacity pool, queue placement, ROI, urgency, confidence, blockers, recommended action. No Execute button.

### Mission Planning Review

Per-lead priority, queue bucket, allocation/defer reason, ROI, urgency.

---

## Inputs and dependencies

- **Input:** `GrowthMissionRecord[]` from GE-AIOS-GROWTH-4E mission framework
- **Persistence:** None — derived read models only

---

## Certification

`pnpm test:ge-aios-growth-4f-priority-engine`
