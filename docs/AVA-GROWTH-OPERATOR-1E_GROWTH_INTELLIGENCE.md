# AVA-GROWTH-OPERATOR-1E — Growth Intelligence & Continuous Optimization

**Milestone:** Consolidate existing learning systems into executive growth recommendations.  
**Certification:** `pnpm test:ava-growth-operator-1e-growth-intelligence`

Builds on [1A–1D executive operating model milestones](./AVA-GROWTH-OPERATOR-1D_EXECUTIVE_EXPERIENCE_ALIGNMENT.md).

---

## Executive Summary

Ava now operates as a **Growth Executive** who continuously evaluates portfolio, ICP, discovery, outreach, and resource performance — and **recommends** improvements while the operator retains final authority.

**Optimization model:**

```
Observe (closed-loop, market intelligence, portfolio health, sales outcomes)
        ↓
Learn (existing learning repository + segment analytics — no duplicate engine)
        ↓
Identify trends (segment under/over-performance, channel patterns, bottlenecks)
        ↓
Recommend improvements (executive first-person recommendations)
        ↓
Await operator approval (never auto-mutate ICP, budgets, providers, policies)
        ↓
Continue learning
```

---

## Growth Intelligence Audit

### Existing capabilities reused

| System | Role in 1E |
|--------|------------|
| **Closed-loop Learning (GE-AI-3D)** | Channel, message, ICP, research, approval friction insights |
| **Market Intelligence Loop (1A)** | ICP add/remove/expand recommendations from segment performance |
| **Portfolio Manager (1A)** | Portfolio health, rejection rates, research concurrency |
| **Meta-Recommender (2F)** | System/objective-level optimize/monitor signals (advisory) |
| **Mission Discovery** | Pipeline-low → discovery budget recommendations |
| **Organizational Evidence (3B)** | Learning gap identification |
| **Sales Outcomes (17A)** | Approval backlog + daily accomplishment reporting |
| **Adaptive Calibration (PROD-2/3)** | Unchanged — operator-gated apply path for approved proposals |

### New recommendation capabilities (presentation layer only)

| Module | Purpose |
|--------|---------|
| `growth-executive-growth-intelligence-collectors-1e.ts` | Maps existing read models → unified executive recommendations |
| `growth-executive-growth-intelligence-synthesizer-1e.ts` | Ranks, dedupes, builds Executive Growth Report |
| `growth-executive-growth-intelligence-server-1e.ts` | Server composition for Home workspace summary |
| `growth-home-executive-growth-report-section.tsx` | Home UI — VP Growth briefing |

### Remaining gaps (non-blocking for 1E)

- Provider-specific scorecards not yet unified in executive report (scattered across prospect-search / contact-discovery)
- Outreach analytics (sequence-intelligence, channel-effectiveness) not fully wired as separate collectors — partially covered by closed-loop insights
- Meta-Recommender lead-scoped items intentionally excluded (1B authority — per-opportunity execution stays with Canonical Decision Engine)
- Batch approval of strategic recommendations (apply ICP changes) still routes through existing Market Intelligence proposal → Company Profile flow

---

## Recommendation Catalog

Ava can now produce executive recommendations in these categories:

| Category | Examples |
|----------|----------|
| **ICP** | Expand Commercial Kitchen Equipment; retire Electrical Utilities; update targeting |
| **Discovery** | Shift discovery toward high-qualification industries; retire zero-yield segments |
| **Research** | Reduce concurrent research depth; tighten qualification after high auto-reject rates |
| **Outreach** | Adjust channel/message based on closed-loop channel_performance insights |
| **Portfolio** | Prioritize replenishment; tighten qualification rules |
| **Providers** | *(via discovery/segment signals — dedicated provider scorecard deferred)* |
| **Budget** | Increase discovery allocation when pipeline is low |
| **Messaging** | Test shorter first-touch variants (closed-loop message_performance) |
| **Automation** | Clear approval backlog before adding research volume |
| **Growth Strategy** | Meta-recommender system-level optimize signals |
| **Executive Planning** | Objective progress insights from closed-loop |
| **Organizational Learning** | Improve evidence completeness for better recommendations |

Every recommendation includes: **reason**, **supporting evidence**, **expected impact**, **confidence band**, and **requires operator approval**.

---

## Operator Governance

Verified in `growth-executive-growth-intelligence-governance-1e.ts`:

| Policy | Value |
|--------|-------|
| Recommendation only | ✅ |
| Requires operator approval | ✅ |
| Auto-mutate ICP | ❌ |
| Auto-mutate messaging | ❌ |
| Auto-mutate budgets | ❌ |
| Auto-mutate providers | ❌ |
| Auto-mutate policies | ❌ |
| Auto-mutate outbound | ❌ |

Strategic mutations continue through existing operator-gated paths (Market Intelligence → Company Profile draft, Adaptive Calibration apply).

---

## Executive Growth Report (Sample)

When runtime data includes segment and learning signals, Ava's Home briefing includes:

**Executive Growth Report — How I'm improving our growth organization**

**What improved**
- Researched 12 companies
- Prepared 3 outreach packages
- Identified 2 strong opportunities

**What I recommend we change**
- *I recommend retiring Electrical Utilities from discovery.* — Zero qualified opportunities across 214 evaluated companies.
- *I recommend expanding Commercial Kitchen Equipment discovery.* — Significantly stronger admission quality vs other segments.
- *I recommend we test variant based on email outperforming linkedin.* — Shorter first-touch emails outperform longer messages.

**Where we should focus next**
- Retire underperforming discovery segments
- Expand high-converting industries
- Clear approval queue before increasing research volume

**Decisions requiring your approval**
- Each recommendation listed with confidence band — nothing applies without your approval.

*Show Ava's Work* expands: resource waste analysis, ICP/discovery/outreach intelligence sections, organizational learning observations.

---

## Certification Chain

```
Observe (existing systems)
        ↓
Learn (closed-loop repository — no duplicate engine)
        ↓
Identify trends (collectors-1e)
        ↓
Recommend improvements (synthesizer-1e)
        ↓
Await operator approval (governance-1e)
        ↓
Continue learning
```

Run: `pnpm test:ava-growth-operator-1e-growth-intelligence`

Also verify prior milestones still pass:
- `pnpm test:ava-growth-operator-1d-executive-experience`
- `pnpm test:ava-growth-operator-1c-escalation-authority`

---

## Final Verdict

**Can Ava now continuously improve the growth organization rather than merely operate it?**

**Yes.** Ava synthesizes portfolio, ICP, discovery, outreach, and organizational learning signals into proactive executive recommendations with a unified growth report on Home.

**Does Ava behave like an executive responsible for growth strategy as well as execution?**

**Yes, with bounded scope.** Ava recommends strategic changes in first-person executive voice; execution and mutation remain operator-governed. She reports what improved, what declined, what's wasting resources, and what requires approval.

**Remaining gaps before AVA-GROWTH-OPERATOR-1F:**

- Unified provider performance scorecard in executive report
- Direct wiring of outreach analytics collectors (sequence timing, persona reply rates)
- Strategic recommendation apply UX (one-click approve ICP changes from growth report)
- Closed-loop → autonomous scope expansion (1A deferred R7 enforcement at code level)

**Verdict: 1E certified** for growth intelligence consolidation on primary operator surfaces.
