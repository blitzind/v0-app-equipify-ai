# GE-AIOS-25A — Ava Cognitive Workspace

**Document ID:** GE-AIOS-25A  
**Filename:** `GE-AIOS-25A_AVA_COGNITIVE_WORKSPACE.md`  
**Status:** Presentation design lock (Lead Drawer) — **IMP-0A-1 / 25A-1 implementation in progress in code**  
**Effective:** 2026-07-12  
**Parent consolidation:** [`AI_OS_EXECUTIVE_ARCHITECTURE_CONSOLIDATION.md`](./AI_OS_EXECUTIVE_ARCHITECTURE_CONSOLIDATION.md)  
**Implementation milestone:** [`GE-AIOS-IMP-0A-1_EXECUTIVE_LEAD_DRAWER.md`](./GE-AIOS-IMP-0A-1_EXECUTIVE_LEAD_DRAWER.md)  
**Implementation cert:** `pnpm test:ge-aios-25a-1-ava-cognitive-workspace`  
**Primary shell:** `components/growth/growth-lead-cognitive-workspace.tsx`
**Scope:** Lead Drawer information hierarchy and presentation composition  
**Non-scope:** Backend decision changes, new engines, schema, APIs, scoring, providers, commits, deployments  

---

## 1. Objective

Redesign the Growth Lead Drawer from a CRM-style information panel into **Ava’s Cognitive Workspace**.

This drawer is **not** intended to help a salesperson make decisions.

It exists so operators (Ava’s managers) can:

- Understand Ava’s autonomous reasoning  
- Verify her conclusions  
- Review evidence  
- Approve or override actions  

---

## 2. Core philosophy

The drawer follows Ava’s cognitive workflow:

```text
Observation
  → Inference
  → Decision
  → Plan
  → Execution
  → History
  → Raw Evidence
```

Opening a lead should feel like opening **Ava’s notebook**, not opening a CRM record.

---

## 3. Operator questions (order)

The drawer must answer, in order:

1. What does Ava currently believe?  
2. Why does she believe it?  
3. What evidence supports it?  
4. What is she planning to do?  
5. What has changed over time?  
6. What is waiting on me?  
7. If needed, where is the raw evidence?  

---

## 4. Relationship to IMP-0A-1

| Document | Role |
|----------|------|
| **GE-AIOS-25A (this)** | Canonical **cognitive hierarchy** and section semantics for the Lead Drawer |
| **IMP-0A-1** | Implementation milestone constraints (presentation-only, reuse/wrap, regression rules) |

IMP-0A-1 “Executive Workspace” language remains valid for the human-manager framing.  
**25A is the authoritative section order and naming** for implementation.

| IMP-0A-1 section | 25A section |
|-----------------|-------------|
| Executive Briefing + Account Status + Ava’s Decision | **1. Ava’s Current Assessment** |
| My Assessment (conclusions) | **2. Why I Believe This** |
| Supporting Evidence (facts) | **3. Evidence** + **9. Raw Intelligence** |
| Current Objective + Current Plan | **4. Recommended Plan** |
| (part of Research / timeline) | **5. Research Journal** |
| Operational panels | **6. Operational State** |
| Recent Work / Activity | **7. Activity Timeline** |
| Awaiting My Approval + tools | **8. Human Workspace** |
| Diagnostics / payloads | **9. Raw Intelligence** |

---

## 5. New information hierarchy

### 1. Ava’s Current Assessment

**Cognitive stage:** Decision (executive summary)  
**Show only current state.**

| Field | Source (existing — presentation map) |
|-------|--------------------------------------|
| Match rating | Prospect fit / qualification / ICP-adjacent scores already on research or native decision |
| Overall confidence | `nativeDecision.confidence` / research confidence |
| Current recommendation | NBA / `nativeDecision.action_label` |
| Opportunity level | Opportunity readiness tier / score on lead |
| Human approval status | Pending automation approvals / reply actions / “none needed” |
| Last updated | Research / decision / lead `updated` timestamps already available |

