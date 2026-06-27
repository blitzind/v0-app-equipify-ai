# GE-AI-UX-5A — Proactive AI Initiative

**Phase:** GE-AI-UX-5A  
**Scope:** Presentation and orchestration only — proactive observations, recommendations with evidence, business awareness. No new AI models, autonomy, workflow, repository, dispatch, transport, scheduler, API, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-5a-proactive-ai-initiative`

---

## Philosophy (locked)

Ava never simply reports activity — she demonstrates initiative. Every recommendation is backed by existing read models. No fabricated insights, speculation, or invented work.

---

## UX audit — initiative transformation

| Area | Before (UX-4A) | After (UX-5A) |
|------|----------------|---------------|
| Home opening | "While you were away I:" + completed checklist | **"Here's what I found since your last visit."** + insight bullets |
| Observations | Mixed in check-in | **Things I Noticed** — I found / noticed / detected with evidence |
| Monitoring | Working On only | **What I'm Watching** — active monitored items |
| Recommendations | Generic headline + impact | **What I Recommend** — because + evidence + confidence + priority |
| Confidence | Percentages in copy | **High / Medium / Needs more evidence** (percentages Advanced only) |
| Priority | Engineering urgency | **Handle Today / Worth Reviewing / Keep An Eye On / Can Wait** |
| Context | Business snapshot only | **Business awareness** — This Week, This Month, Current Objective, Top Win, Biggest Risk |

**QA marker:** `growth-ge-ai-ux-5a-proactive-ai-initiative-v1`

---

## Home layout (ordered)

1. Ava Check-In — proactive found narrative  
2. Things I Noticed  
3. Business awareness  
4. What I Recommend  
5. What I'm Watching  
6. Completed Today  
7. What I'm Working On  
8. Needs Your Review  
9. Business Snapshot  
10. Timeline  
11. Everything I Accomplished  
12. Additional tools (collapsed)  

---

## Architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-proactive-initiative.ts` | Initiative copy, confidence/priority labels, helpers |
| `lib/growth/workspace/executive-briefing/growth-home-proactive-initiative-synthesizer.ts` | Read-model synthesis for noticed, watching, recommendations, awareness |
| `components/growth/workspace/executive-briefing/growth-home-things-noticed-section.tsx` | Things I Noticed |
| `components/growth/workspace/executive-briefing/growth-home-watching-section.tsx` | What I'm Watching |
| `components/growth/workspace/executive-briefing/growth-home-business-awareness-section.tsx` | Business awareness cards |
| `components/growth/workspace/executive-briefing/growth-home-initiative-recommendations-section.tsx` | Recommendations with evidence |

All data sourced from `GrowthWorkspaceDashboardViewModel` + Aiden daily briefing (same read models that feed Revenue Director projections on Home).

---

## Recommendation shape

Each initiative recommendation includes:

- **headline** — "I recommend … because …"  
- **whyItMatters**  
- **recommendedAction**  
- **confidenceLabel** — High / Medium / Needs more evidence  
- **priorityLabel** — Handle Today / Worth Reviewing / Keep An Eye On / Can Wait  
- **evidence** — string array from read models  

Grouped by: Opportunities, Risks, Follow-up, Revenue, Campaigns, Meetings, Learning.

---

## Certification checklist

```bash
pnpm test:ge-ai-ux-5a-proactive-ai-initiative   # this phase
pnpm test:ge-ai-ux-4a-ai-employee-experience
pnpm test:ge-ai-ux-3a-ai-teammate-identity-foundation
pnpm test:ge-ai-ux-3b-ai-teammate-server-identity
pnpm test:ge-ai-ux-2a-outcome-first-unified-experience
```

---

## Screenshots

Capture locally after `pnpm dev` at `/growth`:

1. Proactive check-in — "Here's what I found" bullets  
2. Things I Noticed with evidence lines  
3. Business awareness cards  
4. Recommendation with confidence + priority badges  
5. What I'm Watching list  

---

*GE-AI-UX-5A — complete locally (not committed).*
