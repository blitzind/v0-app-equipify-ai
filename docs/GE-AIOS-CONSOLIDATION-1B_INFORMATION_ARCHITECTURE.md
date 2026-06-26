# GE-AIOS-CONSOLIDATION-1B — Information Architecture

## Principle

| Layer | Role |
|-------|------|
| AI OS phases (1A–5B) | Service layer — unchanged |
| Growth OS (`/growth/os`) | **AI Operations** dashboard |
| Mission Planning Review | Decision workspace |
| Growth Autonomy (1C) | AI control plane / configuration |

## Operator questions (above the fold)

1. **What happened?** — Daily briefing headline + AI activity timeline
2. **What needs attention?** — Needs attention count, active work blocked/waiting items
3. **What is AI doing?** — Active autonomous runs, runtime health, activity stream
4. **What is blocked?** — Blocked work in Active work widget; blockers on mission priorities
5. **What should I approve?** — Approval summary counts with deep links (no duplicate approval UIs)
6. **What should I work on next?** — Top 10 mission priorities + priority work label in executive overview

## Dashboard hierarchy

```
AI Operations (/growth/os)
├── Engineering diagnostics toggle (OFF default)
├── Executive overview
├── Active work | Approval summary
├── Mission priorities | Active objectives
├── AI activity (timeline)
├── AI health
├── Engineering diagnostics summary (compact)
├── Daily briefing (full section)
└── [Diagnostics ON] Phase sections 1A–5B + legacy command center panels
```

## Read model

`fetchAiOsCommandCenterReadModel` builds the existing command center, then:

1. `synthesizeAiOsDailyBriefing(commandCenterBase)`
2. `synthesizeAiOsOperationsDashboard(withDailyBriefing, { automationApprovalCount })`

Sources consumed by the operations dashboard synthesizer:

- Daily Briefing (5D)
- Mission Priority (4F)
- Mission Framework (4E)
- Autonomous Research Pilot (5B)
- Execution Plan Review Queue (1D)
- Work Order queues (5C)
- Activity / Executive Brain / Agent Events (4C, 5C)
- Revenue Operator (4B)
- Runtime (3A)
- Health: Agent, Provider, Scheduler Readiness (5A), Safe mode
- Objectives via `activeMissions`
- Automation approval inbox count (GeV15 read-only list)

## Navigation

- Sidebar: **Intelligence → AI Operations** (`/growth/os`)
- Label emphasizes operations, not configuration
- Configuration remains in Growth Autonomy (Consolidation-1C)

## Diagnostics mode

When **Show Engineering Diagnostics** is enabled, the full prior Command Center engineering layout renders below the operator dashboard, including all certified phase section components.

## Deep links

| Approval type | Target |
|---------------|--------|
| Execution plans | `#execution-plan-review` (diagnostics) |
| Work Orders | `#work-order-queues` (diagnostics) |
| Automation | `/growth/activity` |
| Outreach | `/admin/growth/outreach/approval` |
