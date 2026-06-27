# GE-AI-9A — Autonomous Marketing Operator

**Phase:** GE-AI-9A  
**Scope:** Presentation and orchestration only — Ava owns the marketing department through Marketing Missions coordinated by Revenue Director. No backend, runtime, API, transport, scheduler, or migration changes.  
**Certification:** `pnpm test:ge-ai-9a-autonomous-marketing-operator`

---

## Philosophy (locked)

Marketing is no longer a collection of campaigns. Marketing becomes a **portfolio of Marketing Missions**. Revenue Missions create demand; Marketing Missions create opportunities. Both are coordinated by Revenue Director — never duplicate campaign engines or planners.

---

## Marketing mission lifecycle (existing stages, advisory)

Planning → Content → Creative → Audience → Campaign → Launch Ready → Running → Learning → Improving

---

## UX audit

| Area | Before (UX-8A) | After (UX-9A) |
|------|----------------|---------------|
| Marketing framing | Embedded in revenue outreach mission | **My Marketing Missions** (max 3) |
| Performance | Business snapshot metrics | **Campaign Performance** — human language only |
| Content | Approval queue counts | **Content I'm Preparing** — draft types from read models |
| Audience | Intelligence metrics | **Audience Intelligence** — segment insights with evidence |
| Business impact | Revenue forecast only | **Marketing Contribution** — pipeline, ROI, leads, meetings, revenue |
| Operator voice | Revenue missions only | Marketing initiative summary + voice lines |

**QA marker:** `growth-ge-ai-ux-9a-autonomous-marketing-operator-v1`

---

## Home layout (marketing sections)

After Revenue Mission sections:

1. **My Marketing Missions**  
2. **Campaign Performance**  
3. **Content I'm Preparing**  
4. **Audience Intelligence**  
5. **Marketing Contribution**  

---

## Data sources (read models only)

| Signal | Source |
|--------|--------|
| Marketing missions | Briefing priorities, campaign snapshot, approval queue, hot companies |
| Campaign performance | Replies/emails ratio, conversation alerts, opportunities |
| Content preparing | Pending drafts, approval jobs, inbox positive interest |
| Audience intelligence | Hot companies, engagement score, priority verticals |
| Contribution | Pipeline, activity, inbox, meetings, revenue briefing fields |
| Revenue Director path | Optional snapshot → communication engine plans |

---

## Operator controls

Marketing missions expose **Review mission** links only — no campaign launch, send, or transport actions.

---

## Certification checklist

```bash
pnpm test:ge-ai-9a-autonomous-marketing-operator   # this phase
pnpm test:ge-ai-8a-autonomous-revenue-operator
pnpm test:ge-ai-ux-7a-ai-relationship-continuity
```

---

## Future compatibility

Marketing Missions use the same mission architecture as Revenue, Customer Success, Service, Finance, and Operations — expandable without redesign.
