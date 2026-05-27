# Growth Engine — Outbound Operational Readiness

QA marker: `growth-operational-send-plane-v1`

This milestone operationalizes the existing Growth outbound stack without introducing parallel send systems.

## Current live infrastructure

| Surface | Status | Notes |
| --- | --- | --- |
| Transport orchestrator (`executeTransportSend`) | **LIVE** when `GROWTH_TRANSPORT_SIMULATE` is unset | Human approval required; unified pre-send suppression |
| Google mailbox OAuth + Gmail send | **LIVE** when Google OAuth env + encrypted credentials configured | Primary mailbox path for this milestone |
| Outreach queue execution cron | **LIVE** | `POST /api/cron/growth-outreach-execute` |
| Sequence scheduler + safe execute crons | **LIVE** | Creates `pending_approval` only; safe execute sends approved jobs |
| Inbox sync worker | **LIVE** when `GROWTH_INBOX_SYNC_SIMULATE` is unset | Polls connected mailboxes |
| Lemlist cold outbound | **LIVE** | Only non-fixture outbound provider adapter |
| Webhook ingestion | **LIVE** | Normalized provider delivery events |
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
| Microsoft 365 mailbox OAuth | **PREVIEW ONLY** — not operationalized in v1 |
| DNS validation probes | **STUB** — advisory records only |
| Mailbox warmup execution | **DISABLED** — planning/registry UI only |
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

Telemetry persists to `growth.cron_execution_runs` (migration `20270527120000_growth_engine_cron_execution_telemetry.sql`).

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

(runs automatically before `pnpm build`)