This is the **executive summary**. No raw excerpts. No engine names.

---

### 2. Why I Believe This

**Cognitive stage:** Inference  
**First-person cognitive reasoning** — conclusions, not raw facts.

Examples (from existing pain/signals/reasons, reworded):

- I identified evidence that this company services medical imaging equipment.  
- I found no customer portal.  
- I detected no online scheduling.  
- I believe modernization opportunity is high.  

**Reuse:** Prospect intelligence pain/opportunity conclusions, `nativeDecision.reasons`, research recommendation narratives, opportunity accelerators — **as conclusions**.

**Do not** dump website paragraphs here.

---

### 3. Evidence

**Cognitive stage:** Observation (curated facts)  
**Only observable facts.** No reasoning.

Include:

- Website summary  
- Verified company description  
- Equipment indicators  
- Technology stack  
- Website excerpts (short, factual)  
- Business signals  
- Source links  
- Confidence by evidence source  

**Reuse:** Company snapshot facts, research structured fields, evidence-engine style summaries already in research panel — **fact mode**.

---

### 4. Recommended Plan

**Cognitive stage:** Plan → Execution intent  
Ava’s intended workflow.

| Plan element | Source |
|--------------|--------|
| Current recommendation | NBA / native decision |
| Next action | Daily work queue / NBA |
| Planned follow-up | Execution plan steps / follow-up fields |
| Waiting on approval | Automation / reply approval pending |
| Fallback strategy | Communication strategy fallbacks (if present) |
| Future actions | Sales execution plan remaining steps |

**Reuse:** `GrowthSalesExecutionPlanPanel`, `GrowthLeadDailyWorkQueuePanel`, `GrowthNextBestActionBanner`, communication strategy display.

---

### 5. Research Journal

**Cognitive stage:** Inference history  
Replace generic “run history” with a **chronological cognitive log**.

Example entries:

- Started crawl  
- Detected industry  
- Found service indicators  
- Confidence increased  
- Recommendation changed  
- Generated outreach strategy  
- Waiting on approval  

Each entry: **what changed** and **why** (from existing run stages / status transitions / recommendation deltas — presentation projection only; do not invent journal events that did not occur).

**Reuse:** Research run history / run cards / prospect run status transitions — **reworded**, not a new persistence store in this phase.

---

### 6. Operational State

**Cognitive stage:** Account health (Ava’s ops pulse)  
Retain existing operational intelligence, regrouped:

- Momentum  
- Workflow Health  
- Research Freshness  
- Engagement  
- Aging  
- First Touch  

**Reuse:** Momentum/engagement/aging fields on lead; research freshness; workflow health; executive/capacity panels **as health**, not as primary decision UI.

Hide empty metrics that have never been computed.

---

### 7. Activity Timeline

**Cognitive stage:** History (audit trail)  
**Separate from Research Journal.**

Lifecycle events:

- Research  
- Approvals  
- Outreach  
- Replies  
- Calls  
- Meetings  
- Status changes  

**Reuse:** `GrowthLeadTimelinePanel`, `GrowthLeadActivityStream`, multichannel timeline — permanent audit trail presentation.

---

### 8. Human Workspace

**Cognitive stage:** Human collaboration  
All operator interactions together:

- Approvals  
- Manual Notes  
- Override Recommendation *(UI affordance only if already supported; do not invent backend)*  
- Lock Recommendation *(same rule)*  
- Request Re-Research *(existing research rebuild / run actions)*  
- Escalate *(existing manual-review / escalation paths if present)*  

**Reuse:** `GeV15AutomationRuntimeApprovalPanel`, `GrowthReplyWorkflowActionsPanel`, notes on lead/command center, research Run/Rebuild actions, assignment.

If override/lock are not production-backed yet: show only existing actions; do not fake persistence.

