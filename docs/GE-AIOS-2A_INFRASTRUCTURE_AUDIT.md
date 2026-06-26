# GE-AIOS-2A — Infrastructure Audit (Existing Code First)

**Phase:** GE-AIOS-2A  
**Date:** 2026-06-25  
**Purpose:** Document existing Growth Engine execution infrastructure before implementing AI Work Orders.

---

## Summary

The Growth Engine has **many domain-specific job queues** but **no universal AI execution contract**. GE-AIOS-2A adds `growth.ai_work_orders` as the constitutional layer without replacing existing queues.

---

## Existing infrastructure surveyed

| System | Location | Role | Reuse decision |
|--------|----------|------|----------------|
| **Sequence execution jobs** | `lib/growth/sequences/execution/`, `growth.sequence_execution_jobs` | Human-gated outbound step execution | **Keep** — domain-specific; future Work Orders may reference enrollment/step IDs in payload |
| **Email discovery jobs** | `lib/growth/email-discovery/`, `growth.email_discovery_jobs` | Async email discovery queue | **Keep** — PS-C job pattern; not a universal contract |
| **Phone discovery jobs** | `lib/growth/phone-discovery/` | Async phone discovery | **Keep** |
| **Company intelligence jobs** | `lib/growth/company-intelligence/` | Async intel runs | **Keep** |
| **Buying committee jobs** | `lib/growth/buying-committee-intelligence/` | Async committee intel | **Keep** |
| **Social profile discovery jobs** | `lib/growth/social-profile-discovery/` | Async social discovery | **Keep** |
| **Execution priority queue** | `lib/growth/execution/execution-priority-engine.ts` | Priority scoring for operator queue | **Keep** — input feeder only (Constitution §11.3); binds in GE-AI-2E |
| **Human execution queue** | `lib/growth/human-execution/` | Operator-facing approval/send queue | **Keep** — UI presenter; not AI Work Order store |
| **Objective runtime** | `lib/growth/objectives/` | Mission lifecycle, stages, scheduler | **Reuse reference** — `mission_id` FK → `organization_growth_objectives` |
| **Outreach queue** | `lib/growth/outreach/` | Transport scheduling | **Keep** — execution plane |
| **Lead engine orchestrator** | `lib/growth/lead-engine/orchestrator/` | Per-lead pipeline spine | **Keep** — future agent executor, not WO store |
| **Automation runtime** | `lib/growth/automation/` | Published automation flows | **Keep** |
| **Media generation jobs** | `lib/growth/media/growth-media-generation-job-service.ts` | Video/media async jobs | **Keep** — domain-specific |

---

## Patterns reused (not duplicated)

1. **Growth schema job table pattern** — status check constraint, `service_role` grants, RLS, `set_updated_at` trigger (from `email_discovery_jobs`, `sequence_execution_jobs`).
2. **Immutable audit events table** — `ai_work_order_events` mirrors `sequence_execution_job_events`.
3. **Schema health probe** — `probeGrowthSchemaObjects` from `lib/growth/schema-health/`.
4. **Mission FK** — `organization_growth_objectives` (Constitution: Mission = Objective in code).
5. **QA marker + migration constant** — matches GE-AUTO / Phase 7 job conventions.

---

## Why a new table (not extend sequence_execution_jobs)

| Criterion | Sequence jobs | AI Work Orders |
|-----------|---------------|----------------|
| Scope | Sequence enrollment steps only | Any AI task (research, verify, learning, …) |
| Agent ownership | Implicit (outreach) | Explicit constitutional agent |
| Mission binding | None | Required `mission_id` |
| Decision refs | None | `decision_record_ids[]` placeholder |
| Dependencies | Single step | `depends_on[]` Work Order graph |
| Constitution | Pre-AIOS | §16.1 binding schema |

Extending `sequence_execution_jobs` would violate single-purpose design and mix Core-adjacent outbound gates with AI OS contract.

---

## Duplication avoided

- Did **not** create a parallel cron runner or worker.
- Did **not** create Executive Brain, Decision Engine, or Agent Runtime.
- Did **not** wrap or replace domain job queues — they continue until future phases map Work Order types to subsystem invocations.
- Did **not** touch Equipify Core `work_orders` table or module.

---

## Future binding (extensibility only)

| Future system | Extension point |
|---------------|-----------------|
| Decision Records (GE-AI-2A) | `decision_record_ids[]`, `approval_id` |
| Memory facade (GE-AI-2D) | `memory_refs` jsonb |
| Executive Brain | `requested_by`, issues Work Orders via service |
| Event Bus (GE-AI-2B) | `work_order.*` events (not emitted in 2A) |
| Priority Engine (GE-AI-2E) | `priority` column |
| Agent Runtime | `transitionAiWorkOrder` + payload dispatch (later) |

---

*GE-AIOS-2A Infrastructure Audit — read-only analysis preceding implementation.*
