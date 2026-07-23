# AVA-GROWTH-OPERATOR-1B — Decision Authority Unification

**Document ID:** AVA-GROWTH-OPERATOR-1B  
**Status:** Certified — architectural consolidation  
**Effective:** 2026-07-23  
**Parent:** [`AVA-GROWTH-OPERATOR-1A_EXECUTIVE_OPERATING_MODEL.md`](./AVA-GROWTH-OPERATOR-1A_EXECUTIVE_OPERATING_MODEL.md)  
**Certification:** `pnpm test:ava-growth-operator-1b-decision-authority`

---

# Executive Summary

AVA-GROWTH-OPERATOR-1B establishes **Canonical Decision Engine 1A** as the sole per-opportunity execution authority. Every opportunity now produces one authoritative record describing owner, stage, next action, autonomous eligibility, escalation status, and execution state.

Supporting systems were refactored to **consume** this authority rather than compete with it:

| System | Role after 1B |
|--------|---------------|
| **Canonical Decision Engine 1A** | Sole per-opportunity execution authority |
| **Work Manager 10B/11A** | Portfolio scheduler — respects canonical ownership when `canonicalAuthorityByLeadId` is provided |
| **Revenue Operator 4B** | Agent orchestration supervisor — defers next action when `canonicalAuthorityBinding` is present |
| **Meta Recommender 2F** | Portfolio optimizer / signal synthesizer — advisory only, never execution authority |
| **Resource Allocation Facade** | Investment allocation — unchanged; never authorizes outbound send |
| **Recommendation surfaces** | Canonical decision is primary; competing 10B/queue items suppressed for bound leads |

---

# Authority Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│           Canonical Decision Engine 1A (AUTHORITY)          │
│  owner · stage · nextAction · autonomy · escalation · state │
└───────────────────────────┬─────────────────────────────────┘
                            │ GrowthCanonicalOpportunityAuthority
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐
│ Work Manager  │  │ Revenue Operator│  │ Execution Authority  │
│ (schedule)    │  │ (orchestrate)   │  │ 1A gate (enforce)    │
└───────┬───────┘  └────────┬───────┘  └──────────────────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Supporting Intelligence (advisory)             │
│  Meta Recommender · Resource Allocation · Opportunity     │
│  Assessment · Revenue Director · Closed-loop learning     │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Operator (executive)                    │
│  Approvals · strategic decisions · outbound send only       │
└─────────────────────────────────────────────────────────────┘
```

### Ownership boundaries

| Layer | Owns | Does not own |
|-------|------|--------------|
| **1A Canonical** | Per-lead next action, actor, escalation, transport gate | Portfolio day ordering |
| **Work Manager** | Daily work plan, interruptions, specialist routing | Independent ownership when authority bound |
| **Revenue Operator** | Agent handoffs, lifecycle stage, gate monitoring | Per-lead next-best-action when bound |
| **Meta Recommender** | Cross-signal portfolio ranking | Per-lead execution decisions |
| **Resource Allocation** | Investment State projection | Outbound transport authorization |
| **Operator** | Send approval, strategic direction | Autonomous preparation within policy |

---

# Duplicate Authority Audit

| Previous competing authority | Disposition | Mechanism |
|------------------------------|-------------|-----------|
| **10B Decision Engine `requires_operator`** | **Consolidated** | `canonical-authority-work-manager-bridge-1b.ts` overrides when authority map provided |
| **Work Manager `can_execute_autonomously` heuristics** | **Consolidated** | Derived from `GrowthCanonicalOpportunityAuthority.autonomousEligible` |
| **Revenue Operator `recommendedNextAction`** | **Delegated** | `bindRevenueOperatorOrchestrationToCanonicalAuthority()` defers to canonical title |
| **Meta Recommender lead-scoped recommendations** | **Retained (advisory)** | `GROWTH_META_RECOMMENDER_AUTHORITY_ROLE` — portfolio optimizer only |
| **Home recommendation queue (10B duplicates)** | **Consolidated** | `growth-recommendation-authority-gate-1b.ts` suppresses competing items |
| **Canonical operator focus** | **Retained** | Primary operator surface — unchanged priority |
| **Resource Allocation Facade** | **Retained** | Investment allocation; outbound explicitly blocked |
| **Execution Authority Closure 1A** | **Retained** | Enforcement gate consuming 1A resolution — complements 1B authority model |
| **AI OS Decision Engine 2H (work orders)** | **Retained (audit)** | Decision records for explainability — not per-lead execution authority |
| **Opportunity Assessment 1B** | **Retained (advisory)** | Intelligence input to 1A — explicit non-execution rule preserved |

---

# Execution Flow (One Opportunity Lifecycle)

```text
Discovery
  → Portfolio Manager triggers search [autonomous]
