# Growth Native Outbound Cutover (Phase 6.30D)

Production hardening to make **standalone** (`sequence_execution_jobs` → Gmail transport) the only active scheduling and execution path, while preserving adapter/Lemlist code for rollback.

QA marker: `growth-native-outbound-cutover-v1`

## Environment

| Variable | Production intent | Notes |
|----------|-------------------|--------|
| `GROWTH_OUTBOUND_MODE` | `standalone` | Code default after 6.30D. Verify in Vercel project env. |
| `GROWTH_ALLOW_ADAPTER_OUTBOUND` | unset / `false` | Must be `true` **with** `adapter` mode to re-enable outreach_queue writes and Lemlist execute. |
| `CRON_SECRET` | set | Required for remaining Growth crons. |
| `GROWTH_PROVIDER_CREDENTIALS_PEPPER` | set | Required for live transport credentials. |

Rollback pair:

```bash
GROWTH_OUTBOUND_MODE=adapter
GROWTH_ALLOW_ADAPTER_OUTBOUND=true
```

Then restore `growth-outreach-execute` in `vercel.json` and redeploy.

## Scheduling plane

| Path | When active |
|------|-------------|
| `growth-sequence-scheduler` → `queueSequenceStepTransportJob` | Default (standalone + cutover guards) |
| `growth-sequence-scheduler` → `queueSequenceStepOutreach` | `adapter` + `GROWTH_ALLOW_ADAPTER_OUTBOUND=true` |
| `growth-sequence-safe-execute` | Always (native job runner) |
| `growth-outreach-execute` | **Removed from Vercel cron**; route returns 410 unless rollback env |

## Safety guards

- `insertGrowthOutreachQueueItem` / `executeGrowthOutreachQueueItem` — assert adapter allowed
- POST `/api/platform/growth/outreach/queue` (+ approve/execute/replay) — HTTP 410 + cutover payload
- Manual enrollment queue API — routes to `queueSequenceStepTransportJob` when adapter disabled
- UI: `/admin/growth/outreach/approval` → redirects to `/admin/growth/sequences/execution`
- Phase 6.35D: Lemlist operator UI archived read-only; legacy queue at `/admin/growth/outreach/legacy-queue` (see `docs/GROWTH_LEMLIST_DECOMMISSION_6.35D.md`)

## Webhooks (operator)

Disable Lemlist (and other adapter) outbound webhooks in provider consoles during cutover. Re-enable only on rollback.

No new SQL migration in 6.30D — config and application guards only.

## Operations API

`GET /api/platform/growth/operations/outbound` includes `native_cutover` status from `describeGrowthNativeOutboundCutoverStatus()`.

## Inventory SQL

Re-run `scripts/sql/growth-native-cutover-inventory-6.30b1.sql` after deploy to confirm gate `LIKELY_READY_FOR_MODE_FLIP`.
