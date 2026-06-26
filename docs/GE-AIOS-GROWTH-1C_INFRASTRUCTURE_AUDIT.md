# GE-AIOS-GROWTH-1C — Next Best Action Workflow Planner Infrastructure Audit

**Phase:** GE-AIOS-GROWTH-1C  
**Date:** 2026-06-25

---

## Scope

Extend Opportunity Assessment so every Next Best Action expands into a deterministic **Execution Plan** — workflow mapping, prerequisites, required Work Orders (future), success/failure criteria, and readiness. Planning-only; no autonomous execution or outbound.

---

## New artifacts

| Path | Role |
|------|------|
| `lib/growth/aios/growth/growth-lead-research-execution-plan.ts` | Deterministic planner + canonical workflow types |
| `components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx` | Read-only Planning Review UI |
| `scripts/test-ge-aios-growth-1c-execution-plan-foundation.ts` | Local certification |

---

## Extended artifacts

| Path | Change |
|------|--------|
| `lib/growth/aios/growth/growth-lead-research-opportunity-assessment.ts` | Intelligence output includes `executionPlan` |
| `lib/growth/aios/growth/growth-lead-research-workflow-types.ts` | Snapshot stores `executionPlan` |
| `lib/growth/aios/growth/growth-lead-research-workflow-service.ts` | Serialize/parse execution plan; Command Center readiness fields |
| `lib/growth/aios/pilot/lead-research-agent-executor.ts` | Publishes `executionPlan` on `assessed` event |
| `lib/growth/aios/pilot/lead-research-pilot-types.ts` | Observation DTO extended |
| `lib/growth/aios/pilot/lead-research-pilot-observability.ts` | Returns execution plan from snapshot |
| `lib/growth/aios/ai-os-command-center-types.ts` | Readiness, workflow type, duration, cost, approval, missing prerequisites |
| `lib/growth/aios/ai-executive-mission-planning-review-types.ts` | `leadResearchExecutionPlans` on read model |
| `lib/growth/aios/ai-executive-mission-planning-review-service.ts` | `listLeadResearchExecutionPlansForMission()` |
| `components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section.tsx` | Assessed lead execution readiness block |
| `components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx` | Planning Review section |
| `components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx` | Passes execution plans to dashboard |
| `components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx` | Planning Review on pilot observation |

---

## Execution Plan fields

`next_best_action`, `workflow_type`, `estimated_steps`, `required_work_orders`, `prerequisites`, `required_evidence`, `approval_required`, `estimated_duration`, `estimated_cost`, `expected_outcome`, `success_criteria`, `failure_conditions`, `rollback_strategy`, `execution_readiness`, `missing_prerequisites`

---

## Workflow mapping

| Next Best Action kind | Canonical workflow |
|----------------------|-------------------|
| verify_email | verify_email |
| research_buying_committee | buying_committee |
| generate_outreach_draft | outreach_generation |
| prepare_meeting | meeting_preparation |
| wait_for_buying_signal | monitoring |
| request_human_review | approval |
| abandon_lead | close |
| continue_research | research_company |

---

## Non-goals (confirmed)

No verify-email workflow execution, buying committee workflow, outreach generation, SENDR, email/SMS/calls, sequence enrollment, or autonomous Work Order creation from execution plan surfaces.
