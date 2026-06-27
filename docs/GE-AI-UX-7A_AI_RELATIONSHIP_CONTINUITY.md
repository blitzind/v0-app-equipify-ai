# GE-AI-UX-7A — AI Relationship & Continuity

**Phase:** GE-AI-UX-7A  
**Scope:** Presentation and orchestration only — Ava feels like a long-term business partner with historical context. No backend, runtime, API, autonomy, workflow, scheduler, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-7a-ai-relationship-continuity`

---

## Philosophy (locked)

Ava should never feel like she starts over every time the user logs in. Every interaction acknowledges history. The operator should feel that Ava has been continuously working, remembering, and adapting. Everything shown must come from existing read models and historical data — never fabricate memory or invent conversations.

---

## UX audit — continuity transformation

| Area | Before (UX-6A) | After (UX-7A) |
|------|----------------|---------------|
| Home opening | Generic proactive check-in | **Since we last checked in…** with continuity bullets when session context exists |
| Progress framing | Today's activity only | **Since We Last Met** — Completed / Changed / Improved / Escalated / Waiting |
| Deltas | Mixed with static snapshot | **What Changed** — meetings, pipeline, replies, cooled opportunities only |
| Recommendations | Current stance only | **Recommendation Continuity** — previous vs current with evidence |
| Long-term view | Weekly goals only | **Our Progress** (expandable) — 7d / 30d / quarter aggregates |
| Wins | Biggest win card | **Milestones** — threshold celebrations from read models |
| Confidence | Labels only | **Trust & Confidence** — increase/decrease explanations |
| Time of day | None | **Daily Briefing** — morning / afternoon / evening from `generatedAt` |

**QA marker:** `growth-ge-ai-ux-7a-ai-relationship-continuity-v1`

---

## Home layout (ordered)

1. Ava Check-In (continuity opening when data exists)  
2. **Daily Briefing** (time-aware)  
3. **Since We Last Met**  
4. **What Changed**  
5. **Recommendation Continuity**  
6. **Milestones**  
7. **Our Progress** (collapsible)  
8. **Trust & Confidence**  
9. Waiting On You (max 5)  
10. My Priorities  
11. My Goals This Week  
12. What I Accomplished  
13. My Biggest Win + Biggest Risk  
14. Today's workload  
15. Things I Noticed  
16. What I'm Watching  
17. Business Snapshot  
18. Timeline  
19. Here's my recommendation.  
20. Additional tools (collapsed)  

---

## Data sources (read models only)

| Signal | Source |
|--------|--------|
| Previous session | `GrowthWorkspaceRecentView[]` + `GrowthWorkspaceContinueItem[]` (localStorage activity memory) |
| Timeline / deltas | Existing home timeline synthesizer + dashboard briefing metrics |
| Recommendations | Initiative recommendations + recent view context |
| Aggregates | Dashboard sections, briefing revenue/meetings/priorities |
| Daily briefing period | `dashboard.generatedAt` hour via `deriveDailyBriefingPeriod()` |

---

## Architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-relationship-continuity.ts` | Section titles, daily briefing copy, relationship time phrases |
| `lib/growth/workspace/executive-briefing/growth-home-continuity-synthesizer.ts` | Opening, since-we-last-met, what-changed, rec continuity, progress, milestones, trust, daily briefing |
| `components/growth/workspace/executive-briefing/growth-home-*-section.tsx` | Seven new continuity sections + check-in continuity branch |

---

## Certification checklist

```bash
pnpm test:ge-ai-ux-7a-ai-relationship-continuity   # this phase
pnpm test:ge-ai-ux-6a-ai-ownership-accountability
pnpm test:ge-ai-ux-5a-proactive-ai-initiative
pnpm test:ge-ai-ux-4a-ai-employee-experience
```

---

## Future compatibility

Section structure supports future memory domains (Marketing, Customer Success, Service, Finance, Operations) without redesign — each domain can append categorized items to **Since We Last Met** and **Our Progress** from its read models.
