# GE-AI-8A — Autonomous Revenue Operator

**Phase:** GE-AI-8A  
**Scope:** Presentation and orchestration only — Ava owns revenue missions end-to-end on Home by abstracting existing workflow state through Revenue Director coordination. No backend, runtime, API, transport, scheduler, or migration changes.  
**Certification:** `pnpm test:ge-ai-8a-autonomous-revenue-operator`

---

## Philosophy (locked)

Ava should stop waiting for work. She continuously owns one objective: **generate qualified revenue opportunities**. Every workflow should naturally progress unless blocked by policy or the operator. Revenue Director remains the coordinator — Home never duplicates orchestration engines.

---

## UX audit — revenue operator transformation

| Area | Before (UX-7A) | After (UX-8A) |
|------|----------------|---------------|
| Operator voice | "I prepared…" / continuity bullets | **"I'm driving N active revenue missions."** |
| Work framing | Individual priorities | **Revenue Missions** with lifecycle stages |
| Progress | Weekly goals only | Mission progress, stage, blocker, next milestone |
| Timeline | Event timeline | **Revenue Mission Timeline** — stage progression |
| Planning | Recommendations only | **Next Planned Actions** from existing plans (no scheduler) |
| Forecast | Business snapshot | **Revenue Forecast** from Revenue Director read models |
| Controls | Generic CTAs | Pause / Resume / Review / Open approvals only |

**QA marker:** `growth-ge-ai-ux-8a-autonomous-revenue-operator-v1`

---

## Mission lifecycle (existing stages, orchestrated)

Research → Qualification → Planning → Communication → Approval → Outbound → Replies → Meetings → Opportunities → Won

Each stage maps to existing Workflow Agent and approval paths. Revenue Director synthesizes presentation; it does not dispatch.

---

## Home layout (mission sections)

1. Ava Check-In (operator mission summary)  
2. **My Active Revenue Missions** (max 3)  
3. **Mission Health**  
4. **Revenue Forecast**  
5. **Next Planned Actions**  
6. **Revenue Mission Timeline**  
7. Daily Briefing + continuity sections (UX-7A)  
8. Ownership sections (UX-6A)  
9. Additional tools (collapsed)  

---

## Data sources (read models only)

| Signal | Source |
|--------|--------|
| Active missions | Dashboard briefing + pipeline/campaign/inbox metrics |
| Revenue Director path | Optional `GrowthRevenueDirectorCommandCenterSnapshot` → `missionFramework` + `activeMissions` |
| Mission health | Derived mission status (healthy / waiting / blocked / needs review / completed) |
| Planned actions | Briefing priorities, approval queue, meta-recommender (when snapshot present) |
| Forecast | Weighted pipeline, revenue briefing, engagement score |

---

## Operator controls (allowed only)

- Pause mission  
- Resume mission  
- Review mission  
- Open approvals  

**Never:** Send now, Override policy, Skip approval

---

## Architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-autonomous-revenue-operator.ts` | Section titles, lifecycle labels, forbidden controls |
| `lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer.ts` | Missions, timeline, planning, forecast, health |
| `components/growth/workspace/executive-briefing/growth-home-*-section.tsx` | Five new Home sections |

---

## Certification checklist

```bash
pnpm test:ge-ai-8a-autonomous-revenue-operator   # this phase
pnpm test:ge-ai-ux-7a-ai-relationship-continuity
pnpm test:ge-ai-ux-6a-ai-ownership-accountability
```

---

## Future compatibility

Revenue Mission abstraction expands to Marketing, Customer Success, Service, Finance, and Operations missions without redesign — each domain adds mission records from its read models through the same synthesizer input shape.
