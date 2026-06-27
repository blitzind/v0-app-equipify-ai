# GE-AI-UX-4A — AI Employee Experience

**Phase:** GE-AI-UX-4A  
**Scope:** Presentation and orchestration only — Home check-in, AI status, first-person timeline, work sections. No autonomy, workflow, repository, dispatch, transport, scheduler, API, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-4a-ai-employee-experience`

---

## Product philosophy (locked)

Every visit to AI OS answers three questions immediately:

1. **What did Ava accomplish?**
2. **What is Ava working on now?**
3. **What does Ava need from me?**

Everything else is secondary or collapsed.

---

## UX audit — Home transformation

| Area | Before (UX-3A) | After (UX-4A) |
|------|----------------|---------------|
| Opening | Third-person brief (“Ava handled…”) | **First-person check-in** (“While you were away I:”) |
| Completed work | Mixed in brief bullets | **Completed Today** section with outcome cards |
| Active work | “Ava is handling” grid | **What I'm Working On** — active items only |
| Approvals | Exceptions & Approvals | **Needs Your Review** — natural groups |
| Timeline | Third-person / system events | **First-person work journal** (“I prepared…”) |
| Status | Static “Working” in topbar | **Persistent status** from read models |
| Extra detail | Visible recommendation card | Collapsed under **Show additional tools** |

---

## Home layout (ordered)

1. Ava Check-In  
2. Completed Today  
3. What I'm Working On  
4. Needs Your Review  
5. Business Snapshot  
6. Timeline  
7. Everything I Accomplished (expandable)  
8. Additional tools (collapsed) — recommendation + legacy widgets  

**QA marker:** `growth-ge-ai-ux-4a-ai-employee-home-briefing-v1`

---

## Architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-employee-experience.ts` | Check-in copy, review buckets, status types, first-person helpers |
| `lib/growth/workspace/executive-briefing/growth-home-employee-voice.ts` | First-person timeline translation |
| `lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts` | Extended synthesizer — check-in, completed, working, review, work summary, status |
| `components/growth/ai-teammate/ai-employee-status-provider.tsx` | Persistent status context for topbar + pages |
| `components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx` | Check-in hero |
| `components/growth/workspace/executive-briefing/growth-home-completed-today-section.tsx` | Completed outcomes |
| `components/growth/workspace/executive-briefing/growth-home-working-on-section.tsx` | Active work |
| `components/growth/workspace/executive-briefing/growth-home-needs-review-section.tsx` | Review groups + attention items |
| `components/growth/workspace/executive-briefing/growth-home-work-summary-section.tsx` | Expandable full summary |

---

## Needs Your Review groups

| Group | Source |
|-------|--------|
| Ready to send | `approval_queue.pending_drafts` |
| Ready to activate | `approval_queue.pending_jobs` |
| Needs your decision | Remaining sequence approvals |
| Waiting on approval | Fallback when buckets are empty |
| Blocked | `summary.blocked_jobs` |

---

## AI status (persistent)

Derived from existing dashboard read models:

| Status | When |
|--------|------|
| Waiting for approval | Pending approvals > 0 |
| Monitoring replies | Replies needing attention |
| Preparing outreach | Active campaigns / drafts |
| Researching opportunities | Leads + hot companies |
| Working | Default active state |
| Idle | No recent activity and empty queue |

Wired in **Home**, **AI Operations**, and **topbar** via `AiEmployeeStatusProvider`.

---

## Personality rules

- Professional tone — no consciousness, no unnecessary apologies  
- Never fabricate work — all counts from read models  
- Never expose engine names in default UI  
- Check-in uses **I**; presence labels may use teammate name (“Ava is researching…”)  

---

## Certification checklist

```bash
pnpm test:ge-ai-ux-4a-ai-employee-experience   # this phase
pnpm test:ge-ai-ux-3a-ai-teammate-identity-foundation
pnpm test:ge-ai-ux-3b-ai-teammate-server-identity
pnpm test:ge-ai-ux-2a-outcome-first-unified-experience
```

---

## Screenshots

Capture locally after starting the dev server:

1. Home — Ava check-in with completed/focus/review lines  
2. Completed Today + Working On sections  
3. Needs Your Review groups  
4. First-person Timeline  
5. Topbar status badge  
6. Expanded “Everything I Accomplished”  

---

*GE-AI-UX-4A — complete locally (not committed).*
