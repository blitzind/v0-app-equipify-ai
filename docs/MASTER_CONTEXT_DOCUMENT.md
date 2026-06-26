# Master Context Document

=================================================

**AI REVENUE OPERATOR CONSTITUTION**

| Field | Value |
|-------|--------|
| Status | **Frozen** |
| Version | **1.0** |
| Canonical reference | [`docs/architecture/AI_REVENUE_OPERATOR_CONSTITUTION_v1.0.md`](./architecture/AI_REVENUE_OPERATOR_CONSTITUTION_v1.0.md) |

**All implementation must conform to the Constitution.**  
**Architectural changes require constitutional amendment** (see Constitution §20).

=================================================

**Document role:** Living engineering state — current phase, production status, rules, certifications, risks, and priorities.  
**Last updated:** 2026-06-25 (GE-AIOS-GROWTH-5D Autonomous Planning Agent Pilot)  
**Regeneration:** `pnpm update:master-context` (inventory scan + this document's manual sections)  
**Admin UI:** `/admin/master-context`

---

## Table of contents

1. [Current engineering phase](#1-current-engineering-phase)
2. [Current production status](#2-current-production-status)
3. [Environment rules](#3-environment-rules)
4. [Development rules](#4-development-rules)
5. [Commit rules](#5-commit-rules)
6. [Deployment rules](#6-deployment-rules)
7. [Known issues](#7-known-issues)
8. [Implementation roadmap](#8-implementation-roadmap)
9. [Production certifications](#9-production-certifications)
10. [Current runtime state](#10-current-runtime-state)
11. [Outstanding risks](#11-outstanding-risks)
12. [Current priorities](#12-current-priorities)
13. [References](#13-references)

---

## 1. Current engineering phase

| Field | Value |
|-------|--------|
| **Architecture phase** | GE-AI-1X — **Complete** (Constitution v1.0 frozen) |
| **Documentation phase** | GE-DOC-1 — **Complete** |
| **Current phase** | **GE-AIOS-GROWTH-5D** — Autonomous Planning Agent Pilot (**certified locally**, not committed) |
| **Next phase** | GE-AI-2F — Meta-Recommender |

**Transition:** Official move from Architecture Phase (GE-AI-1X) to Engineering Phase (GE-AI-2X).

Implementation tracking: [`docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md`](./AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md)

---

## 2. Current production status

### Growth Engine / AI Revenue Operator

| Area | Status |
|------|--------|
| Constitutional architecture | Defined and frozen (v1.0); **AIOS foundations 2A–2H implemented locally** |
| GE-AUTO autonomy batch (1A–2I) | Implemented locally; cert `GROWTH_ENGINE_AUTONOMY_READY_WITH_MINOR_FOLLOWUPS` |
| Autonomous outbound | **Not** broadly enabled |
| Autonomous approvals | **Disabled** |
| Default autonomous daily budgets | **0** |
| GE-AUTO-3 | Not started |
| Lead Engine LLM wiring | Fixture dry-run only |
| Feature registry enforcement (8H) | Pending |

### Core Equipify platform

Production SaaS for equipment service businesses: multi-tenant orgs, work orders, scheduling, invoicing, QuickBooks export, calibration certificates, customer portal, platform admin.

Detailed module inventory remains in `lib/admin/master-context.manual.before.md` (generated scan + manual sections). Architectural detail for the AI Revenue Operator has moved to the Constitution.

---

## 3. Environment rules

- **Secrets:** Never commit `.env`, credentials, or API keys. Reference env var **names** only in docs and prompts.
- **Local dev:** Standard Next.js + Supabase stack; Growth Engine routes under `/api/platform/growth/` and admin growth surfaces.
- **Feature flags / kill switches:** `growth.runtime_guardrail_settings` — respect platform kill switches before enabling autonomy.
- **Provider keys:** Apollo, PDL, LLM, transport credentials per org or platform config — never in repo.

---

## 4. Development rules

### 4.1 Permanent development lifecycle

```
Constitution (v1.0 frozen)
  ↓
Implementation Phase (GE-AI-2X)
  ↓
Implementation Certification
  ↓
Master Context Update
  ↓
Commit
  ↓
Production Certification
  ↓
Architecture Impact Review
       ↓                    ↓
   No Impact          Architecture Impact
       ↓                    ↓
   Continue         Constitutional Amendment
                           ↓
                       Continue
```

**Replaces legacy:** Audit → Implement → Certify → Commit → Deploy (still valid for non-constitutional work; constitutional work adds traceability gates above).

### 4.2 Traceability rules (mandatory)

Every implementation phase must reference:

| Artifact | Location |
|----------|----------|
| Constitution sections implemented | Ledger entry + cert report |
| Engineering phase ID | GE-AI-2X |
| Implementation certification | Phase cert script/report |
| Production certification | When deployed |
| Master Context update | This document |
| Implementation Ledger update | `AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md` |

**Nothing ships without constitutional traceability** for GE-AI-2X work.

### 4.3 Constitutional compliance

- Reuse existing subsystems (`lib/growth/*`); orchestrate, do not duplicate.
- One decision owner per key; Meta-Recommender is authoritative for conflicts.
- Executive Brain never sends outbound.
- Work Orders require Decision Records before execution (L1+).

Full rules: Constitution §3, §16, §17.

### 4.4 UI/UX standards

- Brand: primary blue `--primary`; CTA orange `--cta` #f59f1c; dark admin chrome #0F172A.
- Inline empty states: icon + title + helper; outline Retry when applicable.
- Prefer `components/ui`; drawers/sheets for create/edit; avoid raw UUIDs in UI.
- See `lib/admin/master-context.manual.after.md` § UI/UX Standards for full list.

---

## 5. Commit rules

- Meaningful commits only; no secrets.
- After inventory-affecting changes: run `pnpm update:master-context`.
- GE-AI-2X commits should cite phase ID in message (e.g. `GE-AI-2A: add decision_records table`).
- Update Implementation Ledger in same PR when phase status changes.

---

## 6. Deployment rules

- Autonomy enablement: follow Growth Engine Autonomy production checklist (Constitution references GE-AUTO; checklist in legacy master-context manual § Growth Engine Autonomy System).
- Do not enable L3+ autonomous send until GE-AI-2H certified.
- Production cert scripts under `scripts/test-growth-*` and phase-specific cert harnesses.
- Rollback notes required in Ledger for schema/API changes.

---

## 7. Known issues

### AI Revenue Operator / Growth Engine

- 10+ parallel recommendation engines — unify in GE-AI-2F.
- Multiple event substrates — unify in GE-AI-2B.
- Lead Engine orchestrator: no LLM/outbound wiring.
- Feature registry 8G documented, 8H not enforced.
- Agent orchestration Tier 2 cold — promote to Executive Brain staff in implementation.

### Platform (from manual after)

- Demo/mock layers can drift from production RBAC.
- Settings notification prefs partially not persisted.
- Some routes use raw role branching vs capability map.
- QuickBooks marketing page vs Settings connector mismatch.
- Portal reports partially mock.

Full list: `lib/admin/master-context.manual.after.md` § Known Limitations.

---

## 8. Implementation roadmap

### Completed phases

| Phase | Title | Status |
|-------|-------|--------|
| Autonomy Audit | Baseline inventory | Complete |
| GE-AI-1A | Master Architecture | Complete |
| GE-AI-1B | Decision Framework | Complete |
| GE-AI-1C | Memory Architecture | Complete |
| GE-AI-1D | Operating System | Complete |
| GE-AI-1E | Consistency Review | Complete |
| GE-AI-1F | Glossary & Binding Addendum | Complete |
| GE-DOC-1 | Documentation Reorganization | Complete |
| GE-AIOS-2A | AI Work Order Foundation | Complete (local cert) |
| GE-AIOS-2B | AI Event Foundation | Complete (local cert) |
| GE-AIOS-2C | AI Agent Runtime Foundation | Complete (local cert) |
| GE-AIOS-2D | Decision Record Foundation | Complete (local cert) |
| GE-AIOS-2E | Decision Gate for Work Orders | Complete (local cert) |
| GE-AIOS-2F | Memory Foundation | Complete (local cert) |
| GE-AIOS-2G | Executive Brain Foundation | Complete (local cert) |
| GE-AIOS-2H | Decision Engine Foundation | Complete (local cert) |
| GE-AIOS-2I | Decision Engine Execution Bridge | Complete (local cert) |
| GE-AIOS-2J | Context Assembly Foundation | Complete (local cert) |
| GE-AIOS-3A | LLM Provider Abstraction | Complete (local cert) |
| GE-AIOS-3B | AI Decision Intelligence Bridge | Complete (local cert) |
| GE-AIOS-3C | Executive Decision Preparation | Complete (local cert) |
| GE-AIOS-3D | Executive Mission Planning Tick | Complete (local cert) |
| GE-AIOS-3E | Mission Planning Review Surface | Complete (local cert) |
| GE-AIOS-3F | AI OS Stack Certification & Migration Readiness | Complete (local cert) |
| GE-AIOS-4A | Autonomous Growth Pilot (Lead Research) | Complete (local cert) |
| GE-AIOS-5A | Executive Intelligence v1 (Planning Report) | Complete (local cert) |
| GE-AIOS-URL-1 | Public route namespace (`/growth/os`) | Complete (local cert) |
| GE-AIOS-5B | Executive Planning Review UX | Complete (local cert) |
| GE-AIOS-5C | AI OS Command Center read model | Complete (local cert) |
| GE-AIOS-5D | AI OS Daily Briefing read model | Complete (local cert) |
| GE-AIOS-GROWTH-1A | Growth Lead Research workflow normalization | Complete (local cert) |
| GE-AIOS-GROWTH-1B | Opportunity Assessment & Next Best Action | Complete (local cert) |
| GE-AIOS-GROWTH-1C | Next Best Action Workflow Planner | Complete (local cert) |
| GE-AIOS-GROWTH-1D | Execution Plan Approval Queue | Complete (local cert) |
| GE-AIOS-GROWTH-1E | Approved Plan Readiness & Audit Trail | Complete (local cert) |
| GE-AIOS-GROWTH-1F | Future Execution Handoff Contract | Complete (local cert) |
| GE-AIOS-GROWTH-2A | Execution Runtime Boundary Audit | Complete (local cert) |
| GE-AIOS-GROWTH-2B | Execution Guardrail Preflight Checklist | Complete (local cert) |
| GE-AIOS-GROWTH-2C | Execution Simulation Engine | Complete (local cert) |
| GE-AIOS-GROWTH-3A | Execution Runtime Foundation | Complete (local cert) |
| GE-AIOS-GROWTH-3B | Internal Workflow Dry Run Harness | Complete (local cert) |
| GE-AIOS-GROWTH-3C | Execution Runtime Pilot (`research_company`) | Complete (local cert) |
| GE-AIOS-GROWTH-4A | Agent Framework Foundation | Complete (local cert) |
| GE-AIOS-GROWTH-4B | Revenue Operator Orchestration Engine | Complete (local cert) |
| GE-AIOS-GROWTH-4C | Agent Event & Scheduling Framework | Complete (local cert) |
| GE-AIOS-GROWTH-4D | Agent Memory & Shared Context | Complete (local cert) |
| GE-AIOS-GROWTH-4E | Mission & Goal Planning Framework | Complete (local cert) |
| GE-AIOS-GROWTH-4F | Mission Prioritization & Resource Allocation | Complete (local cert) |
| GE-AIOS-GROWTH-5A | Scheduler Readiness & Activation Plan | Complete (local cert) |
| GE-AIOS-GROWTH-5B | Autonomous Research Agent Pilot | Complete (local cert) |
| GE-AIOS-GROWTH-5C | Autonomous Qualification Agent Pilot | Complete (local cert) |
| GE-AIOS-GROWTH-5D | Autonomous Planning Agent Pilot | Complete (local cert) |
| GE-AIOS-CONSOLIDATION-1B | Growth OS Information Architecture (AI Operations dashboard) | Complete (local cert) |
| GE-AIOS-CONSOLIDATION-1C | Growth Autonomy Control Plane (AI policy engine) | Complete (local cert) |
| GE-AIOS-CONSOLIDATION-1E | Policy Evaluation Unification | Complete (local cert) |

### Current phase

**GE-AIOS-CONSOLIDATION-1E — Policy Evaluation Unification**
All autonomous policy evaluation flows through `fetchGrowthAiOsAutonomyPolicyEvaluationContext`. Legacy evaluators are compatibility wrappers. Scheduler, Command Center, Revenue Operator, Runtime, and Research Agent consume the policy engine. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-CONSOLIDATION-1C — Growth Autonomy Control Plane**
Growth Autonomy (`/growth/settings/autonomy`) is the canonical AI control plane — unified read-through policy engine consumed by Agent Framework, Scheduler Readiness, Revenue Operator, Autonomous Research, and Execution Runtime. AI Operations remains read-only with deep links. No duplicate configuration surfaces, no migrations, no new autonomous capabilities. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-CONSOLIDATION-1B — Growth OS Information Architecture Refactor**
Operator-first AI Operations dashboard at `/growth/os` — consolidates Command Center read models into executive overview, active work, activity, health, approvals, mission priorities, and objectives widgets. Engineering phase sections (1A–5B) preserved behind diagnostics toggle. Read-only — no backend behavior changes. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-5D — Autonomous Planning Agent Pilot**

Third controlled autonomous agent. Wakes after successful qualification to generate deterministic execution plans via `planGrowthLeadResearchExecution`. Policy-gated through Growth Autonomy; no runtime, outbound, or Work Orders.

**GE-AIOS-GROWTH-5C — Autonomous Qualification Agent Pilot**

Second controlled autonomous agent. Wakes after successful research to evaluate ICP fit and buying signals via existing 1A/1B qualification services. Policy-gated through unified Autonomy Policy Engine. Budget 20/hr · 200/day. No outbound, runtime, Work Orders, or Core mutations. Status: **Complete (local cert)**.

**GE-AIOS-GROWTH-5B — Autonomous Research Agent Pilot**
First controlled autonomous agent activation — Research Agent only under `controlled_agent_wake` with budget limits (10/hr, 100/day). Internal research snapshot refresh via existing AI OS events. Command Center operator controls (Pause/Resume/Disable) and Revenue Operator supervision. No outbound, providers, runtime enqueue, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-5A — Scheduler Readiness & Activation Plan**
Read-only scheduler readiness from GE-AIOS-GROWTH-4F priority queues. Defines activation statuses, agent wake rules, budget/throttle limits, and recommended activation paths. Readiness-only — no scheduler activation, cron, workers, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4F — Mission Prioritization & Resource Allocation**
Read-only mission priority scoring, conceptual capacity allocation, queue optimization, and starvation detection from GE-AIOS-GROWTH-4E missions. Command Center Mission Priorities and Mission Planning Review priority context. Recommendation-only — no mission execution, scheduler, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4E — Mission & Goal Planning Framework**
Read-only mission derivation from shared agent memory. Revenue Operator mission planner, decomposition, dependencies, and health assessment. Command Center and Mission Planning Review visibility. Recommendation-only — no mission execution, scheduler, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4D — Agent Memory & Shared Context**
Read-only shared memory aggregation per lead from existing Growth AI OS sources. Deterministic completeness scoring, conflict detection, and agent-specific context views. Command Center and Mission Planning Review visibility. No memory writes, execution, scheduler, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4C — Agent Event & Scheduling Framework**
Read-only agent event model, deterministic routing, scheduling mode definitions (all inactive), event queue partitions, Revenue Operator event consumption, Command Center and Mission Planning Review visibility. Recommendation-only — no agent execution, scheduler activation, runtime, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4B — Revenue Operator Orchestration Engine**
Read-only orchestration layer for the Revenue Operator supervisor: ownership resolver, handoff contracts, orchestration decisions, Command Center visibility, and Mission Planning Review context. Recommendation-only — no agent execution, scheduler, runtime, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-4A — Agent Framework Foundation**
Shared read-only agent registry, permissions, run contracts, scheduler placeholders, and telemetry for Growth AI OS. Agents coordinate intent; execution runtime enforces gates. No execution, outbound, providers, Work Orders, or Core mutations. Status: **Complete (local cert)**.

**GE-AIOS-GROWTH-3C — Execution Runtime Pilot**
Single-workflow runtime pilot for `research_company` only. Requires global runtime + pilot flags and dry-run pass before enqueue. Persists lifecycle via existing AI OS events. No outbound/providers/Core/Work Orders. Status: **Complete (local cert)**.

**GE-AIOS-GROWTH-3B — Internal Workflow Dry Run Harness**  
Deterministic dry-run for internal workflows on top of 3A runtime gates and steps. No persistence, no events, no outbound/providers/Core/Work Orders. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-3A — Execution Runtime Foundation**  
First phase permitted to mutate execution state for `internal_mutation_only` workflows. Runtime disabled by default; no outbound, providers, or Core. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-2C — Execution Simulation Engine**  
In-memory execution prediction for approved plans before any runtime implementation. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-2B — Execution Guardrail Preflight Checklist**  
Deterministic guardrail preflight audit before any future runtime implementation. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-2A — Execution Runtime Boundary Audit**  
Read-only audit of future execution pathways, guardrails, and risk classifications before any runtime is built. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-1F — Future Execution Handoff Contract**  
Read-only handoff specification for approved execution plans with provider/guardrail requirements. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-1E — Approved Plan Readiness & Audit Trail**  
Read-only readiness and audit trail for operator-approved execution plans. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-1D — Execution Plan Approval Queue**  
Operator review queue for execution plans with deterministic approval states and AI OS event persistence. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-1C — Next Best Action Workflow Planner**  
Deterministic Execution Plan from Next Best Action with canonical workflow mapping, readiness, and Command Center / Planning Review surfacing. Status: **Complete (local cert)**.

### Previous phase

**GE-AIOS-GROWTH-1B — Opportunity Assessment**  
Deterministic business-grade assessment after qualification with Next Best Action and Command Center surfacing. Status: **Complete (local cert)**.

### Prior phase

**GE-AIOS-GROWTH-1A — Growth Lead Research Workflow**  
Canonical `growth_lead_research` workflow with status, qualification, and Command Center surfacing. Status: **Complete (local cert)**.

### Next phases (ordered)

| Phase | Title |
|-------|-------|
| GE-AI-2A | Decision Record Foundation | Complete via GE-AIOS-2D |
| GE-AI-2B | Event Bus Unification | Partial (foundation in GE-AIOS-2B) |
| GE-AI-2C | Work Order System (remaining) | Partial (DR gate + Executive delegation in 2E/2G) |
| GE-AI-2D | Memory Facade | Complete via GE-AIOS-2F |
| GE-AI-2E | Priority Engine Binding |
| GE-AI-2F | Meta-Recommender |
| GE-AI-2G | Mission UI & Operator Experience |
| GE-AI-2H | L3 Approval Flow |
| GE-AI-2I | L4 Supervised Outbound |
| GE-AI-2J | Learning Loop |

Detail per phase: Implementation Ledger.

### Legacy GE-AUTO / Growth v1 (pre-constitution)

GE-AUTO-1A through 2I implemented locally; GE-AUTO-3 not started. See manual before § Growth Engine Autonomy System.

---

## 9. Production certifications

| Certification | Verdict | Date |
|---------------|---------|------|
| Growth Engine Autonomy | `GROWTH_ENGINE_AUTONOMY_READY_WITH_MINOR_FOLLOWUPS` | 2026-06-23 |
| AI Revenue Operator Constitution | Architecture certified (GE-AI-1E + 1F) | 2026-06-25 |
| GE-AIOS-2A AI Work Order Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2B AI Event Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2C AI Agent Runtime Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2D Decision Record Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2E Decision Gate for Work Orders | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2F Memory Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2G Executive Brain Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2H Decision Engine Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2I Decision Engine Execution Bridge | **PASS (local)** | 2026-06-25 |
| GE-AIOS-2J Context Assembly Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3A LLM Provider Abstraction | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3B AI Decision Intelligence Bridge | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3C Executive Decision Preparation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3D Executive Mission Planning Tick | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3E Mission Planning Review Surface | **PASS (local)** | 2026-06-25 |
| GE-AIOS-3F AI OS Stack Certification (2A–3E) | **PASS (local)** | 2026-06-25 |
| GE-AIOS-4A Lead Research Pilot | **PASS (local)** | 2026-06-25 |
| GE-AIOS-5A Executive Planning Report | **PASS (local)** | 2026-06-25 |
| GE-AIOS-URL-1 Public route namespace | **PASS (local)** | 2026-06-25 |
| GE-AIOS-5B Executive Planning Review UX | **PASS (local)** | 2026-06-25 |
| GE-AIOS-5C AI OS Command Center | **PASS (local)** | 2026-06-25 |
| GE-AIOS-5D AI OS Daily Briefing | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1A Growth Lead Research workflow | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1B Opportunity Assessment | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1C Execution Plan | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1D Execution Plan Approval Queue | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1E Approved Plan Readiness | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-1F Future Execution Handoff | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-2A Execution Boundary Audit | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-2B Execution Preflight Checklist | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-2C Execution Simulation Engine | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-3A Execution Runtime Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-3B Internal Workflow Dry Run | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-3C Execution Runtime Pilot | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4A Agent Framework Foundation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4B Revenue Operator Orchestration | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4C Agent Event & Scheduling | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4D Agent Memory & Shared Context | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4E Mission & Goal Planning | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-4F Mission Prioritization & Allocation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-5A Scheduler Readiness & Activation | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-5B Autonomous Research Agent Pilot | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-5C Autonomous Qualification Agent Pilot | **PASS (local)** | 2026-06-25 |
| GE-AIOS-GROWTH-5D Autonomous Planning Agent Pilot | **PASS (local)** | 2026-06-25 |
| GE-AIOS-CONSOLIDATION-1B AI Operations Information Architecture | **PASS (local)** | 2026-06-25 |
| GE-AIOS-CONSOLIDATION-1C Autonomy Control Plane | **PASS (local)** | 2026-06-25 |
| GE-AIOS-CONSOLIDATION-1E Policy Evaluation Unification | **PASS (local)** | 2026-06-25 |
| GE-AI-2A+ implementation (production) | Pending | — |

Outbound operational readiness: `docs/GROWTH_OUTBOUND_OPERATIONAL_READINESS.md`

---

## 10. Current runtime state

### Objectives / Mission runtime

- Scheduler: 45 min stall detection; 50 objectives/tick cap.
- Event router: dedupe, kill switches (`growth-objective-event-router.ts`).
- Stages: discover → … → complete (10 stages).

### Autonomy (GE-AUTO)

- Policy engine, platform kill switches, actor/sender identity (2G/2I).
- Safety: autonomous outbound not broadly enabled; approvals disabled; budgets 0.

### Outbound plane

- Google mailbox + transport orchestrator live; Microsoft preview-only.
- Warmup execution disabled; unified pre-send gate.

### AI Work Orders (GE-AIOS-2A)

- Tables: `growth.ai_work_orders`, `growth.ai_work_order_events` (migration local, not deployed)
- Service: `lib/growth/aios/ai-work-order-*.ts` — create, transition, cancel, retry, archive (infrastructure only)

### AI OS Events (GE-AIOS-2B)

- Tables: `growth.ai_os_events`, `ai_os_event_subscriptions`, `ai_os_event_deliveries`, `ai_os_event_archive_records`
- Service: `lib/growth/aios/ai-event-*.ts` — publish, subscribe, pull/consume, replay, archive (infrastructure only)
- Bridge: `ai-event-bridge.ts` — optional legacy normalization (not auto-wired)
- Decision Engine + Executive Brain infrastructure local; execution bridge wired at WO `executing` transition; not cron/API wired

### AI Agent Runtime (GE-AIOS-2C)

- Tables: `ai_os_agent_registrations`, `ai_os_agent_capabilities`, `ai_os_agent_leases`, `ai_os_agent_heartbeat_events`
- Service: `lib/growth/aios/ai-agent-runtime-*.ts` — register, heartbeat, claim, release, fail, escalate, retry hooks
- Health: stale heartbeat detection + lease expiry recovery
- Publishes agent events via GE-AIOS-2B; claims work orders via GE-AIOS-2A
- No business logic, LLMs, or Executive Brain

### Decision Records (GE-AIOS-2D)

- Tables: `growth.ai_decision_records`, `growth.ai_decision_record_audit_events`
- Service: `lib/growth/aios/ai-decision-record-*.ts` — create, supersede, link, query (infrastructure only)
- Immutable: insert-only; corrections emit new rows with `supersedes_decision_id`
- Links to Work Orders via `decision_record_ids[]`; publishes `decision.*` events
- No Decision Engine, Meta-Recommender, or AI reasoning

### Decision Gate (GE-AIOS-2E)

- Service: `lib/growth/aios/ai-decision-gate-*.ts` — validates records before `executing`
- Enforced via execution bridge in `transitionAiWorkOrder`; agent claim path inherits gate
- Publishes `decision.gate_passed` / `decision.gate_blocked`; blocks without creating records
- No Decision Engine, Meta-Recommender, or AI reasoning

### Memory Registry (GE-AIOS-2F)

- Tables: `growth.ai_memory_registry`, `growth.ai_memory_registry_events`
- Service: `lib/growth/aios/ai-memory-registry-*.ts` — register, reference, link, archive, query
- Metadata only — references existing Growth stores via `source_system` / `source_table` / `source_record_id`
- Links to Work Orders via `memory_refs[]` and Decision Records via audit events
- Publishes `memory.*` events; no summarization, learning, or AI invocation

### Executive Brain (GE-AIOS-2G)

- Tables: `growth.ai_executive_brain_runtime`, mission state, delegations, observations
- Service: `lib/growth/aios/ai-executive-brain-*.ts` — start, delegate, monitor, escalate, complete
- Creates Work Orders (`ownerAgent: executive_brain`); never claims via Agent Runtime
- Optional `prepareDecision` on delegation invokes Decision Engine to attach Decision Records (GE-AIOS-3C)
- Subscribes to work_order/agent/decision/memory events; publishes `executive.*`
- No AI reasoning, LLMs, or provider calls

### Decision Engine (GE-AIOS-2H)

- Tables: `growth.ai_decision_engine_runtime`, `growth.ai_decision_engine_requests`
- Service: `lib/growth/aios/ai-decision-engine-*.ts` — evaluate, create Decision Records
- Rule-based evidence collector, confidence/risk/cost calculators (no LLMs)
- Reads Work Orders + Memory Registry refs; publishes `decision.requested`, `decision.evaluated`
- Degraded mode per §11.6; does not execute or delegate Work Orders

### Decision Engine Execution Bridge (GE-AIOS-2I)

- Service: `lib/growth/aios/ai-decision-execution-bridge-*.ts` — orchestrates engine + gate before execute
- Invokes `runAiDecisionEngineForWorkOrder` when Decision Records missing; skips when executable DR exists
- Blocks on degraded mode, insufficient evidence, or post-engine gate failure
- Publishes `decision.engine_invoked`, `decision.engine_skipped_existing_record`, `decision.engine_blocked_execution`, `decision.execution_bridge_completed`
- Wired in `transitionAiWorkOrder` when `toStatus === "executing"`; Agent Runtime claim path inherits bridge

### Context Assembly (GE-AIOS-2J)

- Tables: `growth.ai_context_assembly_runtime`, `growth.ai_context_packages`
- Service: `lib/growth/aios/ai-context-assembly-*.ts` — assemble, validate, checksum, reuse
- Gathers read-only context from Work Orders, missions, Decision Records, Memory Registry, events, entity intelligence
- Immutable Context Packages with version + SHA-256 checksum; publishes `context.assembled`, `context.reused`, `context.validation_failed`
- Does not invoke LLMs, execute Work Orders, or create Decision Records

### LLM Provider Abstraction (GE-AIOS-3A)

- Tables: `growth.ai_provider_runtime`, `growth.ai_provider_requests`
- Service: `lib/growth/aios/ai-provider-*.ts` — selection, failover, normalized responses
- Sole AI OS gateway: `invokeAiOsProviderWithContextPackage` — Context Package in, normalized response out
- Adapters delegate to Core `lib/ai/providers` (OpenAI, Anthropic, Gemini) — no duplicate SDK clients
- Publishes `ai.requested`, `ai.completed`, `ai.failed`, `ai.provider_degraded`, `ai.provider_switched`
- Decision Engine and Executive Brain do not call providers directly

### AI Decision Intelligence Bridge (GE-AIOS-3B)

- Service: `lib/growth/aios/ai-decision-intelligence-bridge-*.ts` — optional AI evidence for Decision Engine
- Flow: `assembleAiContextForWorkOrder` → `invokeAiOsProviderWithContextPackage` → evidence → rule engine
- Opt-in via `enableAiEvidence` on `runAiDecisionEngineForWorkOrder`; provider failure falls back to rule-only
- Publishes `decision.ai_context_requested`, `decision.ai_evidence_added`, `decision.ai_evidence_failed`
- AI output is advisory evidence (`advisory_only: true`) — rule engine remains authoritative

### Executive Decision Preparation (GE-AIOS-3C)

- Service: `lib/growth/aios/ai-executive-decision-preparation-*.ts`
- `delegateAiExecutiveWorkOrder({ prepareDecision: true })` → Decision Engine → Decision Record linked
- Optional `enableAiEvidence` passes through to Decision Engine (3B bridge)
- Publishes `executive.decision_preparation_started`, `executive.decision_prepared`, `executive.decision_preparation_failed`
- Does not claim Work Orders or transition to `executing` — Agent Runtime + Decision Gate handle execution later

### Executive Mission Planning Tick (GE-AIOS-3D)

- Service: `lib/growth/aios/ai-executive-mission-planning-*.ts` — `runExecutiveMissionPlanningTick`
- Loads mission state + existing Work Orders; proposes constitutional WO types by stage
- `mode: dry_run` proposes only; `mode: create` delegates via Executive Brain
- Duplicate prevention by `workOrderType:entityType:entityId` against active Work Orders
- Optional `prepareDecision` / `enableAiEvidence`; no cron wiring yet
- Publishes `executive.planning_tick_*`, `executive.work_order_proposed`

### Mission Planning Review Surface (GE-AIOS-3E)

- Service: `lib/growth/aios/ai-executive-mission-planning-review-*.ts`
- GET read model: mission + active Work Orders (no tick)
- POST preview: dry-run via `runExecutiveMissionPlanningTick`; emits `executive.planning_review_created`
- POST approve: explicit operator create; emits `executive.planning_review_approved`
- UI: `/growth/os` Command Center (read-only home + Daily Briefing)
- UI: `/growth/os/missions/[missionId]/planning` (legacy `/growth/ai-os/...` redirects)
- Optional `prepareDecision` / `enableAiEvidence` on approve only — never on preview
- **GE-AIOS-5A:** GET read model includes read-only `executivePlanningReport` (strategy intelligence)
- **GE-AIOS-5B:** Planning Review UI is an executive dashboard (summary KPIs, roadmap, approval-first)

### Executive Planning Report (GE-AIOS-5A)

- Service: `lib/growth/aios/ai-executive-planning-report-*.ts` — `fetchAiExecutivePlanningReport`
- Synthesizes mission analysis, multi-step strategy, outcomes, risks from objective planner + mission planner + context assembly reads
- Displayed above Work Order preview on Planning Review UI — no execution, providers, or tick side effects
- Cert: `pnpm test:ge-aios-5a-executive-planning-report-foundation`

### AI OS Stack Certification (GE-AIOS-3F)

- Meta cert: `pnpm test:ge-aios-3f-stack-certification-foundation` (re-runs 2A–3E)
- 9 migrations in strict order; 2E/2I/3B–3E service-layer only
- Ready for commit/migration review — no autonomous execution exposed

### Lead Research Pilot (GE-AIOS-4A)

- Orchestrator: `lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts`
- Trigger: `createGrowthLead` → `scheduleLeadResearchPilotForProspect` (feature-flagged)
- Flow: planning tick → research_company WO → decision prep → agent claim → context → provider → save research
- Observation: `/growth/os/pilot/lead-research/[leadId]` (legacy `/growth/ai-os/...` redirects)
- Flags: `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED`, optional `GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE`

### Not yet runtime-bound to Constitution

Meta-Recommender supremacy, Priority formula as sole authority.

---

## 11. Outstanding risks

| Risk | Severity | Mitigation phase |
|------|----------|------------------|
| Architectural duplication in production | High | GE-AI-2B, 2F |
| Lead Engine not wired to LLM | High | GE-AI-2I+ |
| Autonomy enabled without Decision Records | Critical | Mitigated by GE-AIOS-2I bridge (local) |
| Feature registry not enforced | Medium | 8H + GE-AI-2F |
| Scale (>50 missions) | Low (v1) | GE-AI-3G+ amendment |

---

## 12. Current priorities

### AI Revenue Operator (engineering)

1. GE-AI-2F Meta-Recommender / Decision Engine binding  
2. Wire legacy NBA → Decision Record creation (presenter only)  
3. Bridge legacy objective runtime → AI OS Executive Brain tick  
4. Do not enable L3+ send until approval flow certified  

### Core product (platform)

Roadmap from product direction (flexible sequencing):

- Customer CSV import  
- Parent/child customer hierarchy  
- Service-to-invoice linkage  
- Terms-based due dates  
- US jurisdiction tax logic  
- Certificate attachments / release rules  
- Scheduling / dispatch improvements  
- Role and permission controls depth  

Full list: `lib/admin/master-context.manual.after.md` § Current Priorities.

---

## 13. References

### Canonical documentation (use these first)

| Document | Purpose |
|----------|---------|
| [AI Revenue Operator Constitution v1.0](./architecture/AI_REVENUE_OPERATOR_CONSTITUTION_v1.0.md) | Permanent architecture — frozen |
| [Master Context Document](./MASTER_CONTEXT_DOCUMENT.md) | Living engineering state (this file) |
| [Implementation Ledger](./AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md) | Phase-by-phase implementation traceability |
| [Documentation Foundation](./GE-DOC-1_DOCUMENTATION_FOUNDATION.md) | Relationships, freeze, workflow |
| [GE-AIOS-2A Certification](./GE-AIOS-2A_CERTIFICATION.md) | AI Work Order foundation cert |
| [GE-AIOS-2B Certification](./GE-AIOS-2B_CERTIFICATION.md) | AI Event foundation cert |
| [GE-AIOS-2C Certification](./GE-AIOS-2C_CERTIFICATION.md) | AI Agent Runtime foundation cert |
| [GE-AIOS-2D Certification](./GE-AIOS-2D_CERTIFICATION.md) | Decision Record foundation cert |
| [GE-AIOS-2E Certification](./GE-AIOS-2E_CERTIFICATION.md) | Decision Gate cert |
| [GE-AIOS-2F Certification](./GE-AIOS-2F_CERTIFICATION.md) | Memory Registry cert |
| [GE-AIOS-2G Certification](./GE-AIOS-2G_CERTIFICATION.md) | Executive Brain cert |
| [GE-AIOS-2H Certification](./GE-AIOS-2H_CERTIFICATION.md) | Decision Engine cert |
| [GE-AIOS-2H Infrastructure Audit](./GE-AIOS-2H_INFRASTRUCTURE_AUDIT.md) | NBA/recommendation audit |
| [GE-AIOS-2I Certification](./GE-AIOS-2I_CERTIFICATION.md) | Decision Engine execution bridge cert |
| [GE-AIOS-2I Infrastructure Audit](./GE-AIOS-2I_INFRASTRUCTURE_AUDIT.md) | WO execute path audit |
| [GE-AIOS-2J Certification](./GE-AIOS-2J_CERTIFICATION.md) | Context Assembly cert |
| [GE-AIOS-2J Infrastructure Audit](./GE-AIOS-2J_INFRASTRUCTURE_AUDIT.md) | Context source audit |
| [GE-AIOS-3A Certification](./GE-AIOS-3A_CERTIFICATION.md) | LLM Provider Abstraction cert |
| [GE-AIOS-3A Infrastructure Audit](./GE-AIOS-3A_INFRASTRUCTURE_AUDIT.md) | Core adapter reuse audit |
| [GE-AIOS-3B Certification](./GE-AIOS-3B_CERTIFICATION.md) | Decision Intelligence Bridge cert |
| [GE-AIOS-3B Infrastructure Audit](./GE-AIOS-3B_INFRASTRUCTURE_AUDIT.md) | AI evidence enrichment audit |
| [GE-AIOS-3C Certification](./GE-AIOS-3C_CERTIFICATION.md) | Executive Decision Preparation cert |
| [GE-AIOS-3C Infrastructure Audit](./GE-AIOS-3C_INFRASTRUCTURE_AUDIT.md) | Executive DR prep audit |
| [GE-AIOS-3D Certification](./GE-AIOS-3D_CERTIFICATION.md) | Executive Mission Planning Tick cert |
| [GE-AIOS-3D Infrastructure Audit](./GE-AIOS-3D_INFRASTRUCTURE_AUDIT.md) | Mission planning tick audit |
| [GE-AIOS-3E Certification](./GE-AIOS-3E_CERTIFICATION.md) | Mission Planning Review Surface cert |
| [GE-AIOS-3E Infrastructure Audit](./GE-AIOS-3E_INFRASTRUCTURE_AUDIT.md) | Planning review surface audit |
| [GE-AIOS-3F Certification](./GE-AIOS-3F_CERTIFICATION.md) | Full stack certification (2A–3E) |
| [GE-AIOS-3F Migration Readiness](./GE-AIOS-3F_MIGRATION_READINESS.md) | Migration apply checklist |
| [GE-AIOS-3F File Impact](./GE-AIOS-3F_FILE_IMPACT_SUMMARY.md) | File impact summary |
| [GE-AIOS-3F Known Risks](./GE-AIOS-3F_KNOWN_RISKS.md) | Risks and deferred items |
| [GE-AIOS-4A Certification](./GE-AIOS-4A_CERTIFICATION.md) | Lead Research Pilot cert |
| [GE-AIOS-5A Certification](./GE-AIOS-5A_CERTIFICATION.md) | Executive Planning Report cert |
| [GE-AIOS-URL-1 Certification](./GE-AIOS-URL-1_CERTIFICATION.md) | Public route namespace cert |
| [GE-AIOS-URL-1 Infrastructure Audit](./GE-AIOS-URL-1_INFRASTRUCTURE_AUDIT.md) | Route rename audit |
| [GE-AIOS-5B Certification](./GE-AIOS-5B_CERTIFICATION.md) | Executive Planning Review UX cert |
| [GE-AIOS-5B Infrastructure Audit](./GE-AIOS-5B_INFRASTRUCTURE_AUDIT.md) | Planning Review UX audit |
| [GE-AIOS-5C Certification](./GE-AIOS-5C_CERTIFICATION.md) | Command Center cert |
| [GE-AIOS-5C Infrastructure Audit](./GE-AIOS-5C_INFRASTRUCTURE_AUDIT.md) | Command Center audit |
| [GE-AIOS-5D Certification](./GE-AIOS-5D_CERTIFICATION.md) | Daily Briefing cert |
| [GE-AIOS-5D Infrastructure Audit](./GE-AIOS-5D_INFRASTRUCTURE_AUDIT.md) | Daily Briefing audit |
| [GE-AIOS-GROWTH-1A Certification](./GE-AIOS-GROWTH-1A_CERTIFICATION.md) | Growth workflow cert |
| [GE-AIOS-GROWTH-1A Infrastructure Audit](./GE-AIOS-GROWTH-1A_INFRASTRUCTURE_AUDIT.md) | Growth workflow audit |
| [GE-AIOS-GROWTH-1B Certification](./GE-AIOS-GROWTH-1B_CERTIFICATION.md) | Opportunity Assessment cert |
| [GE-AIOS-GROWTH-1B Infrastructure Audit](./GE-AIOS-GROWTH-1B_INFRASTRUCTURE_AUDIT.md) | Opportunity Assessment audit |
| [GE-AIOS-GROWTH-1C Certification](./GE-AIOS-GROWTH-1C_CERTIFICATION.md) | Execution Plan cert |
| [GE-AIOS-GROWTH-1C Infrastructure Audit](./GE-AIOS-GROWTH-1C_INFRASTRUCTURE_AUDIT.md) | Execution Plan audit |
| [GE-AIOS-GROWTH-1D Certification](./GE-AIOS-GROWTH-1D_CERTIFICATION.md) | Approval Queue cert |
| [GE-AIOS-GROWTH-1D Infrastructure Audit](./GE-AIOS-GROWTH-1D_INFRASTRUCTURE_AUDIT.md) | Approval Queue audit |
| [GE-AIOS-GROWTH-1E Certification](./GE-AIOS-GROWTH-1E_CERTIFICATION.md) | Approved Plan Readiness cert |
| [GE-AIOS-GROWTH-1E Infrastructure Audit](./GE-AIOS-GROWTH-1E_INFRASTRUCTURE_AUDIT.md) | Approved Plan Readiness audit |
| [GE-AIOS-GROWTH-1F Certification](./GE-AIOS-GROWTH-1F_CERTIFICATION.md) | Handoff Contract cert |
| [GE-AIOS-GROWTH-1F Infrastructure Audit](./GE-AIOS-GROWTH-1F_INFRASTRUCTURE_AUDIT.md) | Handoff Contract audit |
| [GE-AIOS-GROWTH-2A Certification](./GE-AIOS-GROWTH-2A_CERTIFICATION.md) | Boundary Audit cert |
| [GE-AIOS-GROWTH-2A Infrastructure Audit](./GE-AIOS-GROWTH-2A_INFRASTRUCTURE_AUDIT.md) | Boundary Audit audit |
| [GE-AIOS-GROWTH-2B Certification](./GE-AIOS-GROWTH-2B_CERTIFICATION.md) | Preflight Checklist cert |
| [GE-AIOS-GROWTH-2B Infrastructure Audit](./GE-AIOS-GROWTH-2B_INFRASTRUCTURE_AUDIT.md) | Preflight Checklist audit |
| [GE-AIOS-GROWTH Execution Boundary Matrix](./GE-AIOS-GROWTH_EXECUTION_BOUNDARY_MATRIX.md) | Workflow boundary matrix |
| [GE-AIOS-GROWTH Execution Preflight Checklist](./GE-AIOS-GROWTH_EXECUTION_PREFLIGHT_CHECKLIST.md) | Workflow preflight checklist |
| [GE-AIOS-GROWTH-2C Certification](./GE-AIOS-GROWTH-2C_CERTIFICATION.md) | Execution Simulation cert |
| [GE-AIOS-GROWTH-2C Infrastructure Audit](./GE-AIOS-GROWTH-2C_INFRASTRUCTURE_AUDIT.md) | Execution Simulation audit |
| [GE-AIOS-GROWTH-3A Certification](./GE-AIOS-GROWTH-3A_CERTIFICATION.md) | Execution Runtime cert |
| [GE-AIOS-GROWTH-3A Runtime Architecture](./GE-AIOS-GROWTH-3A_RUNTIME_ARCHITECTURE.md) | Execution Runtime architecture |
| [GE-AIOS-GROWTH-3A Infrastructure Audit](./GE-AIOS-GROWTH-3A_INFRASTRUCTURE_AUDIT.md) | Execution Runtime audit |
| [GE-AIOS-GROWTH-3B Certification](./GE-AIOS-GROWTH-3B_CERTIFICATION.md) | Internal workflow dry-run cert |
| [GE-AIOS-GROWTH-3B Infrastructure Audit](./GE-AIOS-GROWTH-3B_INFRASTRUCTURE_AUDIT.md) | Dry-run infrastructure audit |
| [GE-AIOS-GROWTH-3C Certification](./GE-AIOS-GROWTH-3C_CERTIFICATION.md) | Runtime pilot cert |
| [GE-AIOS-GROWTH-3C Runtime Pilot](./GE-AIOS-GROWTH-3C_RUNTIME_PILOT.md) | Runtime pilot architecture |
| [GE-AIOS-GROWTH-3C Infrastructure Audit](./GE-AIOS-GROWTH-3C_INFRASTRUCTURE_AUDIT.md) | Runtime pilot audit |
| [GE-AIOS-GROWTH-4A Certification](./GE-AIOS-GROWTH-4A_CERTIFICATION.md) | Agent framework cert |
| [GE-AIOS-GROWTH-4A Agent Framework](./GE-AIOS-GROWTH-4A_AGENT_FRAMEWORK.md) | Agent framework architecture |
| [GE-AIOS-GROWTH-4A Infrastructure Audit](./GE-AIOS-GROWTH-4A_INFRASTRUCTURE_AUDIT.md) | Agent framework audit |
| [GE-AIOS-GROWTH-4B Certification](./GE-AIOS-GROWTH-4B_CERTIFICATION.md) | Revenue Operator orchestration cert |
| [GE-AIOS-GROWTH-4B Revenue Operator](./GE-AIOS-GROWTH-4B_REVENUE_OPERATOR.md) | Orchestration architecture |
| [GE-AIOS-GROWTH-4B Infrastructure Audit](./GE-AIOS-GROWTH-4B_INFRASTRUCTURE_AUDIT.md) | Orchestration audit |
| [GE-AIOS-GROWTH-4C Certification](./GE-AIOS-GROWTH-4C_CERTIFICATION.md) | Agent events cert |
| [GE-AIOS-GROWTH-4C Agent Events](./GE-AIOS-GROWTH-4C_AGENT_EVENTS.md) | Event architecture |
| [GE-AIOS-GROWTH-4C Infrastructure Audit](./GE-AIOS-GROWTH-4C_INFRASTRUCTURE_AUDIT.md) | Event framework audit |
| [GE-AIOS-GROWTH-4D Certification](./GE-AIOS-GROWTH-4D_CERTIFICATION.md) | Agent memory cert |
| [GE-AIOS-GROWTH-4D Agent Memory](./GE-AIOS-GROWTH-4D_AGENT_MEMORY.md) | Shared memory architecture |
| [GE-AIOS-GROWTH-4D Infrastructure Audit](./GE-AIOS-GROWTH-4D_INFRASTRUCTURE_AUDIT.md) | Memory audit |
| [GE-AIOS-GROWTH-4E Certification](./GE-AIOS-GROWTH-4E_CERTIFICATION.md) | Mission framework cert |
| [GE-AIOS-GROWTH-4E Mission Framework](./GE-AIOS-GROWTH-4E_MISSION_FRAMEWORK.md) | Mission architecture |
| [GE-AIOS-GROWTH-4E Infrastructure Audit](./GE-AIOS-GROWTH-4E_INFRASTRUCTURE_AUDIT.md) | Mission audit |
| [GE-AIOS-GROWTH-4F Certification](./GE-AIOS-GROWTH-4F_CERTIFICATION.md) | Priority engine cert |
| [GE-AIOS-GROWTH-4F Priority Engine](./GE-AIOS-GROWTH-4F_PRIORITY_ENGINE.md) | Prioritization architecture |
| [GE-AIOS-GROWTH-4F Infrastructure Audit](./GE-AIOS-GROWTH-4F_INFRASTRUCTURE_AUDIT.md) | Priority audit |
| [GE-AIOS-GROWTH-5A Certification](./GE-AIOS-GROWTH-5A_CERTIFICATION.md) | Scheduler readiness cert |
| [GE-AIOS-GROWTH-5A Scheduler Readiness](./GE-AIOS-GROWTH-5A_SCHEDULER_READINESS.md) | Scheduler architecture |
| [GE-AIOS-GROWTH-5A Infrastructure Audit](./GE-AIOS-GROWTH-5A_INFRASTRUCTURE_AUDIT.md) | Scheduler audit |
| [GE-AIOS-GROWTH-5B Certification](./GE-AIOS-GROWTH-5B_CERTIFICATION.md) | Autonomous research cert |
| [GE-AIOS-GROWTH-5B Autonomous Research Agent](./GE-AIOS-GROWTH-5B_AUTONOMOUS_RESEARCH_AGENT.md) | Pilot architecture |
| [GE-AIOS-GROWTH-5B Infrastructure Audit](./GE-AIOS-GROWTH-5B_INFRASTRUCTURE_AUDIT.md) | Pilot audit |
| [GE-AIOS-GROWTH-5C Certification](./GE-AIOS-GROWTH-5C_CERTIFICATION.md) | Autonomous qualification cert |
| [GE-AIOS-GROWTH-5C Autonomous Qualification Agent](./GE-AIOS-GROWTH-5C_AUTONOMOUS_QUALIFICATION_AGENT.md) | Qualification pilot architecture |
| [GE-AIOS-GROWTH-5C Infrastructure Audit](./GE-AIOS-GROWTH-5C_INFRASTRUCTURE_AUDIT.md) | Qualification pilot audit |
| [GE-AIOS-GROWTH-5D Certification](./GE-AIOS-GROWTH-5D_CERTIFICATION.md) | Autonomous planning cert |
| [GE-AIOS-GROWTH-5D Autonomous Planning Agent](./GE-AIOS-GROWTH-5D_AUTONOMOUS_PLANNING_AGENT.md) | Planning pilot architecture |
| [GE-AIOS-GROWTH-5D Infrastructure Audit](./GE-AIOS-GROWTH-5D_INFRASTRUCTURE_AUDIT.md) | Planning pilot audit |
| [GE-AIOS-GROWTH Internal Workflow Dry Run](./GE-AIOS-GROWTH_INTERNAL_WORKFLOW_DRY_RUN.md) | Dry-run operator guide |
| [GE-AIOS-GROWTH Execution Simulation](./GE-AIOS-GROWTH_EXECUTION_SIMULATION.md) | Execution simulation reference |

### Legacy / generated inventory

| Path | Purpose |
|------|---------|
| `lib/admin/master-context.manual.before.md` | Module inventory, GE-AUTO detail, API summary |
| `lib/admin/master-context.manual.after.md` | Integrations status, UI standards, priorities |
| `lib/admin/master-context.generated.ts` | Auto-scanned file inventory |

### Growth Engine operational docs

- `docs/GROWTH_OUTBOUND_OPERATIONAL_READINESS.md`
- `docs/SETTINGS_WIRING_AUDIT.md`
- `docs/PERMISSIONS_ENFORCEMENT_AUDIT.md`
- Phase-specific `docs/GROWTH_*.md` (historical implementation records)

### Prompting instruction

Use Constitution for **what** and **why**; use this document for **current state** and **what to build next**. Never embed secrets. After meaningful commits, run `pnpm update:master-context`.

---

*Master Context Document — living engineering reference. Architecture: Constitution v1.0 (frozen).*
