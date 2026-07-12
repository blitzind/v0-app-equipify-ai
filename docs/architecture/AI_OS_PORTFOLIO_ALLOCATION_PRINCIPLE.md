# AI OS Portfolio Allocation Principle

**Document ID:** GE-AIOS-ARCH-2A (Portfolio Allocation)  
**Filename:** `AI_OS_PORTFOLIO_ALLOCATION_PRINCIPLE.md`  
**Status:** Permanent architecture lock  
**Effective:** 2026-07-11  
**Authority:** Platform-wide — every present and future Equipify AI OS autonomous specialist  
**Scope:** Global prioritization, portfolio states, capacity/resource awareness, Portfolio Ledger, cross-specialist coordination  
**Non-scope:** Per-subject spend authorization (see Resource Allocation), specialist execution tactics, provider SDKs  

**Related canonical docs:**
- Executive Constitution (GE-AIOS-EXEC-0): [`AI_OS_EXECUTIVE_CONSTITUTION.md`](./AI_OS_EXECUTIVE_CONSTITUTION.md)
- Organizational Knowledge & Learning (ARCH-4A): [`AI_OS_ORGANIZATIONAL_KNOWLEDGE_AND_LEARNING.md`](./AI_OS_ORGANIZATIONAL_KNOWLEDGE_AND_LEARNING.md)
- Objectives & Missions (ARCH-3A): [`AI_OS_OBJECTIVES_AND_MISSIONS.md`](./AI_OS_OBJECTIVES_AND_MISSIONS.md)
- Resource Allocation (ARCH-1A): [`AI_OS_RESOURCE_ALLOCATION_PRINCIPLE.md`](./AI_OS_RESOURCE_ALLOCATION_PRINCIPLE.md)
- AI Revenue Operator Constitution: [`AI_REVENUE_OPERATOR_CONSTITUTION_v1.0.md`](./AI_REVENUE_OPERATOR_CONSTITUTION_v1.0.md)
- Living engineering state: [`../MASTER_CONTEXT_DOCUMENT.md`](../MASTER_CONTEXT_DOCUMENT.md)
- Implementation ledger: [`../AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md`](../AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md)

---

## 1. Mission

Establish the second executive-level architecture principle for AI OS.

**ARCH-1A answers:**

> Has this account earned additional investment?

**ARCH-2A answers:**

> Of every possible place we could invest today, where should we invest first?

This architecture governs **global prioritization** across every autonomous specialist.

It is not owned by Sales.  
It belongs to **AI OS Core**.

---

## 2. Core philosophy

An excellent employee makes good decisions.  
An excellent executive makes good decisions **across all available opportunities**.

AI OS must operate like an executive.

Resources are finite.

Even if ten opportunities deserve additional investment, only a subset should receive it today.

The question is no longer only:

> Has this account earned another dollar?

The question becomes:

> **If I only have one dollar left to spend today, where will it produce the greatest return?**

---

## 3. Relationship to ARCH-1A

| Layer | Document | Question |
|-------|----------|----------|
| Resource Allocation | ARCH-1A | Has this subject earned additional investment? |
| Portfolio Allocation | ARCH-2A | Among eligible subjects, who gets scarce capacity first? |

**Both are required.**

Example:

- 100 leads qualify for additional investment (ARCH-1A: Increase Investment).
- DataMoon budget today allows only 20 enrichments.
- Portfolio Allocation decides which 20 receive investment now.

**Order of authority:**

```text
ARCH-1A Resource Allocation
        ↓
ARCH-2A Portfolio Allocation
        ↓
Specialist Judgment
        ↓
Execution
        ↓
Outcome
```

- Portfolio Allocation determines **where** the company should invest.  
- Resource Allocation determines **whether** that investment is justified.  
- Specialists determine **how** to execute.

**Hard rule:** Portfolio priority never authorizes scarce spend by itself.  
A subject must pass ARCH-1A (earn investment) **and** be selected by ARCH-2A (receive priority) before scarce execution proceeds.

Manager overrides influence **Portfolio Allocation only**. They do **not** bypass Resource Allocation.

---

## 4. Executive Portfolio Principle

Every autonomous specialist manages a portfolio:

| Specialist | Portfolio |
|------------|-----------|
| Sales | Prospects / accounts |
| Marketing | Campaigns |
| Service | Customers |
| Finance | Collections |
| Support | Tickets / issues |
| Operations | Workflows / automations |

The objective is never to maximize activity.  
The objective is to maximize **portfolio return**.

No specialist may optimize locally at the expense of the overall portfolio.

---

## 5. Portfolio Allocation Engine

Every specialist submits investment requests to a shared **AI OS Portfolio Allocation Engine**.

The engine determines:

- Which work should happen now?
- Which work should wait?
- Which work should be paused?
- Which work should be abandoned?
- Which work deserves additional investment relative to peers?

This is the executive layer above specialist autonomy.

---

## 6. Portfolio scoring

Portfolio decisions consider multiple dimensions. Examples:

- Expected Revenue  
- Estimated Lifetime Value  
- Probability of Success  
- Strategic Importance  
- Urgency  
- Time Sensitivity  
- Cost to Continue  
- Estimated Remaining Investment  
- Customer Lifetime Opportunity  
- Competitive Risk  
- Operational Capacity  
- Expected ROI  

**No single score determines priority.**  
The engine balances the portfolio.

---

## 7. Dynamic re-prioritization

Priorities are never static.

Every meaningful event may change portfolio ranking. Examples:

