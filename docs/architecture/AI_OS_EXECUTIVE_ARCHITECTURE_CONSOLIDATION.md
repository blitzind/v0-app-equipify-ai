# AI OS Executive Architecture Consolidation

**Document ID:** GE-AIOS-IMPLEMENTATION-0A  
**Filename:** `AI_OS_EXECUTIVE_ARCHITECTURE_CONSOLIDATION.md`  
**Status:** Implementation blueprint (no rebuild policy)  
**Effective:** 2026-07-11  
**Authority:** All executive-architecture implementation work after EXEC-0 and ARCH-1A–4A locks  
**Scope:** Consolidation plan, facades, net-new bounds, refactor sequence, milestones  
**Non-scope:** Code changes, schema migrations, deployments, commits  

**Upstream locks:**
- Executive Constitution: [`AI_OS_EXECUTIVE_CONSTITUTION.md`](./AI_OS_EXECUTIVE_CONSTITUTION.md)
- ARCH-4A Knowledge: [`AI_OS_ORGANIZATIONAL_KNOWLEDGE_AND_LEARNING.md`](./AI_OS_ORGANIZATIONAL_KNOWLEDGE_AND_LEARNING.md)
- ARCH-3A Missions: [`AI_OS_OBJECTIVES_AND_MISSIONS.md`](./AI_OS_OBJECTIVES_AND_MISSIONS.md)
- ARCH-2A Portfolio: [`AI_OS_PORTFOLIO_ALLOCATION_PRINCIPLE.md`](./AI_OS_PORTFOLIO_ALLOCATION_PRINCIPLE.md)
- ARCH-1A Resource: [`AI_OS_RESOURCE_ALLOCATION_PRINCIPLE.md`](./AI_OS_RESOURCE_ALLOCATION_PRINCIPLE.md)

**Audit basis:** GE-AIOS-AUDIT-EXEC-1A (accepted as canonical findings)

---

## 1. Mission

The Executive Constitution and ARCH-1A through ARCH-4A are permanently locked.  
The implementation audit confirms AI OS already contains a large percentage of the executive architecture as production-tested systems.

**This project is NOT to build new engines.**

This project consolidates, composes, and elevates existing systems into the canonical AI OS Executive Architecture.

### Implementation philosophy

```text
Reuse → Compose → Refactor → Replace (only if absolutely necessary)
```

Rebuilding existing production capability is a **design failure**.  
Creating parallel executive systems is **prohibited**.

### Pre-code gate (mandatory)

Before any code is written, every change must answer:

1. Does this already exist?  
2. Can it become canonical?  
3. Can we wrap it?  
4. Can we compose it?  
5. Can we refactor it?  

Only after those are exhausted may something new be created.

---

## 2. Environment constraints

- Vercel Production architecture only  
- Never use `.env.local`  
- No deployments / commits in blueprint phase  
- No schema changes unless explicitly required and ratified  
- Preserve production behavior, deterministic engines, certifications  
- Minimize regression risk  

---

## 3. Canonical executive stack (no extra layers)

```text
Executive Constitution (EXEC-0)
        ↓
ARCH-4A Organizational Knowledge
        ↓
ARCH-3A Objectives & Missions
        ↓
ARCH-2A Portfolio Allocation
        ↓
ARCH-1A Resource Allocation
        ↓
Specialist Judgment → Execution → Outcome → Learning → ARCH-4A
```

---

## 4. Systems that become canonical (preserve)

### 4.1 ARCH-1A — Resource Allocation building blocks

| System | Canonical role | Action |
|--------|----------------|--------|
| Autonomy Policy Engine | Scarce-action policy gate | **Wrap** — do not replace |
| GS-RG-1 Runtime Budgets | Org/user capacity counters | **Wrap** |
| Admission Gates (21C) | Intake eligibility | **Wrap** |
| Provider Fail-Closed Gates (Apollo / Datamoon) | Paid-provider enablement | **Wrap** |
| Freshness Gates (research readiness) | Avoid redundant spend | **Wrap** |
| Confidence Gates (send confidence) | Scarce-send threshold | **Wrap** |
| Approval Gates (sequence / automation / outbound activation) | Human authorize | **Wrap** |
| Stop Conditions (outbound scope + kill switches) | Halt spend in scope | **Wrap** |
| LLM budget (`lib/ai/budget`) | Model spend | **Compose** under facade order |

### 4.2 ARCH-2A — Portfolio Allocation building blocks

