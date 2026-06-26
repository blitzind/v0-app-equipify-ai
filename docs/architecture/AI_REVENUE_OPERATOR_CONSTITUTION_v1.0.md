# AI Revenue Operator Constitution

**Version:** 1.0  
**Status:** Frozen  
**Effective:** 2026-06-25  
**Supersedes:** Ad-hoc architectural discussion, duplicated master-context architecture sections  
**Authority:** All Growth Engine implementation (GE-AI-2X+) must conform to this document

---

## Document control

| Field | Value |
|-------|--------|
| Architecture phase | GE-AI-1X (complete) |
| Engineering phase | GE-AI-2X (beginning) |
| Baseline audit | Autonomy Audit (June 2026) |
| Amendment process | See [Section 20](#20-future-amendment-process) |
| Living engineering state | `docs/MASTER_CONTEXT_DOCUMENT.md` |
| Implementation tracking | `docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md` |

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Vision](#2-vision)
3. [Guiding principles](#3-guiding-principles)
4. [Architecture overview](#4-architecture-overview)
5. [Autonomy audit summary](#5-autonomy-audit-summary)
6. [Master architecture (GE-AI-1A)](#6-master-architecture-ge-ai-1a)
7. [Decision framework (GE-AI-1B)](#7-decision-framework-ge-ai-1b)
8. [Memory architecture (GE-AI-1C)](#8-memory-architecture-ge-ai-1c)
9. [Operating system (GE-AI-1D)](#9-operating-system-ge-ai-1d)
10. [Consistency review (GE-AI-1E)](#10-consistency-review-ge-ai-1e)
11. [Glossary & binding addendum (GE-AI-1F)](#11-glossary--binding-addendum-ge-ai-1f)
12. [Agent architecture](#12-agent-architecture)
13. [Decision architecture](#13-decision-architecture)
14. [Memory architecture](#14-memory-architecture)
15. [Operating system](#15-operating-system)
16. [Implementation contracts](#16-implementation-contracts)
17. [Architectural invariants](#17-architectural-invariants)
18. [Canonical glossary](#18-canonical-glossary)
19. [Governance](#19-governance)
20. [Future amendment process](#20-future-amendment-process)
21. [Version history](#21-version-history)

---

## 1. Introduction

The Equipify **Growth Engine** is evolving into an **AI Revenue Operator**: a mission-driven system that discovers prospects, qualifies accounts, executes multichannel outreach, manages conversations, creates pipeline, and learns from outcomes—with configurable autonomy and minimal operator involvement.

This Constitution is the **permanent architectural source of truth** for that evolution. It consolidates the GE-AI-1X architecture phase:

| Phase document | Role |
|----------------|------|
| Autonomy Audit | Baseline: what exists (~65–70% infrastructure) |
| GE-AI-1A | Who: agents, ownership, missions, autonomy levels |
| GE-AI-1B | How decisions are made |
| GE-AI-1C | What the AI knows (memory) |
| GE-AI-1D | How the AI operates over time (AIOS) |
| GE-AI-1E | Consistency validation |
| GE-AI-1F | Glossary, bindings, contracts, freeze |

**This document rarely changes.** Engineering status, certifications, and phase progress live elsewhere.

---

## 2. Vision

The operator assigns a **Mission**. The AI determines everything else.

```
Mission → Executive Brain → Specialized Agents → Existing Growth Engine → Providers → Revenue
```

The end state is not a CRM with AI features. It is an **AI Revenue Operator** that can autonomously: discover, qualify, enrich, research, personalize, execute outreach, monitor engagement, adapt strategy, book meetings, create opportunities, and learn—supervised only for exceptions.

---

## 3. Guiding principles

1. **Reuse everything** — Orchestrate existing subsystems; do not replace working systems.
2. **Evidence over intuition** — Every decision cites evidence; no silent judgment.
3. **Single ownership** — One owner per decision, subsystem, and memory type.
4. **Human trust through transparency** — Explainability, audit, operator override.
5. **Graduated autonomy** — Levels 0–5; Compliance veto is absolute.
6. **Mission-driven operation** — All work serves an Objective (machine) / Mission (operator).
7. **Agents sleep by default** — Event-driven wake; Conversation Agent always listens.
8. **Learning is async** — Never blocks execution.
9. **Safe Mode protects the business** — Outbound/spend halt; inbound continues.

---

## 4. Architecture overview

### 4.1 Layer model

```
Operator
  ↓
Executive Brain (AIOS)
  ↓
Scheduler · Priority Engine · Interrupt Handler · Health Monitor
  ↓
Mission Engine · Decision Engine · Memory System
  ↓
16 AI Agents
  ↓
Existing Growth Engine (~156 lib/growth domains, ~956 API routes)
  ↓
External Providers (Apollo, PDL, LLM, Transport, Twilio, …)
  ↓
Customers → Revenue
```

### 4.2 Three constitutional engines

| Engine | Role | Owner |
|--------|------|-------|
| **Decision Engine** | GE-AI-1B lifecycle, Meta-Recommender, governance | Infrastructure |
| **Memory System** | GE-AI-1C taxonomy, retrieval, summarization | Infrastructure |
| **Mission Engine** | Objective lifecycle, stages, runtime | Executive Brain |

### 4.3 Non-agents (infrastructure)

- **Human Approval FSM** — Execution gate (Executive Brain owns policy)
- **Lead Engine** — Per-lead pipeline spine (invoked by agents; LLM wiring is engineering dependency)
- **Event Bus** — AIOS canonical registry (Section 11.6)
- **Priority Engine** — Sole global Work Order priority authority

---

## 5. Autonomy audit summary

**Date:** June 2026  
**Infrastructure completeness:** ~65–70%  
**Autonomous operation readiness:** ~15–25% (by design)

### Strong foundations

Reply intelligence hub, multichannel execution (sequences, transport, SENDR), lead memory, playbook outcome learning, GE-AUTO autonomy framework, human approval FSM, prospect search + provider selection, scoring recompute chain, objectives runtime, certification harnesses.

### Architectural debt (named, not hidden)

- 10+ parallel recommendation engines → unify under Decision Engine Meta-Recommender
- 3+ event substrates → unify under Event Bus
- 3+ approval flows → unify under Human Approval FSM
- Lead Engine orchestrator: fixture dry-run (no LLM/outbound yet)
- Feature registry 8G documented, 8H enforcement pending
- Agent orchestration Tier 2 cold in registry; promoted constitutionally to Executive Brain staff

### Do not rebuild

Prospect search, enrichment orchestrators, inbox/reply intelligence, sequences, SENDR, copilot, autonomy types, objectives, transport orchestrator.

---

## 6. Master architecture (GE-AI-1A)

### 6.1 Executive Brain

**Never executes outbound.** Observes, prioritizes, delegates Work Orders, monitors agents, adapts missions, escalates exceptions.

Planning cycles: daily (micro), weekly (ROI/adaptation), monthly (forecast/portfolio).

### 6.2 Sixteen agents

| Agent | Primary domain |
|-------|----------------|
| Prospecting | Discovery, search, territory |
| Research | Company intel, AI research, signals, committee |
| Qualification | Scoring, verify, target/reject, primary contact |
| Strategy | Channel, cadence, sequence, pause/stop |
| Personalization | Content, playbooks, copilot |
| Outreach | Sequences, SENDR, transport, automation runtime |
| Conversation | Inbox, replies, calls, relationship memory |
| Meeting | Booking, prep, outcomes |
| Opportunity | Pipeline, deals, attribution |
| Learning | Org knowledge, outcomes, calibration |
| Executive Reporting | Briefings, revenue memory, dashboards |
| Compliance | Veto, suppression |
| Budget | Spend, envelopes, ROI gates |
| Provider | Provider selection, yield |
| Warmup | Ramp, mailbox send state |
| Deliverability | Domain health, throttle, rotation |

### 6.3 Mission = Objective

- **Mission** — Operator-facing goal (ICP, budget, deadline, goal, autonomy level)
- **Objective** — Code/DB alias only (`objectives/`, `GrowthObjective`)
- **Campaign** — Tactical: audience + sequence (+ SENDR); not a mission

Stages: `discover → research → enrich → buying_committee → generate_assets → launch → monitor → adapt → book → complete`

### 6.4 Autonomy levels (summary)

| Level | Name | Operator workload |
|-------|------|-------------------|
| 0 | Manual | 100% |
| 1 | AI Assist | ~80% |
| 2 | AI Recommend | ~60% |
| 3 | Executes with Approval | ~30% |
| 4 | Supervised Autonomous | ~10% |
| 5 | Fully Autonomous | ~2% |

Full GE-AUTO binding: [Section 11.10](#1110-canonical-autonomy-mapping).

---

## 7. Decision framework (GE-AI-1B)

### 7.1 Universal lifecycle

```
Observe → Collect Evidence → Normalize → Evaluate → Confidence → Risk → Cost
  → Revenue Impact → Choose Action → Explain → Execute/Escalate → Measure → Learn
```

### 7.2 Balance equation

```
Decision Score = f(Revenue, Confidence, Mission) − g(Risk, Cost, Compliance)
```

Compliance is absolute veto, not a weight.

### 7.3 Decision Record

Every non-trivial decision produces an immutable **Decision Record** (schema: Section 16). Fields include: decision_key, owner_agent, evidence_bundle, confidence 0–100, risk, cost, ROI, explanation, alternatives, outcome, learning hooks.

### 7.4 Meta-Recommender supremacy

All legacy recommendation engines (`next-best-action.ts`, prospect/opportunity/aiden/execution priority, etc.) are **candidate generators only**. Authority chain:

```
Candidates → Decision Engine Meta-Recommender → Decision Record → NBA/UI (presenter) → Work Order
```

---

## 8. Memory architecture (GE-AI-1C)

### 8.1 Hierarchy

**Data → Memory → Knowledge → Wisdom**

- **Memory** — Evidence-backed, agent-owned, entity/mission scoped
- **Knowledge** — Validated org patterns (Learning Agent + Knowledge Center)
- **Wisdom** — Executive Brain strategic judgment

### 8.2 Twenty-four memory types

Entity: Lead, Relationship, Conversation, Company, Research, Opportunity, Meeting  
Mission: Mission, Strategy, Campaign  
Organization: Organization, Industry, Playbook, Knowledge, Revenue, Executive  
Infrastructure: Provider, Budget, Deliverability, Mailbox, Sequence, Signal, Decision, Compliance, Risk, Operator Preference

### 8.3 Lifecycle

```
Observation → Created → Updated → Referenced → Summarized → Archived → Forgotten → Learning → Org Knowledge
```

Compliance, Decision logs, Operator preferences, Revenue events: **never forgotten**.

### 8.4 Dual-write exceptions

| Memory | Content owner | Effectiveness owner |
|--------|---------------|---------------------|
| Playbook | Personalization Agent | Learning Agent |
| Mailbox | Warmup Agent (ramp) | Deliverability Agent (reputation) |

---

## 9. Operating system (GE-AI-1D)

### 9.1 Executive loop (every 5 min + interrupts)

Wake → Review Missions → Priorities → Budgets → Risks → Inbox → Opportunities → Delegate → Monitor → Learn → Sleep

### 9.2 Work Order

Universal execution unit (schema: Section 16). Executive Brain issues; one Agent owns; requires Decision Record before execute (L1+).

**Adaptation cooldown:** 30 minutes after `mission.adapted` — no new discover/enrich Work Orders without operator override.

### 9.3 Interrupt levels

L0 Emergency → L5 Background. Events beat schedules. Safe Mode halts outbound/spend; inbound continues.

### 9.4 AIOS states

Idle, Planning, Execution, Learning, Maintenance, Recovery, Emergency, Safe Mode, Paused, Shutdown.

### 9.5 Approval timeout

`decision.approval_required` unresolved for **4 hours** → defer + escalate; **never auto-approve**.

---

## 10. Consistency review (GE-AI-1E)

**Verdict:** Conditionally certified → **fully certified** by GE-AI-1F addendum.

| Metric | Score |
|--------|-------|
| Architecture completeness (v1) | 92% |
| Implementation readiness | 88% |
| Architectural debt (pre-existing duplication) | 25% |
| Technical risk | 45% |
| Business risk | 35% |

Blocking gaps resolved in GE-AI-1F: Work Order schema, Event registry, Evidence registry, Autonomy mapping, Meta-Recommender binding, adaptation cooldown, approval timeout, dual-write rules, Decision Engine failure mode.

---

## 11. Glossary & binding addendum (GE-AI-1F)

This section is **authoritative** where earlier documents conflict.

### 11.1 Terminology bindings

| Canonical | Alias (allowed) | Retired as primary |
|-----------|---------------|-------------------|
| Mission | Objective (code/DB only) | "Objective" in UI |
| Work Order | — | Task, queue item as AI task |
| Decision | — | Standalone "recommendation" as authority |
| Event | — | Signal (market intel ≠ bus message) |
| Decision Engine | — | NBA as independent decider |
| Executive Brain | — | Aiden as executive |
| Campaign | — | Campaign as mission synonym |

### 11.2 Canonical ownership registry

See [Section 12](#12-agent-architecture) and GE-AI-1F Section 3 (Decision Engine, Memory System, Event Bus, Priority Engine, Mission Engine → Executive Brain; subsystems → primary agents per 1A §3).

### 11.3 Priority formula (sole authority)

```
PRIORITY = clamp(0, 1000, BASE + REVENUE×3 + MISSION×2.5 + INTERRUPT×2 + OPERATOR×1.5
  + TIME − RISK×2 − AGE_DECAY)
```

Legacy `execution-priority`, Aiden, realtime scores are **input feeders only**.

### 11.4 Evidence registry

28 canonical `evidence_key` entries with trust, freshness, weight, owner, fallback (GE-AI-1F §7). Compliance and budget state are absolute gates.

### 11.5 Event registry

Unified catalog merging realtime-events, objective-event-router, mission events, timeline, decision, memory events. New binding events: `work_order.*`, `decision.approval_expired`, `safe_mode.*`, `briefing.generated`, `meta_recommender.conflict_resolved`.

### 11.6 Decision Engine failure mode

`decision_engine_degraded = true` → block L3+ autonomous execution; NBA may show stale cached action; Safe Mode if degraded >15 min; inbound continues.

### 11.7 Implementation phase order (reference)

2A Decision Record → 2B Event Bus → 2C Work Orders → 2D Memory facade → 2E Priority → 2F Meta-Recommender → 2G Mission UI → 2H L3 approval → 2I L4 outbound → 2J Learning loop.

Details: `docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md`.

### 11.8–11.10

Work Order schema, Decision Record schema, Autonomy mapping — see [Section 16](#16-implementation-contracts) and [Section 18](#18-canonical-glossary).

---

## 12. Agent architecture

### 12.1 Roster (frozen v1)

16 agents listed in Section 6.2. No new agents without constitutional amendment.

### 12.2 Agent lifecycle states

Sleeping → Idle → Planning → Working → Waiting → Monitoring → Escalated → Recovery → Completed

**Conversation Agent** is always event-driven (inbox heartbeat).

### 12.3 Subsystem ownership (primary agent)

| Subsystem | Owner |
|-----------|-------|
| prospect-search/, prospect-discovery/ | Prospecting |
| research/, company-intelligence/ | Research |
| inbox/, reply-intelligence/ | Conversation |
| sequences/, outreach/, sendr/, automation-runtime/ | Outreach |
| personalization/, ai-copilot-*, playbooks/ | Personalization |
| objectives/ | Mission Engine (Executive Brain) |
| autonomy/, runtime-guardrails/ | Compliance + Executive Brain |
| lead-engine/ | Spine (all pipeline agents) |
| providers/, apollo/, pdl/ | Provider |
| deliverability/, mailboxes/ | Deliverability |
| warmup/ | Warmup |
| opportunity-pipeline/ | Opportunity |
| knowledge-center/ | Operator (docs) + Learning (recs) |

Full map: GE-AI-1A Section 3.

---

## 13. Decision architecture

### 13.1 Decision catalog (owner summary)

| Domain | Owner agent | Examples |
|--------|-------------|----------|
| Target/reject/verify/contact | Qualification | target_company, verify_email |
| Spend | Budget | spend_apollo_credits, increase_budget |
| Enrich/research/committee | Research / Provider | enrich, scrape, build_buying_committee |
| Channel/pause/stop/cadence | Strategy | send_email, pause_outreach, launch_sequence |
| Content | Personalization | change_messaging |
| Execute | Outreach | send_outbound, retry |
| Reply routing | Conversation | (via events, not outbound decisions) |
| Meeting | Meeting | schedule_meeting |
| Pipeline | Opportunity | create_opportunity |
| Governance | Executive Brain | pause_mission, change_icp |
| Veto | Compliance | all outbound when blocked |

Full catalog: GE-AI-1B Section 4 (~40 keys).

### 13.2 Confidence bands

| Score | Label | L4 behavior |
|-------|-------|-------------|
| 85–100 | High | Auto-execute (allowlisted) |
| 65–84 | Medium | Auto with logging / batch approve L3 |
| 45–64 | Low | Recommend only |
| 0–44 | Insufficient | Defer / escalate |

---

## 14. Memory architecture

See Section 8. Key rules:

- Formation gate: evidence ≥8 chars, sanitized, not auto-reply, privacy gate
- Learning Agent: read all, write Organization/Industry/Playbook effectiveness only
- Executive Brain: read all, write Mission/Executive/capture Operator Preference
- Retrieval via Memory Retrieval Service — agents do not read each other's stores directly

Context budgets: Personalization 25 items, Decision Engine 20, Executive planning 30.

---

## 15. Operating system

See Section 9. Key schedules:

| Schedule | Actions |
|----------|---------|
| Every 5 min | Executive tick, priority refresh |
| Every 15 min | Inbox sync, mission runtime tick |
| Hourly | Budget, opportunities, sequence scheduler |
| 02:00 UTC | Memory summarization, learning batch |
| 03:00 UTC | Intelligence recompute |
| 06:00 local | Morning briefing |
| Weekly Mon | Mission ROI, strategy adaptation |

Multi-mission: isolated budget/strategy; shared org knowledge and infrastructure; priority arbitration by mission priority + revenue impact.

Scale note (v1): ~20–50 active missions/org, 5 concurrent agents — sharding requires GE-AI-3G+ amendment.

---

## 16. Implementation contracts

### 16.1 Work Order (binding schema)

```
work_order_id, organization_id, mission_id, owner_agent, work_order_type,
entity_type, entity_id, priority (0–1000), status, decision_record_ids[],
memory_refs[], payload, depends_on[], retry_count, max_retries, timeout_at,
approval_id, checkpoint, issued_at, started_at, completed_at
```

Statuses: `issued | planning | awaiting_decision | awaiting_approval | executing | waiting | monitoring | escalated | completed | cancelled | failed`

### 16.2 Decision Record (binding schema)

```
decision_id, decision_key, owner_agent, mission_id, entity_*, evidence_bundle[],
confidence, risk_score, expected_cost_usd, expected_roi, explanation,
chosen_action, rejected_actions[], outcome, operator_override, learning{}, audit_trail[]
```

### 16.3 Contract summary

| Component | Must | Must not |
|-----------|------|----------|
| Executive Brain | Delegate Work Orders | Execute sends/spend |
| Agent | Request decisions; execute via subsystem | Bypass Decision Engine |
| Decision Engine | Full lifecycle + audit | Execute; override Compliance |
| Memory System | Enforce ownership + privacy | Store raw provider payloads |
| Event Bus | Dedupe + immutable log | Grant decision authority |
| Learning | Async org knowledge updates | Block Work Orders |

---

## 17. Architectural invariants

Permanent laws (GE-AI-1F §11):

1. One owner per decision key  
2. One primary owner per subsystem  
3. One owner per memory type (dual-write exceptions documented)  
4. Executive Brain never executes domain side effects  
5. Agents never bypass Decision Engine for non-trivial decisions  
6. Decision Engine never bypasses Governance  
7. Compliance always vetoes  
8. Events are immutable  
9. Learning never blocks execution  
10. Safe Mode stops outbound and spend  
11. Every side-effecting action has a Work Order  
12. Every executing Work Order has ≥1 Decision Record  
13. Every Decision Record references evidence or documents insufficiency  
14. Meta-Recommender is part of Decision Engine  
15. Priority Engine is sole global Work Order priority authority  
16. Mission (operator) = Objective (code)  
17. Adaptation cooldown 30 min after mission.adapted  
18. Approval timeout 4h → defer, never auto-approve  
19. Decision Engine failure → degraded mode, no autonomous send  

---

## 18. Canonical glossary

| Term | Definition |
|------|------------|
| **Mission** | Operator-facing revenue goal with ICP, budget, deadline, autonomy |
| **Objective** | Machine record (`GrowthObjective`) implementing a Mission |
| **Work Order** | Atomic delegated task from Executive Brain to one Agent |
| **Decision** | Judgment selecting one action via GE-AI-1B lifecycle |
| **Decision Record** | Immutable audit artifact for one Decision |
| **Decision Engine** | Infrastructure for decisions; includes Meta-Recommender |
| **Executive Brain** | Mission commander; never sends outbound |
| **Agent** | One of 16 domain owners; not a subsystem |
| **Subsystem** | `lib/growth/<domain>/` module; executed by agents |
| **Memory** | Evidence-backed recall; entity/mission scoped |
| **Knowledge** | Validated org-wide patterns |
| **Wisdom** | Executive strategic judgment |
| **Event** | Immutable AIOS Event Bus message |
| **Interrupt** | L0–L5 preemption |
| **Priority** | 0–1000 attention score from Priority Engine |
| **Autonomy** | Mission-scoped Level 0–5 permissions |
| **Safe Mode** | Outbound/spend halted; inbound continues |
| **Approval** | Human Approval FSM gate |
| **Campaign** | Tactical audience + sequence bundle within a Mission |
| **Prospect** | Pre-qualification candidate; becomes **Lead** after target decision |
| **Evidence** | Cited artifact with source_key, trust, freshness, snippet |

Full glossary with aliases: GE-AI-1F Section 1.

---

## 19. Governance

### 19.1 Hierarchy

```
Compliance Agent (absolute veto)
  → Operator (missions, overrides, cancel)
    → Executive Brain (delegate, adapt, escalate)
      → Decision Engine (evaluate)
        → Human Approval FSM (L≤3 execution)
          → Agents → Subsystems
```

### 19.2 Override authority

| Actor | Can override | Cannot |
|-------|--------------|--------|
| Operator | Any agent decision within mission | Compliance blocks |
| Executive Brain | Agent decisions within mission | Compliance; operator cancel |
| Compliance | — | Only block |
| Agents | — | Only propose |

### 19.3 Traceability (mandatory)

Every implementation phase must document: Constitution sections, engineering phase, certification, ledger entry, master context update.

---

## 20. Future amendment process

### 20.1 When amendment is required

- New agent or retirement of frozen agent  
- New decision owner for existing key  
- Change to invariants, autonomy mapping, or Work Order/Decision Record schema  
- New memory type or retention policy change for frozen types  
- Multi-product namespace / scale tier architecture  

### 20.2 Amendment document format

```
ID: GE-AI-{major}G-A{number}  (e.g. GE-AI-2G-A1)
Title:
Description:
Affected Constitution sections:
Reason:
Backward compatibility:
Approval: (lead architect + operator sponsor)
Version bump: (e.g. 1.0 → 1.1)
Status: draft | ratified | superseded
```

### 20.3 Ratification

1. Draft amendment document in `docs/architecture/amendments/`  
2. Consistency review (mini GE-AI-1E)  
3. Update Constitution version history  
4. Update Implementation Ledger if engineering impact  
5. Update Master Context Document (not Constitution body for engineering-only changes)

Engineering-only changes (file paths, UI, performance) **do not** require amendment.

---

## 21. Version history

| Version | Date | Change | Phase |
|---------|------|--------|-------|
| **1.0** | 2026-06-25 | Initial ratification; consolidates GE-AI-1A–1F + Autonomy Audit | GE-AI-1X complete |
| — | — | Future amendments via Section 20 | GE-AI-2G+ |

---

*AI Revenue Operator Constitution v1.0 — Frozen. Engineering state: `docs/MASTER_CONTEXT_DOCUMENT.md`. Implementation: `docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md`.*
