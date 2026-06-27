# GE-AI-3A — Revenue Director Foundation

**Phase:** GE-AI-3A  
**Status:** Complete locally (not committed)  
**QA marker:** `growth-ge-ai-3a-revenue-director-v1`

## Objective

Introduce the **Revenue Director** as the executive orchestration layer that coordinates existing Workflow Agents, Intelligence Engines, Communication Engine, and Bounded Autonomous Outbound — without replacing them or executing transport.

Revenue Director owns **goals**. Everything else owns **execution**.

## Architectural position

```
Revenue Director (read-only executive orchestration)
        ↓ consumes Command Center snapshot only
Objectives · Meta-Recommender · Priority Binding · Communication Engine
        ↓
Human Approval Center · Bounded Outbound · Event Bus health
        ↓
Workflow Agents (advisory requests only — no dispatch)
        ↓
Existing Transport Services (unchanged)
```

**Design constraint:** Revenue Director does **not** read subsystems directly. It consumes a single `GrowthRevenueDirectorCommandCenterSnapshot` extracted from the AI OS Command Center read model.

## Orchestration audit

| Existing System | Current Responsibility | Revenue Director Relationship | Action |
| --- | --- | --- | --- |
| Revenue Operator | Per-lead orchestration decisions | Superset coordinator — consumes operator summary | Consume |
| Mission Framework | Mission health and planning | Objective health input | Consume |
| Objectives | Business goal runtime | Pace and allocation context via missions | Consume |
| Meta-Recommender | Unified recommendations | Workflow request source | Consume |
| Priority Engine Binding | Ranked next steps | Resource allocation + workflow requests | Consume |
| Human Approval Center | Unified approval inbox | Bottleneck + escalation signals | Consume |
| Communication Engine | Channel strategy plans | Communication mix + plan requests | Consume |
| Bounded Autonomous Outbound | Scoped autonomous envelope | Budget/outbound pause signals | Consume |
| Event Bus | Cross-layer events | Subscriber (`revenue_director_observer`) | Coordinate |
| AI Operations | Operator dashboard | Revenue Director section (read-only) | Keep |
| Workflow Agents | Research/qualify/plan/outreach execution | Target of advisory requests only | Future |
| Executive Brain | Mission planning ticks | Separate constitutional layer | Keep |
| Communication transports | Send email/SMS/voice | Never invoked by Revenue Director | Keep |

## Executive state model

`GrowthRevenueDirectorReadModel` includes:

- **executiveSummary** — revenue health, on-pace, pause/intervene flags
- **objectiveHealth** — per-mission pace, blockers, recommended agent
- **kpis** — approval backlog, scopes, missions, communication plans
- **resourceAllocation** — top objective, starved bindings, outbound budget
- **workflowRequests** — advisory only (`advisory: true`)
- **bottlenecks**, **risks**, **escalations**, **recommendations**
- **health** — agent, event bus, autonomy status
- **eventObservation** — subscriber telemetry

## Workflow request model

Canonical types in `growth-revenue-director-types.ts`:

| Request Type | Meaning |
| --- | --- |
| `run_research` | Advisory — suggest Research Agent |
| `rerun_qualification` | Advisory — suggest Qualification Agent |
| `generate_outreach` | Advisory — suggest Outreach Preparation |
| `wait` | Advisory — hold / monitor |
| `escalate_human` | Advisory — operator intervention |
| `pause_objective` | Advisory — pause objective/outbound |
| `allocate_more_budget` | Advisory — resource reallocation hint |
| `request_communication_plan` | Advisory — Communication Engine plan |
| `review_approval_queue` | Advisory — Human Approval Center review |

All requests are **recommendations, not commands**. No scheduler dispatch in GE-AI-3A.

## Ranking logic

```
requestPriority = objectiveUrgency × 0.35 + bottleneckSeverity × 0.30 + metaScore × 0.20 + approvalPressure × 0.15
```

Deterministic tie-break: request id ascending.

## Integrations

| Surface | Integration |
| --- | --- |
| Command Center | `revenueDirector` field on read model |
| GET API | `/api/platform/growth/ai-os/revenue-director` |
| AI Operations | `GrowthAiOsRevenueDirectorSection` |
| Event bus | `revenue_director_observer` subscriber + `growth.revenue_director.snapshot_generated` |

## Files changed

| Path | Role |
| --- | --- |
| `lib/growth/aios/revenue-director/growth-revenue-director-types.ts` | State + workflow request types |
| `lib/growth/aios/revenue-director/growth-revenue-director-engine.ts` | Deterministic synthesis from snapshot |
| `lib/growth/aios/revenue-director/growth-revenue-director-service.ts` | Server read service + event publish |
| `lib/growth/aios/ai-os-command-center-types.ts` | Read model field |
| `lib/growth/aios/ai-os-command-center-service.ts` | Build + publish snapshot |
| `lib/growth/aios/event-bus/growth-ai-event-bus-types.ts` | Subscriber id |
| `lib/growth/aios/event-bus/growth-ai-event-bus-engine.ts` | Subscriber definition + observation helper |
| `lib/growth/aios/ai-event-registry.ts` | Event type |
| `app/api/platform/growth/ai-os/revenue-director/route.ts` | GET-only API |
| `components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx` | Operations UI |
| `components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx` | Section wiring |
| `scripts/test-ge-ai-3a-revenue-director-foundation.ts` | Certification |

## Tests run

```bash
pnpm test:ge-ai-3a-revenue-director-foundation
```

Includes regressions: PROD-REGRESSION-6, 2B, 2E, 2H, 2F.

## Remaining roadmap

| Phase | Scope |
| --- | --- |
| GE-AI-3A-PROD-1 | Persistent Revenue Director snapshots + objective KPI history |
| GE-AI-3B | Active orchestration — dispatch advisory requests to Workflow Agent wake hooks (still gated) |
| GE-AI-3C | Budget allocation enforcement via Priority Engine |
| GE-AI-2J | Learning loop feeding Revenue Director recommendations |

## Next recommended phase

**GE-AI-3B — Active Orchestration Binding** — wire advisory workflow requests to existing agent wake/Work Order proposal flows with Human Approval gates, still no direct transport.

## Active orchestration readiness

Revenue Director is **ready to evolve** from advisory to active orchestration in a future phase:

- Command Center snapshot contract is stable
- Workflow request model includes target agent, priority, approval flags, evidence
- Event bus subscriber observes cross-layer signals without agent callbacks
- All enforcement paths (Growth Autonomy, Human Approval, Bounded Outbound) remain downstream

Blockers before active orchestration:

- Persistent snapshot history for audit/replay
- Idempotent request dispatch ledger
- Explicit operator opt-in for auto-dispatch per request type
