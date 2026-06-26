# GE-AIOS-GROWTH — Execution Boundary Matrix

**Phase:** GE-AIOS-GROWTH-2A  
**Purpose:** Reference matrix for future execution runtime boundary audit. Read-only planning artifact.

---

## Workflow boundary summary

| Workflow | Classification | Safe Work Order | Future allowed | Outbound risk | Core risk |
|----------|----------------|-----------------|----------------|---------------|-----------|
| verify_email | internal_mutation_only | verify_email | Yes | low | none |
| buying_committee | internal_mutation_only | generate_buying_committee | Yes | none | none |
| outreach_generation | outbound_requires_human_approval | generate_email | Yes | high | low |
| meeting_preparation | internal_mutation_only | prepare_meeting | Yes | low | none |
| monitoring | read_only_runtime | analyze_reply | Yes | none | none |
| approval | planning_only | — | No | none | none |
| close | planning_only | — | No | none | low |
| research_company | internal_mutation_only | research_company | Yes | none | none |

---

## Global guardrails (all workflows)

- `GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED` feature flag
- `autonomy_enabled` kill switch
- Emergency stop inactive
- AI OS provider ready (when provider-dependent)
- Decision Record gate before Work Order execution
- Explicit operator Work Order approval (Mission Planning Review)
- No autonomous outbound / SENDR without human send approval

---

## Must never touch (future execution phase)

- Equipify Core: `public.invoices`, `public.quotes`, `public.work_orders` (BlitzPay/Core)
- SENDR sequence enrollment without operator action
- Email/SMS/call/voice/LinkedIn transport without per-message human approval
- Autonomous Work Order creation from planning surfaces

---

## Safe future connection points

| Layer | Path | Role |
|-------|------|------|
| Planning | `growth-lead-research-execution-plan.ts` | Canonical workflow map |
| Approval | `growth-lead-research-execution-plan-review-service.ts` | Operator review state |
| Readiness | `growth-lead-research-approved-plan-readiness-service.ts` | Eligibility + audit trail |
| Handoff | `growth-lead-research-future-execution-handoff-service.ts` | Handoff contract |
| Boundary | `growth-lead-research-execution-boundary-audit-service.ts` | Runtime boundary audit |
| Execution (future) | `ai-decision-gate-service.ts`, `ai-executive-mission-planning-review-service.ts` | Gated Work Order creation |

---

## Rollback defaults

All workflows revert to `assessed` planning state on operator rejection. Outbound drafts are discarded, not queued. Partial research runs preserved for audit.