---

### 9. Raw Intelligence

**Cognitive stage:** Raw Evidence  
**Collapsed by default.**

Contains:

- Raw website excerpts  
- Evidence payloads  
- Technology detections  
- Provider payloads  
- Debug metadata  
- Research JSON  
- Run diagnostics  
- Developer evidence  

Preserves full transparency without overwhelming the primary experience.

**Reuse:** Research diagnostics, forecast evidence, guardrail panels, operational intelligence dumps, voice debug cards — everything that is payload-heavy.

---

## 6. Cognitive → UI section map

```text
Observation  →  §3 Evidence (+ §9 Raw)
Inference    →  §2 Why I Believe This (+ §5 Research Journal)
Decision     →  §1 Ava’s Current Assessment
Plan         →  §4 Recommended Plan
Execution    →  §4 (waiting/next) + §8 Human Workspace approvals
History      →  §5 Research Journal + §7 Activity Timeline
Raw Evidence →  §9 Raw Intelligence
Health       →  §6 Operational State
```

---

## 7. Component consolidation (reuse policy)

Same no-rebuild policy as IMP-0A-1 / IMPLEMENTATION-0A:

| 25A section | Primary existing components |
|-------------|----------------------------|
| 1 Assessment | Command Center summary fields, NBA banner, nativeDecision, opportunity readiness badge, approval pending count |
| 2 Why I Believe | Prospect Intelligence conclusions, native reasons, opportunity accelerators/blockers (as beliefs) |
| 3 Evidence | Company snapshot, research structured facts, source links |
| 4 Plan | Sales Execution Plan, Daily Work Queue, NBA, communication strategy |
| 5 Research Journal | Research history / run status projection |
| 6 Operational State | Momentum, engagement, aging, workflow health, research freshness, executive/capacity (health framing) |
| 7 Activity Timeline | Timeline + activity stream + multichannel |
| 8 Human Workspace | Approvals, reply actions, notes, research actions, assignment |
| 9 Raw Intelligence | Research JSON/diagnostics, forecast evidence, guardrails, heavy intel panels |

Wrap · rename · reorder · compose. Prefer not rewriting panel internals.

---

## 8. Design constraints

- **Presentation only** for first implementation cut (IMP-0A-1).  
- **Do not invent** conclusions, journal events, or override/lock backends.  
- **Hide empty sections** when no meaningful data.  
- **No AI architecture jargon** in primary labels (Engine, Signal, Readiness as product chrome, Intelligence as section title, etc.).  
- Sticky contact actions may remain for operator utility without becoming a CRM “fields first” header.  
- Raw Intelligence always starts **collapsed**. Evidence may start expanded if sparse; Raw never competes with Assessment.  

---

## 9. Implementation sequence (aligned with IMP-0A-1)

1. Pure client mappers: assessment fields, belief lines, status, plan projection, journal entries from run transitions  
2. `GrowthLeadCognitiveWorkspace` composition root (nine sections)  
3. Rewire `growth-lead-drawer.tsx` order; preserve effects/providers/focus IDs  
4. Split research content into Beliefs / Evidence / Journal / Raw  
5. Collapse Raw; hide empties; Human Workspace grouping  
6. Static cert: section order + no API/schema changes  

---

## 10. Success criteria

The drawer feels like reviewing an autonomous employee’s notebook when:

- Assessment answers “what Ava believes now” above the fold  
- Beliefs are first-person conclusions  
- Evidence is facts only  
- Plan is actionable and clear  
- Research Journal ≠ Activity Timeline  
- Human Workspace collects “what’s on me”  
- Raw Intelligence is available but quiet  

---

## 11. Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-12 | Initial cognitive workspace design lock (GE-AIOS-25A) |

---

*Equipify AI OS — GE-AIOS-25A Ava Cognitive Workspace. Presentation hierarchy for the Growth Lead Drawer.*
