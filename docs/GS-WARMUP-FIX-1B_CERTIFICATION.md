# GS-WARMUP-FIX-1B — Capacity-Aware Warmup Planning Certification

**Phase:** GS-WARMUP-FIX-1B  
**Status:** PASS (local cert)  
**Cert command:** `pnpm test:gs-warmup-fix-1b-capacity-planning`

---

## Summary

Warmup now calculates whether today's planned volume is mathematically achievable **before execution**, based on per-sender daily dedup and the approved recipient pool. Operators see planned vs maximum possible sends, capacity status, shortfall, and recommendations — without changing send behavior.

---

## Certified behaviors

| Requirement | Status |
|-------------|--------|
| Per-sender capacity: approved, used today, remaining, max additional | PASS |
| Fleet totals: warming senders, approved recipients, planned, achievable | PASS |
| `expectedMaxToday` and `capacityShortfall` exposed | PASS |
| Status: healthy / constrained / impossible | PASS |
| Dashboard API returns `daily_capacity_plan` | PASS |
| Command Center UI "Today's Plan" section | PASS |
| Executor preview/run attaches `dailyCapacityPlan` | PASS |
| Future-ready dedup policy enum (no behavior change) | PASS |
| No migrations | PASS |
| GS-WARMUP-FIX-1A regression | PASS |

---

## Status rules

| Status | Condition |
|--------|-----------|
| **healthy** | `totalPlannedToday <= totalAchievableToday` |
| **constrained** | `totalPlannedToday > totalAchievableToday` and achievable > 0 |
| **impossible** | `totalAchievableToday === 0` or planned exceeds theoretical maximum |

---

## Artifacts

| Path | Role |
|------|------|
| `lib/growth/warmup/warmup-capacity-engine.ts` | Reusable capacity calculator |
| `lib/growth/warmup/warmup-send-executor.ts` | `buildWarmupDailyCapacityPlan` + run attachment |
| `app/api/platform/growth/warmup/dashboard/route.ts` | Dashboard API |
| `components/growth/growth-warmup-executor-panel.tsx` | Operator UI |
| `scripts/test-growth-warmup-capacity-fix-1b.ts` | Certification script |