Qualification
  → 5C pilot / admission policy [autonomous within gates]
Research
  → 5B pilot [autonomous; bounded by Resource Allocation]
Scoring
  → Opportunity Assessment [advisory → feeds 1A input]
Decision  ★ AUTHORITATIVE ★
  → buildGrowthCanonicalNextBestDecision()
  → buildCanonicalOpportunityAuthorityFromResolution()
  → owner=ava, stage=preparation, autonomousEligible=true
Preparation
  → Work Manager schedules outreach work [authority_bound=true]
  → 5F outreach prep pilot [Execution Authority gate: allowed]
  → Revenue Operator supervises outreach_agent handoff [binding defers next action]
Approval
  → operatorReviewRequired when transportBlocked [escalation=operator_required]
  → Human Approval Center [operator gate]
Execution
  → Transport orchestrator [human_approved required — unchanged]
Learning
  → GE-AI-3D closed-loop [advisory only — no auto-mutation]
```

**Canonical decision fingerprint persists** from Decision through Preparation and Approval. Work Manager and Revenue Operator consume the same authority record.

---

# Implementation Modules

| Module | Path |
|--------|------|
| Authority types | `lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b.ts` |
| Authority builder | `lib/growth/aios/authority/growth-canonical-opportunity-authority-1b.ts` |
| Work Manager bridge | `lib/growth/work-manager/bridges/canonical-authority-work-manager-bridge-1b.ts` |
| Revenue Operator binding | `lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b.ts` |
| Recommendation gate | `lib/growth/aios/authority/growth-recommendation-authority-gate-1b.ts` |

### Integration points

- `runWorkManager({ canonicalAuthorityByLeadId })` — optional authority map
- `nextBestActionToWorkItem(action, timestamp, authorityByLeadId)` — bridge at conversion
- `bindRevenueOperatorOrchestrationToCanonicalAuthority({ result, canonicalAuthority })` — RO deferral
- `buildGrowthHomeAvaRecommendationExperience` — suppresses competing queue items for authoritative leads

---

# Certification

**Script:** `scripts/test-ava-growth-operator-1b-decision-authority.ts`

Evidence produced:

| Check | Result |
|-------|--------|
| One opportunity → one authority record | ✅ `buildCanonicalOpportunityAuthorityFromResolution` |
| Work Manager respects canonical actor | ✅ `requires_operator` false when 10B said true |
| No conflicting autonomy flags | ✅ `detectCanonicalAuthorityConflicts` empty after bind |
| Revenue Operator defers next action | ✅ `canonicalAuthorityBinding.authoritative === true` |
| Meta Recommender advisory role locked | ✅ `GROWTH_META_RECOMMENDER_AUTHORITY_ROLE` |
| Resource Allocation blocks outbound | ✅ `authorizeSpendForInvestmentState(..., "outbound") === false` |
| Recommendation deduplication | ✅ work_manager + daily_queue suppressed for bound lead |

---

# Final Verdict

**Does Ava now behave as a single AI Growth Operator with one authoritative decision model?**

**Yes — architecturally, for bound opportunities.**

When `canonicalAuthorityByLeadId` is provided, Work Manager, recommendation surfaces, and Revenue Operator binding all defer to Canonical Decision Engine 1A. The authority contract is unified; competing ownership and duplicate recommendations are eliminated for bound leads.

### Remaining blockers before AVA-GROWTH-OPERATOR-1C

| Blocker | Milestone |
|---------|-----------|
| Server-side bulk authority resolution for full portfolio (not just hero lead) | 1C prep |
| Escalation policy module replacing scattered `request_human_review` defaults | **1C** |
| Automatic authority map wiring in all `runWorkManager()` call sites | 1C |
| Admission auto-reject without operator review | 1C |
| Shadow-mode parity metrics (1A vs 10B agreement rate) in production telemetry | 1C |

1B completes **authority unification architecture**. 1C implements **escalation policy enforcement** and portfolio-wide authority hydration.

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-23 | Initial certification (AVA-GROWTH-OPERATOR-1B) |
