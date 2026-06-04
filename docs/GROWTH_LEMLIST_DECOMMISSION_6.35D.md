# Growth Engine — Lemlist Adapter Decommission Cleanup (Phase 6.35D)

QA marker: `growth-lemlist-decommission-v1` · Native cutover: `growth-native-outbound-cutover-v1`

Production send plane is **native Gmail / Microsoft 365** via Sequence Execution. Lemlist and `growth.outreach_queue` remain for **rollback** and **read-only history** — adapter code and tables are not removed in this phase.

## Operator surfaces

| Surface | Default (standalone) | Rollback (`adapter` + `GROWTH_ALLOW_ADAPTER_OUTBOUND=true`) |
| --- | --- | --- |
| Sequence Execution | **Primary approvals** — `/admin/growth/sequences/execution` | Same |
| Legacy outreach approval URL | `/admin/growth/outreach/approval` → **redirects** to Sequence Execution | Redirect still applies; use Sequence Execution for net-new work |
| Legacy queue archive | `/admin/growth/outreach/legacy-queue` — read-only `outreach_queue` dashboard | Writable approve/execute when rollback env active |
| Providers → Lemlist settings | Read-only campaign/webhook visibility | Editable when rollback active |
| Command palette “Sequence Approvals” | `/admin/growth/sequences/execution` | Unchanged |
| Infrastructure readiness | Lemlist labeled **disabled / rollback-only** | **Live** when rollback env set |

## APIs

- `GET /api/platform/growth/outbound/cutover-status` — client cutover + archive hrefs
- `GET /api/platform/growth/outreach/approval-dashboard` — includes `decommission` metadata; queue data unchanged

## Rollback procedure

1. Set `GROWTH_OUTBOUND_MODE=adapter`
2. Set `GROWTH_ALLOW_ADAPTER_OUTBOUND=true`
3. Re-enable Lemlist webhooks in provider console if needed
4. Use legacy queue archive or historical APIs for `outreach_queue` mutations
5. Revert UI surfaces automatically (Lemlist settings editable; sidebar counts legacy + sequence pending)

## What was intentionally not removed

- `lib/growth/outbound/providers/lemlist/*` adapter implementation
- `growth.outreach_queue` and related historical tables
- Cron route files under `app/api/cron/growth-outreach-execute` (410 when cutover active)
- Lemlist webhook route `POST /api/growth/webhooks/outbound/lemlist/[connectionId]`

## Dogfood / validation

Outbound subsystem checklist item is **Native Gmail / Microsoft delivery** (not Lemlist). Dogfood runs must not use adapter plane — see `docs/GROWTH_NATIVE_DOGFOOD_VALIDATION_6.34B.md`.

## Tests

```bash
pnpm test:growth-lemlist-decommission
pnpm test:growth-outbound-cutover
pnpm test:growth-dogfood-validation
```
