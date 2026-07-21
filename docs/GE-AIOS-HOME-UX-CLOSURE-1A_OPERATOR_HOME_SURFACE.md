# GE-AIOS-HOME-UX-CLOSURE-1A — Operator Home Surface Closure

Closure audit and wiring correction for the approved operator Home experience (LAUNCH-1A/1B/1C). No redesign.

## Production render path

```
/growth
  app/(growth)/growth/page.tsx
    GrowthWorkspaceDashboardBody
      IF isGrowthWorkspacePriorityFeedActive() && !employeeMode
        GrowthWorkspacePriorityFeedDashboard   (UX-1A legacy — pre-activation only)
      ELSE
        GrowthHomeExecutiveBriefingDashboard
          employeeMode (= avaActivation.activated)
            operatorClosureMode = true
              Above fold: Hero (compact) → Runtime Trust (closure) → Waiting on you
              Below fold (collapsed): Work details, Advanced operations, Setup diagnostics
```

**Root cause:** `GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED` routed activated operators to the UX-1A priority feed, bypassing the executive briefing entirely.

**Fix:** Route activated Ava (`employeeMode`) to `GrowthHomeExecutiveBriefingDashboard` regardless of UX-1A flag.

## Audit table

| Requirement | Intended implementation | Production component (pre-fix) | Status | Fix |
|---|---|---|---|---|
| Single Home mount for activated Ava | `GrowthHomeExecutiveBriefingDashboard` | `GrowthWorkspacePriorityFeedDashboard` when UX-1A flag on | Fixed | `growth-workspace-dashboard-body.tsx`: skip priority feed when `employeeMode` |
| What Ava is doing now | `GrowthHomeAvaRuntimeTrustSection` (LAUNCH-1B) | Runtime trust + hero paragraphs + working now | Fixed | Closure mode; compact hero hides executive paragraphs |
| One primary company | `resolvePrimaryOperatorCompanyName` in closure-1a | Multiple sections showed different companies | Fixed | Primary assignment block in runtime trust |
| Pipeline step / progress | Runtime trust `currentActivity`, `nextMilestoneLabel` | Duplicated in working now + objective | Fixed | Working now / objective hidden above fold in closure mode |
| What Ava needs from Michael | `GrowthHomeAiOsWaitingOnYouSection` (1 item max) | Multiple waiting surfaces + package empty copy | Fixed | `operatorClosureMode`; approved no-action message |
| What happens next | `buildOperatorWhatHappensNextLines` | Recommendations + strategic insight + hero | Fixed | Dedicated block in runtime trust; recommendations below fold |
| Can close browser | `buildOperatorCanCloseBrowserLine` | Not surfaced | Fixed | Runtime trust closure footer |
| No executive reasoning above fold | Hero `compact` | Long hero paragraphs + continuous briefing | Fixed | `compact={operatorClosureMode}` on hero |
| No duplicate recommendations | Single surface below fold | `GrowthHomeAvaRecommendationExperienceSection` above fold | Fixed | Hidden when `operatorClosureMode`; moved to collapsed Work details |
| Secondary sections collapsed | `GrowthHomeCollapsibleSection` | Portfolio, missions, memory, advanced ops visible | Fixed | Work details + advanced ops + setup diagnostics default collapsed |
| LAUNCH-1C activation | `GrowthHomeAvaActivationSection` | Shown when not activated | OK | Returns null when `activation.activated` |

## QA markers

- `ge-aios-home-ux-closure-1a-operator-surface-v1` on briefing dashboard and runtime trust section
- `data-operator-closure-mode="true"` when `avaActivation.activated`

## Validation

```bash
pnpm test:ge-aios-home-ux-closure-1a-operator-surface
pnpm validate:ge-aios-home-ux-closure-1a-production
```

Production validation (Equipify org `00757488-1026-44a5-aac4-269533ac21be`, read-only): **100/100**

Above-the-fold snapshot at validation time:
- Status: Idle
- Primary company: tial products
- What happens next: discovery cycle + ~18 min scheduler
- Can close browser: Yes (autonomous mode active)
- No operator action required

## Files changed

- `components/growth/workspace/growth-workspace-dashboard-body.tsx`
- `components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx`
- `components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx`
- `components/growth/workspace/executive-briefing/growth-home-ava-runtime-trust-section.tsx`
- `components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx`
- `lib/growth/home/growth-home-operator-closure-1a.ts`
- `lib/growth/home/growth-home-runtime-trust-presenter-1b.ts`
- `lib/growth/home/growth-home-runtime-trust-types-1b.ts`
- `scripts/test-ge-aios-home-ux-closure-1a-operator-surface.ts`
- `scripts/validate-ge-aios-home-ux-closure-1a-production.ts`