- Decision maker found  
- Customer replied  
- Budget exhausted  
- Email reputation degraded  
- DataMoon credits reduced  
- Competitor activity detected  
- Proposal accepted  
- Customer went silent  
- New enterprise opportunity admitted  

AI OS should continuously rebalance work.

---

## 8. Resource awareness

Portfolio Allocation must understand resource availability. Examples:

- Remaining DataMoon credits  
- LLM budget  
- Email sending capacity  
- Voice minutes  
- SMS allocation  
- Compute budget  
- Human approval capacity  
- Calendar availability  
- Customer attention  

If resources become constrained, the portfolio automatically rebalances.

---

## 9. Capacity management

Every specialist has finite daily capacity. Examples:

**Sales:** max personalized outreaches, meetings, research units  
**Marketing:** max campaign launches, content generation, ad spend  
**Support:** max escalations, technician time  

Capacity is part of prioritization.

---

## 10. Cross-specialist coordination

Specialists must not compete for scarce resources independently.

Example contention:

- Sales wants DataMoon enrichment  
- Marketing wants website analysis  
- Finance wants customer enrichment  
- Service wants customer profiling  

Portfolio Allocation decides who receives scarce resources first.

---

## 11. Portfolio states

Every opportunity always exists in exactly one portfolio state:

| State | Consumes meaningful scarce resources? |
|-------|----------------------------------------|
| Highest Priority | Yes |
| Active Investment | Yes |
| Queued | No (waiting for capacity) |
| Deferred | No |
| Monitoring | No (except scheduled low-cost review) |
| Paused | No |
| Archived | No |
| Completed | No |

Only **Highest Priority** and **Active Investment** consume meaningful resources.

---

## 12. Executive overrides

Managers may override priorities. Examples:

- VIP customer  
- Strategic account  
- Trade show prospect  
- Partner referral  
- Large opportunity  

Every override must be recorded.

**Overrides do not bypass Resource Allocation.**  
They only influence Portfolio Allocation.

---

## 13. Portfolio Ledger

Separate from the Resource Ledger.

| Ledger | Tracks |
|--------|--------|
| Resource Ledger (ARCH-1A) | What resources were consumed |
| Portfolio Ledger (ARCH-2A) | Why one opportunity was selected over another |

Every prioritization decision must be explainable and historically reconstructable.

---

## 14. Portfolio explanation

AI OS should always be able to answer:

- Why is this account receiving investment today?
- Why wasn’t another account selected?
- What higher-value opportunities displaced it?
- Why was this campaign paused?
- Why was this customer escalated?

Every executive decision should be explainable.

---

## 15. Universal AI OS Principle

Every specialist inherits this architecture.

| Specialist | Governing question |
|------------|--------------------|
| Sales | Which prospect deserves today’s investment? |
| Marketing | Which campaign deserves today’s budget? |
| Service | Which customer deserves today’s technician time? |
| Finance | Which collection deserves today’s effort? |
| Support | Which issue deserves escalation? |
| Operations | Which automation deserves compute? |

---

## 16. Relationship to AI OS Home

Eventually the AI OS Home screen should become a **portfolio dashboard**.

Not:

> What happened?

Instead:

> Here is how I allocated today’s resources.

Example shape:

- **I invested in:** 14 enterprise opportunities, 8 proposal-ready accounts, 5 retention cases  
- **I deferred:** 46 low-confidence prospects, 12 low-value service requests  
- **I stopped investment on:** 31 poor-fit accounts  

Every number should represent executive resource allocation, not activity volume.

---

## 17. Architecture requirements

Every specialist requesting resources must declare:

1. Current investment state (ARCH-1A)  
2. Requested resource  
3. Expected business outcome  
4. Estimated ROI  
5. Portfolio priority (requested / current)  
6. Capacity impact  
7. Strategic impact  
8. Why this work should happen before competing work  

---

## 18. Certification requirements

Every specialist must prove:

- Portfolio priorities are explainable  
- Scarce resources are allocated to the highest-value eligible opportunities  
- Lower-value work is automatically deferred  
- Portfolio changes dynamically as conditions change  
- Manager overrides are recorded  
- Resource Allocation and Portfolio Allocation remain **separate concerns**  
- Portfolio decisions can be reconstructed historically  
- Every future specialist inherits this architecture  
- Subjects in Stop Investment (ARCH-1A) never appear as Highest Priority / Active Investment consumers of scarce spend  

---

## 19. Design lock

AI OS should think like an executive team.

Individual specialists optimize individual accounts.  
The Portfolio Allocation Engine optimizes the business as a whole.

No specialist should optimize locally at the expense of the overall portfolio.

This principle is permanent and applies to every current and future AI OS specialist.

---

## 20. Amendment process

Substantive changes to this lock (portfolio states, mandatory engine rule, separation from ARCH-1A, certification invariants) require:

1. Explicit product/architecture ratification  
2. Update to this document’s version history  
3. Cross-link from Constitution amendment **or** Master Context / Implementation Ledger entry  
4. Updated specialist certification suites  

Cosmetic clarifications may update this file in place with a version-history note.

---

## 21. Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-11 | Initial permanent lock (GE-AIOS-ARCH-2A Portfolio Allocation) |

---

*Equipify AI OS — Portfolio Allocation Principle v1.0. Companion lock: `AI_OS_RESOURCE_ALLOCATION_PRINCIPLE.md`. Engineering state: `docs/MASTER_CONTEXT_DOCUMENT.md`.*
