# Growth Engine — Outbound Operational Readiness

QA marker: `growth-operational-send-plane-v1`

This milestone operationalizes the existing Growth outbound stack without introducing parallel send systems.

## Current live infrastructure

| Surface | Status | Notes |
| --- | --- | --- |
| Transport orchestrator (`executeTransportSend`) | **LIVE** when `GROWTH_TRANSPORT_SIMULATE` is unset | Human approval required; unified pre-send suppression; Gmail / Microsoft primary |
| Google mailbox OAuth + Gmail send | **LIVE** when Google OAuth env + encrypted credentials configured | Primary production send path |
| Microsoft 365 mailbox OAuth + Graph send | **LIVE** when Microsoft OAuth env configured | Production send + inbox sync when connected |
| Sequence scheduler + safe execute crons | **LIVE** | Standalone mode: `sequence_execution_jobs`; human approval at Sequence Execution |
| Inbox sync worker | **LIVE** when `GROWTH_INBOX_SYNC_SIMULATE` is unset | Polls connected mailboxes |
| Lemlist adapter (`outreach_queue`) | **ROLLBACK-ONLY** | Requires `GROWTH_OUTBOUND_MODE=adapter` + `GROWTH_ALLOW_ADAPTER_OUTBOUND=true`; see Phase 6.35D |
| Outreach queue execution cron | **RETIRED from Vercel schedule** | Route retained; returns 410 unless rollback env |
| Webhook ingestion | **LIVE** | Native transport + Lemlist historical webhooks when configured |
| Compliance suppression (`delivery_suppressions`, `unsubscribe_registry`, bounces/complaints) | **LIVE** | Hashed identity layer |
| Outbound suppression (`suppression_entries`) | **LIVE** | Plaintext operator suppressions — unified via `assertPreSendAllowed()` |

## Simulated infrastructure

| Flag / surface | Status |
| --- | --- |
| `GROWTH_TRANSPORT_SIMULATE=true` | **SIMULATED** — provider adapters return fake message IDs |
| `GROWTH_INBOX_SYNC_SIMULATE=true` | **SIMULATED** — no live mailbox polling |

Simulation flags are **blocked in production** by runtime guards and the production build verifier.

## Preview / stub / disabled infrastructure

| Surface | Status |
| --- | --- |
| DNS validation probes | **STUB** unless `GROWTH_LIVE_DNS_VERIFICATION=true` |
| Mailbox warmup execution | **LIVE** when transport simulate is off — ramp caps and pre-send guards (6.35B) |
| Smartlead / Instantly / EmailBison outbound | **STUB** — fixture adapters |
| SMTP / custom mailbox paths | **INTERNAL / STUB** — operator testing only |

## Production requirements

Required env vars for production outbound:

- `CRON_SECRET` — secures all Growth cron routes (`Authorization: Bearer` or `x-cron-secret`)
- `GROWTH_PROVIDER_CREDENTIALS_PEPPER` — **must not** use dev fallback pepper
- Google OAuth (live mailbox path): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `INTEGRATION_OAUTH_STATE_SECRET`

Must **not** be set in production:

- `GROWTH_TRANSPORT_SIMULATE=true`
- `GROWTH_INBOX_SYNC_SIMULATE=true`

## Cron deployment (`vercel.json`)

All Growth crons are registered in `vercel.json` and wrapped with `runGrowthCronJob()` for auth, telemetry, and outbound production guards.

| Route | Schedule | Category |
| --- | --- | --- |
| `/api/cron/growth-outreach-execute` | `*/5 * * * *` | outbound |
| `/api/cron/growth-sequence-scheduler` | `*/10 * * * *` | outbound |
| `/api/cron/growth-sequence-safe-execute` | `*/5 * * * *` | outbound |
| `/api/cron/growth-inbox-sync` | `*/15 * * * *` | inbox |
| `/api/cron/growth-signal-ingest` | `0 * * * *` | intelligence |
| `/api/cron/growth-discovery-worker` | `0 3 * * *` | discovery |
| `/api/cron/growth-company-signal-refresh` | `0 4 * * *` | intelligence |
| `/api/cron/growth-contact-refresh` | `30 4 * * *` | intelligence |
| `/api/cron/growth-territory-refresh` | `0 2 * * *` | intelligence |
| `/api/cron/growth-market-health-refresh` | `0 1 * * *` | intelligence |

Telemetry persists to `growth.cron_execution_runs` (migration `20270527123000_growth_engine_cron_execution_telemetry.sql`).

## Operational visibility

Platform admins: `/admin/growth/operations/outbound`

API: `GET /api/platform/growth/operations/outbound`

Includes cron health, queue counts, transport failures, webhook ingestion, suppression hits, provider setup status, and infrastructure readiness catalog.

## Unified pre-send suppression

Canonical entry point: `assertPreSendAllowed()` in `lib/growth/compliance/pre-send-assertion.ts`

Evaluation order:

1. Compliance layer (`unsubscribe_registry`, `delivery_suppressions`, complaints, hard bounces)
2. Outbound layer (`suppression_entries`)

Legacy write paths remain unchanged — this milestone adds a unified read/evaluation layer only.

## Operational risks

- Dev fallback credential pepper silently works locally but **blocks production deploy**
- Transport simulation is easy to enable locally — must never reach production
- Two suppression tables still exist; operators should treat `assertPreSendAllowed()` as authoritative for sends
- Microsoft mailbox path is visible in UI but not production-ready
- Warmup UI can be mistaken for live execution — labeled **DISABLED**

## Tests

```bash
pnpm test:growth-operational-send-plane
```

Production build guard:

```bash
tsx scripts/verify-growth-production-runtime.ts
```

## Internal Outbound Operations (Phase 1)

QA marker: `growth-internal-outbound-ops-v1`

**Primary ops center:** `/admin/growth/infrastructure/outbound-operations`

Consolidates mailboxes, domains (manual DNS verification), sender pools, queue/cron health, deliverability metrics, Google provider status, and operational audit events.

**Migration:** `20270528120000_growth_engine_internal_outbound_ops.sql` — `internal_outbound_audit_events`, sender pool operational pause columns.

**Extended pre-send gate:** `assertPreSendAllowed()` now evaluates compliance → outbound suppression → infrastructure guards (sender health, mailbox, domain protection, pool pause).

**Sender operational pause:** Critical fatigue auto-pauses pool members with audit trail — no automatic re-enable.

**DNS:** MANUAL VERIFICATION REQUIRED — stub flags only; readiness states include `error` and `degraded`.
