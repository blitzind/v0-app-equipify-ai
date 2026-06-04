# Growth Mailbox Health Intelligence (Phase 6.31B)

Operational deliverability intelligence on top of reputation protection (6.30) and native warmup execution (6.31A).

QA marker: `growth-mailbox-health-intelligence-v1`

## Health model

| Field | Description |
|-------|-------------|
| `health_score` | 0–100 (higher is healthier; aligns with reputation `risk_score`) |
| `health_state` | `healthy` · `warning` · `at_risk` · `critical` · `disabled` |

### Inputs

Bounce/complaint/unsubscribe/reply rates, 7d send volume, delivery success rate (`delivery_attempts`), warmup status/progress, throttle events (`warmup_events`), send throttle engine, deliverability pause state.

## Storage

- `mailbox_reputation_snapshots` — extended with `health_score`, `health_state`, `delivery_success_rate`, `throttle_status`
- `sender_reputation_snapshots` — daily writer from health rollup (legacy table, now populated)
- `sender_accounts.health_status` — synced from health state on daily cron

## Cron

`growth-reputation-snapshot` (`30 5 * * *`) runs reputation assessment, pause/recovery, then `runMailboxHealthIntelligenceRollup`.

## APIs

- `GET /api/platform/growth/deliverability/mailbox-health/dashboard` — full mailbox table
- Deliverability Protection console — Sender health module includes mailbox intelligence table

## Migration

`supabase/migrations/20270705120000_growth_mailbox_health_intelligence.sql`