| System | Canonical role | Action |
|--------|----------------|--------|
| Mission Priority Engine (4F) | Mission capacity ranking | **Promote** → Portfolio Facade input |
| Daily Revenue Work Queue | Sales-day capacity allocation | **Promote** |
| Meta Recommender (2F) | Cross-signal ranking | **Compose** |
| Priority Binding (2E) | Projection of 4F + Meta | **Compose** |
| Decision Engine (10B) | Operator NBA ranking | **Keep** for operator day stack |
| Work Manager | Daily ordering of Decision Engine output | **Keep** |

**Rename policy:** 4F must stop being called “Resource Allocation.” It is **capacity ranking** under ARCH-2A.

### 4.3 ARCH-3A — Objectives & Missions building blocks

| System | Canonical role | Action |
|--------|----------------|--------|
| `organization_growth_objectives` / GrowthObjective runtime | Canonical Mission | **Extend upward** — do not replace |
| Objective scheduler + stage executors | Mission execution tick | **Reuse** |
| Mission Center | Presentation / orchestration UI | **Keep** as UI |
| AI Work Orders | Mission-scoped execution units | **Reuse** |
| AI Decision Records | Explainability + mission linkage | **Reuse** |
| Framework missions (4E) | Lead-scoped tactical steps | **Demote** — not executive Missions |

### 4.4 ARCH-4A — Organizational Knowledge building blocks

| System | Canonical role | Action |
|--------|----------------|--------|
| `organization_knowledge` (17C) | Layer 4 store | **Promote** → Knowledge Ledger contract |
| Agent Memory (4D) | Layer 2 read model | **Keep** — not org knowledge |
| Lead memory | Layer 2 | **Keep** |
| GE-AI-3D closed-loop | Outcome → insight | **Connect** → 17C |
| Adaptive Calibration (PROD-2/3) | Operator-gated behavior overlays | **Keep** |
| Evidence Engine | Fact intake | **Reuse** |
| Playbook outcome learning | Specialist messaging guidance | **Connect** when evidence qualifies |

---

## 5. Facades required (thin orchestration only)

Facades **coordinate**. They do **not** duplicate business logic.

| Facade | Composes | Owns | Does not own |
|--------|----------|------|--------------|
| **Resource Allocation Facade** | Autonomy Policy, GS-RG budgets, Admission, Provider gates, Freshness, Confidence, Approvals, Stops | Call order, Investment State projection, decision record write | Budget math, provider SDKs, admission scoring |
| **Portfolio Allocation Facade** | 4F, Daily Revenue Queue, Meta, Priority Binding | Competitive selection view, Portfolio Ledger write, deferral explanation | Local NBA scoring (Decision Engine), Work Manager sorting |
| **Knowledge Promotion Facade** | 3D insights, 17C upsert, Evidence Engine, playbook outcomes | Evidence thresholds, promote/reject, influence adapters | Memory storage internals, calibration apply engine |
| **Mission Facade** | GrowthObjective runtime, Work Orders, Decision Records | Vision/parent Objective projection, Mission Ledger write, hierarchy reads | Stage executor logic, scheduler tick |

Optional thin **Executive Projection Facade** (UI-only initially): maps existing Command Center / Home / Lead Drawer data into executive vocabulary (judgment, briefing, objective, resource posture, portfolio context) with **no backend behavior change**.

---

## 6. Net-new code (target: minimal)

Allowed net-new only when composition cannot express the contract:

| Net-new | Why required | Size target |
|---------|--------------|-------------|
| Investment State type + persistence (or projected column on existing subject records) | Shared language across UI/orchestration; no equivalent state machine | Small |
| Resource Ledger write path | No decision/ROI ledger today; counters ≠ ledger | Small table/API or append-only log |
| Portfolio Ledger write path | No “why A beat B” store | Small |
| Mission Ledger write path | Objective history ≠ ARCH-3A ledger | Small |
| Knowledge Ledger API contract over 17C | 17C is close; needs promote/supersede/influence surface | Thin API |
| Vision + parent Business Objective fields/entities | Hierarchy missing; extend GrowthObjective upward | Small schema when ratified |
| 3D → 17C promotion bridge | Connection missing; not a new memory platform | Small bridge module |
| UI composition layers (Lead Drawer / Home / Command Center) | Executive UX without engine dumps | Presentation only |

**Forbidden net-new:** second Autonomy Engine, second Budget Engine, second Mission runtime, second prioritizer, second memory platform, second Decision Record format, second Command Center backend.

---

## 7. Component-by-component consolidation plan

### 7.1 Phase 1 — Executive UX (no backend behavior change)

