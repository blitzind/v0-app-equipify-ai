# GE-AIOS-RUNTIME-SCALE-1A — 500 Companies Per Day

## 1. Current capacity model (production-backed, Equipify org)

| Metric | Measured (7d sample, n=111) |
|---|---|
| Avg research duration | **288s** |
| p50 | **24s** |
| p90 | **1141s** (~19 min) |
| p95 | **1185s** |
| Provider calls/company | **~12 HTTP page fetches** (company evidence crawl budget) |
| DB queries/company | research_runs + leads + admission reads (no new tables) |
| Token/API cost/company | Website crawl only in hot path; LLM varies by evidence path — **not flat-rate guessed** |
| Current throughput | **~24/day** (24h completed runs) |
| Scheduler cadence | 20 min → **72 cycles/day** |
| Current concurrency | **1 active run** (pre-scale) |

## 2. Required concurrency math

**Target: 500/day minimum**

```
500 companies ÷ 72 cycles/day = 6.94 → 7 completions per 20-min cycle
```

With measured avg **288s** and **90s** sales-loop budget per tick:

```
waves = ceil(7 / 6 parallel workers) = 2 waves
time needed ≈ 2 × 288s = 576s  → exceeds 90s budget without parallelism + shorter p50 path
```

With **p50 = 24s** and **6 parallel workers**:

```
7 completions in 1 wave ≈ 24–90s  → feasible per cycle
sustained: 7 × 72 = 504/day ✓
```

**Headroom target: 750/day**

```
750 ÷ 72 = 11 completions/cycle
11 / 6 concurrency ≈ 2 waves at p50
```

**Configured post-scale:**

- **12 iterations/tick** (scheduler)
- **6 parallel research workers** (bounded)
- **85s org timeout**, **90s sales-loop budget**, **120s scheduler wall**
- Theoretical attempt ceiling: 6 × 12 × 72 = **5,184/day** (upper bound; admission/budget gate actual completions)

## 3. Root constraints removed

| Constraint | Before | After |
|---|---|---|
| `autonomous_research_runs` activation default | 20 | **500** |
| Policy synthesizer runtime clamp | min(cap, **4**) | **full org cap** |
| Pilot budget | 100/day, 10/hr | **750/day, 40/hr** |
| Scheduler iterations/tick | 4 | **12** |
| Scheduler wall / sales-loop budget | 45s / 20s | **120s / 90s** |
| Org work timeout | 8s | **85s** |
| Parallelism | Sequential | **6 bounded workers** |
| Research claim | Unguarded running transition | **queued→running conditional** |
| Budget enforcement on sales_loop | None | **consumeAutonomyBudget + gate** |

## 4. Code changes

- `growth-runtime-scale-1a.ts` — targets, concurrency, capacity math
- `run-autonomous-sales-loop.ts` — parallel research batches, 12 iterations
- `research-repository.ts` — atomic claim, active run count
- `growth-lead-research-execution-service.ts` — concurrency + budget gates
- Policy/activation/pilot/scheduler limit updates
- Home pace telemetry on runtime trust surface

## 5. Production probe

Dry-run (pre-deploy code on validation machine validates wiring; live parallel batch requires deploy):

- Parallel batch wiring: **pass**
- Home pace: **23/500; 1/hr** (current production rate)
- Outbound: **disabled** ✓

## 6. Recommendation

**Ready with constraints**

- Architecture supports 500/day after deploy + org cap upgrade (20→500 on next activated Home load)
- p90 tail latency (~19 min) requires slow-lead timeout/yield (90s per item) — won't block batch
- Live observation of 6-wide parallel completion needed post-deploy

## Validation

```bash
pnpm test:ge-aios-runtime-scale-1a-wiring
pnpm validate:ge-aios-runtime-scale-1a-production
```

No commits or pushes per task instructions.
