# GE-AIOS-BURN-IN-1A — First Customer Validation

**Mode:** Operational validation only — no new engines, features, or dashboards.

**Marker:** `ge-aios-burn-in-1a-immediate-activation-tick-v1`

---

## 1. Immediate activation audit

### Before BURN-IN-1A

| Step | Behavior |
|------|----------|
| Click **Activate Ava** | Set `autonomy_enabled` + `autonomy_objective_mode_enabled`, record `autonomous_activated_at` |
| Work begins | **Waited up to 20 minutes** for `growth-objective-runtime-scheduler` cron |
| Operator experience | "Autonomous mode active" but no immediate proof of work |

### After BURN-IN-1A (bug fix — wiring only)

| Step | Behavior |
|------|----------|
| Click **Activate Ava** | Same kill switches + timestamp |
| Immediately after | **`runGrowthObjectiveRuntimeScheduler()`** — same function the production cron calls |
| Cron | Continues every 20 minutes unchanged |
| UI | **"What happened next"** lines from real tick telemetry (never simulated) |

If nothing is queued, Ava explains why and states the next scheduled cycle.

---

## 2. First five minutes — what to expect

Real lines may include (only if telemetry supports them):

1. Activation complete — I'm beginning work now.
2. Autonomous work started — N outcomes completed in this cycle.
3. Packages prepared for your review.

Refresh Home within 5 minutes to see `salesOutcomes` feed updates. If no outcomes yet, runtime trust shows idle/waiting with honest reason.

---

## 3. Daily operator workflow (7 days)

```
Open Home → Review runtime trust → Review recommendations → Review packages
→ Approve/reject → Close browser → Return later
```

**Do not** use developer tools unless Ava fails.

---

## 4. Production pipeline transitions to observe

| Transition | Production signal |
|------------|-------------------|
| Discovery | Mission runtime counters, discovery cron telemetry |
| Research | ASL + `research_completed` outcomes |
| Qualification | `qualification_completed` outcomes |
| Decision maker | Company intelligence cron + active work type |
| Buying committee | Buying committee cron |
| Package | Draft factory + `outreach_prepared` / approval queue |
| Operator review | `canonicalOperatorApproval` / Home waiting state |
| Approval → continues | Sequence safe execute (approval-gated) |

Any observed break = **P0 launch blocker** during burn-in.

---

## 5. Issue classification

| Level | Definition | Action |
|-------|------------|--------|
| **P0** | Ava cannot work (stall, wrong state, scheduler down, pipeline stop) | Fix immediately |
| **P1** | Trust damage (misleading status, wrong company, stale activity) | Fix during burn-in |
| **P2** | UX polish (wording, layout, timestamps) | Log only |
| **P3** | New ideas | Backlog — do not implement |

---

## 6. Daily burn-in report template

Copy into `docs/burn-in/DAY-N.md` each day:

```markdown
# Burn-in Day N — YYYY-MM-DD

## Production uptime
- Scheduler last run:
- Scheduler ok:

## Work completed
- Companies discovered:
- Companies researched:
- Packages created:
- Packages approved:

## Operator session
- Time on Home:
- Approvals given:
- Issues noticed:

## Issues
| ID | P | Summary | Status |
|----|---|---------|--------|

## Counts
- P0: 0  P1: 0  P2: 0  P3: 0

## Confidence (1-10):
## Notes:
```

---

## 7. Validation commands

```bash
pnpm test:ge-aios-burn-in-1a-immediate-activation     # wiring ✓
pnpm validate:ge-aios-burn-in-1a-production           # read-only gates
pnpm validate:ge-aios-burn-in-1a-production -- --probe-immediate-tick  # runs one scheduler tick
```

---

## 8. Known starting state (Equipify production)

- Autonomy: **enabled**
- Employee mode: **active** (backfilled)
- Immediate tick: wired for **new activations**
- Activity feed: empty until real outcomes occur

---

## 9. Initial issue backlog (pre burn-in)

### P0
- None confirmed after immediate tick wiring (re-validate on fresh org activation)

### P1
- Home loader budget timeouts drop some runtime signals under load
- Cert actor UUID doesn't reflect real operator onboarding in validation scripts
- Discovery cron events not in Home activity feed

### P2
- `GrowthAutonomyStatusBanner` in advanced ops (engineering language)
- Migration `20270721190000` must be applied for precise `activated_at`

### P3 (deferred)
- Granular per-step discovery feed lines
- Additional employment analytics
- New dashboards

---

## 10. Scores (pre burn-in baseline)

| Metric | Score |
|--------|-------|
| Operator confidence | **72/100** — trust UI wired; 7-day proof pending |
| Launch readiness | **78/100** — architecture complete; burn-in not started |
| Immediate activation | **Fixed** — scheduler invoked on activate |

---

## 11. Recommendation

**Ready with minor fixes** — begin the 7-day operator burn-in now.

Final certification question:

> *"If Ava were a real employee, would I keep her after her first week?"*

Answer after Day 7 only. Until then: operate as manager, not developer.
