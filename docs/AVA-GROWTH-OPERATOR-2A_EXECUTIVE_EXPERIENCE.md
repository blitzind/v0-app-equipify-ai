# AVA-GROWTH-OPERATOR-2A — Executive Experience Simplification

Presentation-only UX refinement. No changes to intelligence, autonomy, canonical authorities, governance, or data models.

## Default Home surface (above the fold)

1. **Executive Briefing** — max 2 short paragraphs (what happened, what happens next)
2. **What I Need From You** — canonical approval / operator actions
3. **Current Recommendation** — executive headline; reasoning behind "Show Ava's reasoning"
4. **Current Objective** — primary business objective
5. **Portfolio Health** — compact health headline + fill bar
6. **Active Missions** — simplified cards (what / why / your action / after approval)

## Progressive disclosure ("Show details")

- Runtime trust / live activity
- Working now
- Progress metrics
- Completed today timeline
- Business snapshot
- Full portfolio manager panel
- Memory
- Strategic insight
- Executive growth intelligence report

Advanced operations and setup diagnostics remain collapsed as before.

## Duplicate narratives eliminated

- Hero skips "I need your review…" when Waiting on You handles approvals
- Workspace health hides duplicate "packages awaiting review" when hero mentions review
- Expanded overlap detection for hero ↔ waiting-on-you, hero ↔ recommendation
- Runtime trust "what happens next" suppressed when hero already states review need

## Recommendation language

Technical capacity phrasing is rewritten at presentation layer, e.g.:

- Before: "Autonomous preparation capacity exceeds review capacity…"
- After: "I've prepared three qualified opportunities. Reviewing them now will allow me to continue building the pipeline."

## Validation

All certification suites pass:

```bash
pnpm test:ava-growth-operator-2a-executive-experience   # PASS
pnpm test:ge-aios-home-operator-experience-2a            # PASS
pnpm test:ava-growth-operator-1f-platform-consolidation  # PASS
pnpm test:ava-growth-hotfix-1f-1d-canonical-training-state  # PASS (regression)
```

## Before / after operator workflow

### Before (2A)

- Activated operators saw compact hero + Waiting on You + Runtime Trust above the fold
- Recommendation, objective, portfolio, and missions were buried in collapsed "Work details"
- Pre-activation users saw the full diagnostic surface inline
- Same concepts repeated across hero, runtime trust, workspace health, and recommendation
- Technical capacity language ("preparation capacity exceeds review capacity")
- 3-paragraph hero briefing with operator-need line even when Waiting on You already surfaced approvals

### After (2A)

- **Unified executive surface** for all modes — six decision sections above the fold
- Runtime trust, live activity, progress, completed today, full portfolio, memory, and diagnostics collapse under **Show details**
- Recommendation reasoning collapses under **Show Ava's reasoning**
- Mission cards show what / why / your action / after approval; everything else per-card **Show details**
- Hero limited to 2 paragraphs; skips "I need your review…" when Waiting on You handles it
- Portfolio health is a compact headline + fill bar (full manager panel in Show details)

### Visual layout (default view)

```
┌─────────────────────────────────────────┐
│ Executive Briefing (compact hero)       │
│  • What happened / what happens next    │
├─────────────────────────────────────────┤
│ What I Need From You                    │
├─────────────────────────────────────────┤
│ Current Recommendation                  │
│  [Show Ava's reasoning ▼]               │
├─────────────────────────────────────────┤
│ Current Objective                       │
├─────────────────────────────────────────┤
│ Portfolio Health                        │
├─────────────────────────────────────────┤
│ Active Missions (simplified cards)      │
├─────────────────────────────────────────┤
│ ▶ Show details                          │
│   (runtime, activity, progress, etc.)   │
├─────────────────────────────────────────┤
│ ▶ Advanced operations                   │
└─────────────────────────────────────────┘
```

## Sections removed from default view

| Section | Now located |
|---------|-------------|
| Runtime trust / heartbeat | Show details |
| Working now | Show details |
| Progress metrics | Show details |
| Completed today | Show details |
| Workspace health | Show details |
| Full portfolio manager | Show details |
| Memory | Show details |
| Strategic insight | Show details |
| Executive growth report | Show details |
| Recommendation evidence / alternatives | Show Ava's reasoning |
| Mission blockers / expected outcomes | Per-mission Show details |

## Contradictory messaging resolved

- Hero no longer says "I need your review" when Waiting on You already lists pending packages
- Workspace health suppresses duplicate "packages awaiting review" when hero mentions review
- Runtime trust "what happens next" suppressed when hero already states review need
- Setup incomplete state uses canonical training projection (1D hotfix) — no "Ready for review" vs "needs training" conflict

## Key files

- `lib/growth/workspace/executive-briefing/growth-home-executive-experience-2a.ts`
- `lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b.ts`
- `components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx`
- `components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx`
- `components/growth/workspace/executive-briefing/growth-home-canonical-missions-section.tsx`
- `components/growth/workspace/executive-briefing/growth-home-executive-portfolio-health-section.tsx`
- `scripts/test-ava-growth-operator-2a-executive-experience.ts`

