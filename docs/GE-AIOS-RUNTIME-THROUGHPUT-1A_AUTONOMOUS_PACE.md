# GE-AIOS-RUNTIME-THROUGHPUT-1A — Autonomous Work Pace and Activity Truth

## 1. Timestamp root cause

Home showed **“Current work started recently”** alongside **“Last autonomous activity: 4 hours ago”** because two unrelated authorities were composed:

| UI field | Pre-fix source | Problem |
|---|---|---|
| Last autonomous activity | `salesOutcomes` from in-memory pilot stores + research-loop events; fallback to scheduler timestamp | ASL completions in `growth.research_runs` were invisible; empty pilot store after cold start → stale or scheduler-only timestamp |
| Current work started | Work-manager projection `activeWork.updated_at` at page load | Not a persisted execution claim — stamped when Home built the plan, not when Ava claimed work |
| Current runtime state | `activeWork.status === "working"` OR activity < 5 min | Showed **Working** from projected queue even when no canonical runtime event for hours |
| Last scheduled cycle | `growth.cron_execution_runs` | Correct authority — advanced even when ASL timed out |

**Conflict mechanism:** Work manager projected a “working” item on every Home load (recent `updated_at`), while last-activity feed read ephemeral/outdated outcome sources unrelated to current DB execution.

## 2. Throughput root cause

Production Equipify org (`00757488-1026-44a5-aac4-269533ac21be`) measurement (24h, canonical DB):

| Metric | Value |
|---|---|
| Scheduler cycles | 72 |
| Research completed | 24 |
| **Leads/hour** | **1.0** |
| **Leads/day** | **24** |
| Active research runs (queued/running) | 1 |
| Timed-out/failed scheduler cycles | 0 |

Architectural limiters (pre-fix):

1. **8s org timeout** wrapped entire ASL — research exceeds this → cycle aborted after one slow lead
2. **`maxIterations: 2`** per scheduler tick (often 1 after timeout)
3. **Break on first agent skip** — no fallback to next lead in queue
4. **20s sales-loop sub-budget** shared with objective reservation
5. Sequential org processing (acceptable for single canonical org)

## 3. Fixes applied (existing workers only)

### Activity truth
- `loadGrowthHomeCanonicalRuntimeActivity` reads **`growth.research_runs`**, **`organization_memory_events`**, active claims
- Presenter resolves last activity as **max(canonical, sales outcomes, scheduler)** — scheduler never wins over real work events when newer canonical data exists
- New operator state **`stale`** when projected assignment exists but no meaningful activity within 20 minutes
- `buildGrowthHomeSalesOutcomes` merges canonical **`research_runs`** completions (24h window)

### Throughput
- Scheduler **`maxIterations: 4`** (was 2)
- **Per-work-item timeout 25s** — slow lead yields, next candidate attempted
- **Continue on skip/failure** — excluded work items, loop continues until batch limit or budget
- **Org timeout floor 35s** (was 8s) — fair share of sales-loop budget

Constants: `lib/growth/specialists/execution/growth-runtime-throughput-1a.ts`

## 4. Production probe (dry run)

```
org: 00757488-1026-44a5-aac4-269533ac21be
leads selected: 1 (dry-run caps at 1 iteration)
iterations: 1
stop reason: none
canonical last activity: Started researching ventura systems cv
```

Live scheduler ticks (post-deploy) can select up to **4 work items/org** when budget allows.

## 5. Expected sustainable throughput

| Scenario | Leads/hour |
|---|---|
| Pre-fix measured | ~1 |
| Post-fix theoretical (4 items × 3 cycles/hr) | ~12 |
| Post-fix conservative (partial timeouts, skips) | **~6–8** |

Validation script estimate: **~2** immediately testable in dry-run probe context; full live gain requires deploy + next scheduler cycles.

## 6. Remaining blockers

1. **Sales-loop 20s sub-budget** — may still cap org wall before 4 items complete
2. **Research daily cap** (org budget 20/day after activation; pilot 10/hr)
3. **Dry-run probe** only validates selection path — live multi-lead completion needs post-deploy cron observation
4. **Outbound remains disabled** (by design)

## Validation

```bash
pnpm test:ge-aios-runtime-throughput-1a-wiring
pnpm validate:ge-aios-runtime-throughput-1a-production
```

Production validation score: **89/100** (read-only, Vercel env).