| Surface | Today | Consolidation |
|---------|-------|---------------|
| **Lead Drawer** | Dense stack of intelligence panels / engine artifacts | Recompose as Ava judgment workspace: briefing, assessment, decision, plan, approvals, evidence collapsed |
| **Home** | Many executive-briefing sections + queues | Surface: current objective, portfolio posture (invested/deferred), resource posture, Ava decisions — hide engine names |
| **Command Center** | Engine-section gallery (pilots, diagnostics, frameworks) | Executive read model: objectives, portfolio ranking, resource posture, knowledge lessons, approvals — diagnostics behind advanced |

**UI must expose:** Ava’s judgment · Executive briefing · Decisions · Current objective · Resource posture · Portfolio context  

**UI must stop exposing:** internal engine architecture as primary UX  

**Backend:** read existing projections only; no orchestration change.

### 7.2 Phase 2 — Resource Allocation Facade

```text
Scarce action request
  → Resource Allocation Facade
      → Autonomy Policy
      → GS-RG / autonomy budgets
      → Admission (if intake/research)
      → Provider fail-closed gates
      → Freshness / confidence (as applicable)
      → Approval (if required)
      → Stop / kill-switch check
      → Project Investment State
      → Write Resource Ledger entry (when ledger exists)
  → Existing systems execute unchanged
```

**Do not** create a new Resource Allocation Engine that reimplements budgets or policy.

### 7.3 Phase 3 — Investment States

Canonical shared language:

| State | Map from existing behavior (examples) |
|-------|----------------------------------------|
| **Increase Investment** | High confidence + capacity + admission allow + portfolio active |
| **Maintain Investment** | Active outbound/research within caps |
| **Pending Investment** | Awaiting approval, review admission, insufficient confidence |
| **Reduce Investment** | Soft stops, lower priority deferral, budget pressure |
| **Stop Investment** | Admission reject, kill switch, outbound stop, autonomy deny |

States are **projections/labels** first; enforcement continues via existing gates. Persistence comes only when needed for UI + ledger without forking gate logic.

### 7.4 Phase 4 — Portfolio Allocation Facade

```text
4F Mission Priority
  + Daily Revenue Work Queue
  + Meta Recommender
  + Priority Binding
        ↓
Portfolio Allocation Facade
        ↓
Selected / Queued / Deferred explanations + Portfolio Ledger
```

Decision Engine + Work Manager remain the **operator day stack** — not replaced, not duplicated as a second portfolio authority.

Eliminate parallel *authority* (not every local sort): no new prioritizer; demote competing engines to domain-local sorts.

### 7.5 Phase 5 — Organizational Knowledge Promotion

```text
GE-AI-3D insights (+ playbook outcomes meeting evidence bar)
        ↓
Knowledge Promotion Facade (thresholds, confidence, sample size)
        ↓
organization_knowledge (17C)
        ↓
Executive influence adapters (read-only priors first)
        → Mission Facade hints
        → Portfolio Facade score priors
        → Resource Facade investment priors
```

Calibration apply (PROD-3) remains the path for **weight overlays**. Knowledge promotion remains the path for **institutional truths**. Do not merge them into one store.

### 7.6 Phase 6 — Mission Hierarchy (extend, don’t replace)

```text
Vision (new/extended)
  → Business Objective (new/extended parent)
    → GrowthObjective (existing Mission runtime)
      → Work Orders / stage execution (existing)
```

Reuse current scheduler, stage executors, Mission Center, work-order FKs. Framework missions stay tactical under a GrowthObjective.

---

## 8. Refactor sequence (lowest regression risk)

| Order | Milestone | Risk | Why this order |
|-------|-----------|------|----------------|
| **M0** | Publish this blueprint; freeze no-rebuild policy in Implementation Ledger | None | Alignment |
| **M1** | Executive UX compose (Lead Drawer → Home → Command Center) | Low | Presentation only; no gate changes |
| **M2** | Investment State **types + UI projection** from existing signals | Low | Labels only |
| **M3** | Resource Allocation Facade (shadow mode: log decisions, don’t change allow/deny) | Low | Observe parity |
| **M4** | Resource Facade **enforce call order** only where already gated; Resource Ledger append | Medium | Behavior-preserving composition |
| **M5** | Portfolio Facade (shadow): compose 4F+Daily Queue+Meta+Binding; Portfolio Ledger | Low–Medium | Read-path first |
| **M6** | Portfolio Facade as **canonical read authority** for Command Center/Home | Medium | Swap consumers, keep engines |
| **M7** | Knowledge Promotion Facade: 3D → 17C with evidence floors (no auto executive influence yet) | Medium | Write path gated |
| **M8** | Mission Facade: Vision/parent Objective (schema only when ratified); Mission Ledger | Medium | Extend GrowthObjective |
| **M9** | Executive influence wiring (knowledge → mission/portfolio/resource **priors**, confidence-gated) | Medium–High | Last — depends on M3–M8 |
| **M10** | Terminology/authority cleanup: demote parallel prioritizer claims; cert updates | Low | Docs + QA markers |

