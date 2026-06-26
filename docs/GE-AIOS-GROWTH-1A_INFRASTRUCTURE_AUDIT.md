# GE-AIOS-GROWTH-1A — Growth Workflow Normalization Infrastructure Audit

**Phase:** GE-AIOS-GROWTH-1A  
**Date:** 2026-06-25

---

## Scope

Promote the Lead Research Pilot into the first canonical AI OS Growth workflow (`growth_lead_research`) while keeping pilot routes, flags, and observation UI backward-compatible.

---

## New artifacts

| Path | Role |
|------|------|
| `lib/growth/aios/growth/growth-lead-research-workflow-types.ts` | Workflow statuses, qualification logic, derivation helpers |
| `lib/growth/aios/growth/growth-lead-research-workflow-service.ts` | Publish/read workflow status events + Command Center summary |
| `components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx` | Command Center workflow cards |

---

## Extended artifacts

| Path | Change |
|------|--------|
| `lib/growth/aios/pilot/lead-research-pilot-config.ts` | Canonical + legacy flag aliases |
| `lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts` | Emits scheduled/researching/failed workflow status |
| `lib/growth/aios/pilot/lead-research-agent-executor.ts` | Qualification after save + terminal status events |
| `lib/growth/aios/pilot/lead-research-pilot-observability.ts` | Observation includes workflow + qualification |
| `lib/growth/aios/pilot/lead-research-pilot-types.ts` | Observation DTO extended |
| `lib/growth/aios/ai-os-command-center-types.ts` | `growthLeadResearchWorkflow` on read model |
| `lib/growth/aios/ai-os-command-center-service.ts` | Aggregates workflow summaries |
| `lib/growth/aios/ai-event-registry.ts` | `growth.workflow.status_changed` |

---

## Workflow statuses

`not_started`, `scheduled`, `researching`, `research_complete`, `qualified`, `blocked`, `failed`

---

## Feature flags (default OFF)

| Flag | Role |
|------|------|
| `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED` | Legacy alias |
| `GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED` | Canonical alias |

Either flag enables the workflow.

---

## Non-goals (confirmed)

- No buying committee, email verification, outreach, SENDR, autonomous follow-up, approval queue, or learning loop implementation
- No outbound sends
