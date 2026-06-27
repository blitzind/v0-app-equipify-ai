# GE-AI-2E — Priority Engine Binding

**Status:** Complete (local certification, not committed)  
**Date:** 2026-06-25  
**Certification:** `pnpm test:ge-ai-2e-priority-engine-binding`

---

## Objective

Bind existing mission priority outputs (4F) and Meta-Recommender recommendations (2F) into Growth Objectives runtime progression — read-only projection without duplicate priority engines.

---

## Source audit matrix

| Existing System | File(s) | Current Role | Existing Consumer | Reuse Strategy |
| --------------- | ------- | ------------ | ----------------- | -------------- |
| Mission Priority Engine (4F) | `growth-mission-priority-*` | Sole mission ranking authority | Command Center, Meta-Recommender, pilots | **Primary binding source** |
| Mission Framework (4E) | `growth-mission-framework-*` | Derives lead missions | Priority engine feeder | Input only — no re-derive |
| Meta-Recommender (2F) | `growth-meta-recommender-*` | Cross-source coordination | Command Center, Revenue Operator | Enrichment + evidence |
| Growth Objectives | `lib/growth/objectives/*` | Runtime lifecycle | Command Center `activeMissions` | Bridge via `leadId` in signals |
| Revenue Operator (4B) | `growth-revenue-operator-orchestration-*` | Agent handoff recs | Command Center | Read-only per-orchestration binding |
| Execution priority engine | `lib/growth/execution/execution-priority-engine.ts` | Operator queue scoring | Execution dashboards | Future feeder — not duplicated |
| Objective runtime scheduler | `growth-objective-runtime-scheduler.ts` | FIFO tick selection | Runtime service | **Not mutated in 2E** |
| Work Order priority | `ai-executive-mission-planning-planner.ts` | Enum → numeric priority | Executive planning | Future write phase — read-only preview only |

---

## Binding model

Types: `lib/growth/aios/priority/growth-priority-engine-binding-types.ts`

- `GrowthPriorityBinding` — canonical binding with status, next step, workflow agent, blockers, evidence
- `GrowthPriorityEngineBindingReadModel` — ranked read model with top 5 + objective contexts
- `GrowthPriorityBindingObjectiveContext` — per-objective projection for Growth Objectives UI

---

## Ranking formula

```
primary = mission_priority.overallPriority (4F authority)
secondary = meta_recommendation.score * 0.15
tie-break = priorityRank asc, then id asc
```

4F remains sole priority authority — binding does not re-score missions.

---

## Implementation

| File | Role |
| ---- | ---- |
| `lib/growth/aios/priority/growth-priority-engine-binding-types.ts` | Client-safe types |
| `lib/growth/aios/priority/growth-priority-engine-binding-engine.ts` | Collectors + ranking |
| `lib/growth/aios/priority/growth-priority-engine-binding-service.ts` | Server wrapper + workspace fetch |
| `lib/growth/aios/ai-os-command-center-service.ts` | Mounts `priorityBinding` |
| `app/api/platform/growth/ai-os/priority-bindings/route.ts` | GET-only platform API |
| `app/api/growth/workspace/objectives/priority-binding/route.ts` | GET-only workspace API |
| `components/growth/ai-os/command-center/growth-ai-os-priority-binding-section.tsx` | AI Operations UI |
| `components/growth/objectives/growth-objectives-dashboard.tsx` | Objective binding card |

### Source collectors (isolated try/catch each)

1. `mission_priority.ranked_missions`
2. `growth_objectives.active_missions` (objectives without lead-mission overlap)

### Bridge key

`objective.recentSignals[].leadId` ↔ `rankedMissions[].leadId`

---

## Known limitations

- Objective runtime scheduler not reordered — binding is read-only projection
- Work Order `priority` column not updated — no persistence writes
- Workspace objective fetch uses mission priority + objectives directly (Meta-Recommender empty unless via Command Center)
- Lead coverage limited to ~24 leads from approval/readiness queues (4F constraint)
- Dual mission taxonomy: objective UUID ≠ synthetic lead `missionId`

---

## Next recommended phase

**GE-AI-2H L3 Human Approval Center** — unified approval surface for bindings with `needs_approval` status.

---

## Tests

```bash
pnpm test:ge-ai-2e-priority-engine-binding
```

Regressions: GE-AI-2F, PROD-REGRESSION-6, GE-AIOS-5C.

---

*No commit. No deploy.*