**Rule:** Shadow → parity certify → cut over. Never big-bang replace a production gate.

---

## 9. Components that must never be replaced

1. Autonomy Policy Engine  
2. GS-RG-1 Runtime Budgets + kill switches  
3. Apollo / Datamoon fail-closed provider gates  
4. 21C Admission evaluation  
5. `organization_growth_objectives` + objective runtime / scheduler  
6. AI Work Orders + AI Decision Records  
7. Human Approval Center + existing approval gate implementations  
8. Bounded autonomous outbound stop conditions  
9. `organization_knowledge` (17C) storage model  
10. GE-AI-3D closed-loop store + adaptive calibration apply  
11. Lead memory + Agent Memory (4D) as Layer 2  
12. Evidence Engine  
13. Mission Priority (4F) scoring core  
14. Daily Revenue Work Queue capacity math  
15. Decision Engine (10B) + Work Manager for operator day stack  

---

## 10. Parallel systems policy (eliminate authority, keep local sorts)

| Keep as domain-local | Must not claim executive authority |
|----------------------|-------------------------------------|
| Call / reply / inbox / notification priority | Portfolio Allocation |
| Execution priority engine | Resource Allocation |
| Aiden / reasoning priority | Mission hierarchy |
| Framework missions (4E) | GrowthObjective Missions |
| 4F “resource allocation” naming | ARCH-1A Resource Allocation |

---

## 11. Regression protection checklist

Every implementation PR must preserve:

- [ ] Existing certifications (update markers only when behavior intentionally expands)  
- [ ] Existing APIs (facades add; do not break)  
- [ ] Existing runtime allow/deny outcomes (shadow first)  
- [ ] Provider integrations and fail-closed defaults  
- [ ] Autonomy safety (fail-closed budgets remain)  
- [ ] Deterministic engines (4F, Decision Engine, admission, etc.)  

Success = **more coordination, same working code**.

---

## 12. Success criteria

The consolidation succeeds if:

- Very little net-new code is required  
- Existing production systems become canonical  
- Parallel **authorities** are eliminated (local sorts may remain)  
- Decision engines, budgets, autonomy, memory, and missions are reused  
- The architecture feels unified without rebuilding the platform  

---

## 13. Recommended milestone breakdown (implementation)

| ID | Name | Deliverable | Backend change? |
|----|------|-------------|-----------------|
| **IMP-0A-1** | Executive UX — Lead Drawer | Ava judgment workspace composition | No |
| **IMP-0A-2** | Executive UX — Home | Objective / portfolio / resource posture | No |
| **IMP-0A-3** | Executive UX — Command Center | Executive read model; engines demoted | No |
| **IMP-0A-4** | Investment State vocabulary | Shared types + UI mapping | Types only |
| **IMP-0A-5** | Resource Facade (shadow) | Compose gates; parity log | Observability |
| **IMP-0A-6** | Resource Facade + Ledger | Thin ledger; ordered composition | Minimal schema if required |
| **IMP-0A-7** | Portfolio Facade (shadow → read authority) | Compose 4F+Queue+Meta+Binding | Ledger optional |
| **IMP-0A-8** | Knowledge Promotion Facade | 3D → 17C bridge + evidence floors | Connect only |
| **IMP-0A-9** | Mission hierarchy extension | Vision / parent Objective + Mission Ledger | Schema when ratified |
| **IMP-0A-10** | Executive influence v1 | Confidence-gated priors into facades | Compose adapters |
| **IMP-0A-11** | Authority cleanup + certs | Terminology, QA, duplicate demotion | Docs/tests |

---

## 14. Amendment process

Substantive changes to this consolidation policy (no-rebuild rule, facade list, never-replace list, milestone order) require:

1. Explicit product/architecture ratification  
2. Version-history update below  
3. Implementation Ledger entry  
4. Confirmation that no parallel engine is introduced  

---

## 15. Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-11 | Initial blueprint (GE-AIOS-IMPLEMENTATION-0A) from AUDIT-EXEC-1A |

---

*Equipify AI OS — Executive Architecture Consolidation v1.0. Policy: Reuse → Compose → Refactor → Replace only if necessary.*
