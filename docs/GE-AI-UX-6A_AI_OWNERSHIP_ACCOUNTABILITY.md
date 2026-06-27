# GE-AI-UX-6A — AI Ownership & Accountability

**Phase:** GE-AI-UX-6A  
**Scope:** Presentation and orchestration only — Ava owns outcomes on Home. No backend, runtime, API, autonomy, workflow, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-6a-ai-ownership-accountability`

---

## Philosophy (locked)

Ava feels responsible for outcomes — not because she is human, but because she owns work. Every screen answers:

- What am I responsible for?
- What did I finish?
- What still needs me?
- What is waiting on the operator?

---

## UX audit — ownership transformation

| Area | Before (UX-5A) | After (UX-6A) |
|------|----------------|---------------|
| Active work | What I'm Working On (labels only) | **My Priorities** — title, why, progress, next step, waiting on me/you |
| Completed | Completed Today (metric cards) | **What I Accomplished** — narrative outcomes by business area |
| Operator actions | Needs Your Review | **Waiting On You** — primary list, max 5 |
| Goals | Business awareness only | **My Goals This Week** — progress bars from objectives |
| Highlights | Inline awareness | **My Biggest Win** + **Biggest Risk** featured cards |
| Status | Topbar only | **Today's workload** visualization |
| Closing | None | **Here's my recommendation.** — one grounded sentence |
| Voice | I found / I noticed | **I'm responsible for / monitoring / preparing / waiting for…** |

**QA marker:** `growth-ge-ai-ux-6a-ai-ownership-accountability-v1`

---

## Home layout (ordered)

1. Ava Check-In (ownership observations)  
2. **Waiting On You** (max 5)  
3. **My Priorities**  
4. **My Goals This Week**  
5. **What I Accomplished**  
6. **My Biggest Win** + **Biggest Risk**  
7. Today's workload  
8. Things I Noticed  
9. What I'm Watching  
10. Business Snapshot  
11. Timeline  
12. **Here's my recommendation.**  
13. Additional tools (collapsed)  

---

## Architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-ownership-accountability.ts` | Ownership copy, progress helpers, section titles |
| `lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer.ts` | Priorities, accomplishments, goals, waiting, win/risk, workload, executive rec |
| `components/growth/workspace/executive-briefing/growth-home-my-priorities-section.tsx` | My Priorities |
| `components/growth/workspace/executive-briefing/growth-home-accomplishments-section.tsx` | What I Accomplished |
| `components/growth/workspace/executive-briefing/growth-home-weekly-goals-section.tsx` | My Goals This Week |
| `components/growth/workspace/executive-briefing/growth-home-waiting-on-you-section.tsx` | Waiting On You |
| `components/growth/workspace/executive-briefing/growth-home-biggest-win-section.tsx` | My Biggest Win |
| `components/growth/workspace/executive-briefing/growth-home-biggest-risk-section.tsx` | Biggest Risk |
| `components/growth/workspace/executive-briefing/growth-home-ai-workload-section.tsx` | Workload bars |
| `components/growth/workspace/executive-briefing/growth-home-executive-recommendation-section.tsx` | Closing recommendation |

---

## Certification checklist

```bash
pnpm test:ge-ai-ux-6a-ai-ownership-accountability   # this phase
pnpm test:ge-ai-ux-5a-proactive-ai-initiative
pnpm test:ge-ai-ux-4a-ai-employee-experience
```

---

*GE-AI-UX-6A — complete locally (not committed).*
