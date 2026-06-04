# Growth Native Mailbox Warmup Execution (Phase 6.31A)

Native outbound is production-operational via Gmail transport and `sequence_execution_jobs`. Phase 6.31A adds **execution** on top of the existing warmup planning tables — counting real transport sends toward a deterministic ramp and enforcing daily caps at pre-send.

QA marker: `growth-native-warmup-execution-v1`

## Lifecycle

| Stage | Meaning |
|-------|---------|
| `new` | Profile created; schedule not started |
| `warming` | Ramp active; daily cap enforced |
| `active` | Ramp complete (100% progress); full target volume |
| `throttled` | Reputation/critical signals — sends blocked |
| `paused` | Operator pause |
| `disabled` | Retired profile |

## Day ramp (milestone interpolation)

| Day | Daily cap |
|-----|-----------|
| 1 | 5 |
| 3 | 10 |
| 7 | 20 |
| 14 | 35 |
| 21 | 50 |
| 30 | 75 |

## Architecture

```
growth-warmup-progression (cron, daily 00:15 UTC)
  → runNativeWarmupProgressionBatch
  → sync sender_accounts.daily_send_limit + warmup_enabled
  → advance current_warmup_day, reset sends_today

sequence transport send (unchanged job runner)
  → pre-send-infrastructure-guards
      → evaluateWarmupPreSendAllowed (cap / throttle / pause)
  → transport-orchestrator success
      → recordNativeWarmupSend (sends_today, schedule actual_volume)

sender pool rotation
  → reads warmup_profiles.warmup_progress (not hardcoded 50)
```

No changes to `sequence_execution_jobs`, approval APIs, or inbox/reply/SMS subsystems.

## Migration

Apply `supabase/migrations/20270704120002_growth_native_warmup_execution.sql` (after `20270704120001_growth_sms_reply_ingestion_source.sql`):

- Migrates `draft` → `new`, `completed` → `active`
- Adds `current_warmup_day`, `sends_today`, `sends_today_date`, throttle fields
- Adds `warmup_schedule.actual_volume`
- Extends platform timeline for `warmup_stage_changed`, `warmup_throttled`

## Cron

`POST /api/cron/growth-warmup-progression` — registered in `vercel.json` at `15 0 * * *` (daily).

## Operator flow

1. Create warmup profile (status `new`).
2. **Generate schedule** → `warming`; syncs `sender_accounts.daily_send_limit` to day-1 cap.
3. Approve/run sequence jobs as today — sends count toward warmup.
4. Cron advances day + caps; reputation may set `throttled`.
5. At 100% progress → `active`.
