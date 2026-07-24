# AVA-GROWTH-HOTFIX-2B-1A — Home Runtime Latency and False Empty-State Elimination

## Root cause

Production Home used a **45s all-or-nothing client fetch** for `workspace-summary`. On timeout, cancel, or HTTP failure the client **cleared `workspaceSummary`**, rebuilt an empty dashboard, and the executive synthesizer interpreted missing/null approval data as **confirmed zero pending** → **Idle**, empty waiting-on-you, and hidden missions/recommendation.

On the server, approval loader timeouts were normalized through `emptyCanonicalOperatorApprovalSnapshot()` (`pendingApprovalCount: 0`), which looked identical to a **confirmed empty queue**.

Secondary loaders (`ai-teammate` 500, `default-views` cancel) compounded the problem but were not the primary data loss — the **false empty synthesis from loader failure** was.

## Stage timing (server)

| Stage | Budget | Role |
| --- | --- | --- |
| `lead_pool` | unbounded (existing) | Shared lead pool |
| `critical_executive_stage_wall` | ≤ max(approval 8s, training 6s) parallel | Approvals + training **first** |
| Secondary fan-out | per-loader budgets | Portfolio, missions, trust, intelligence |
| Client boundary | **12s** | Abort + preserve last confirmed state |

`optimization.stageTimingsMs` on the workspace-summary payload records per-label durations.

## `ai-teammate` HTTP 500

- **Failing function:** `loadAiTeammateIdentity` → `getPlatformPersonaOnboardingCompletedForUser` (DB/preferences read)
- **Repair:** GET returns HTTP 200 with default Ava identity + `degraded: true` instead of HTTP 500
- **Blocks Home?** No — presentation-only; Home executive state no longer depends on clearing when this fails

## Critical vs secondary loader map

| Critical (first render) | Secondary (progressive) |
| --- | --- |
| Canonical approvals | Live activity / runtime trust |
| Canonical training | Completed today |
| Activation fallback | Full portfolio manager |
| Recommendation / objective / missions (from critical approval path) | Memory, strategic insight, diagnostics |
| Compact portfolio health | Executive growth intelligence |

## Duplicate work removed

- Approval snapshot + canonical training moved to **`loadGrowthHomeCriticalExecutiveStage`** immediately after lead pool (was after ~700 lines of secondary loaders).
- Training from critical stage reused when available; secondary training load skipped.

## Fallback-state changes

| State | Behavior |
| --- | --- |
| Confirmed empty | Only case that may show “nothing waiting” / Idle |
| Confirmed active | Ready for Review, packages visible |
| Unavailable | Banner: *Ava's latest briefing is still loading…* — no Idle downgrade |
| Partial / last known | Session cache + in-memory preserve on fetch failure |
| Loader error | Truthful message; retained executive projection |

## Before / after request timeline

**Before:** Single 45s `workspace-summary` → fail → `payload: null` → wipe UI → Idle.

**After:** 12s client timeout → fail → retain session cache + last summary → background retry with request sequence guard → critical server stage completes approvals/training in parallel ≤8s before secondary work.

## Production validation

1. Open Home with org that has pending packages.
2. Confirm Ready for Review + package count within ~3s (cached) / ≤12s (fresh).
3. Throttle network; cancel `workspace-summary` — packages and status must **not** clear.
4. Break `ai-teammate` — Home briefing remains populated; Ava name falls back to default.
5. Verify package review links remain `/growth/review?tab=packages&item={packageId}`.

## Certification

```bash
pnpm test:ava-growth-hotfix-2b-1a-home-runtime
pnpm test:ava-growth-operator-2b-routing-convergence
pnpm test:ava-growth-operator-2a-executive-experience
pnpm test:ava-growth-hotfix-1f-1d-canonical-training-state
pnpm test:ava-growth-operator-1f-platform-consolidation
pnpm build
```
