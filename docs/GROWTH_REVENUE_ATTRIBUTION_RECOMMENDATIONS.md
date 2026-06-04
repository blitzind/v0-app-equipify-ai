# Growth Revenue Attribution Recommendations (Phase 6.32B-3)

Read-only closed-loop recommendations from the 6.32B-1 touch ledger and 6.32B-2 dashboard aggregations.

QA marker: `growth-revenue-attribution-recommendations-v1`

## UI

Section on `/admin/growth/revenue-attribution` — no destructive actions. Lifecycle (reviewed/dismiss) stored in browser `localStorage` only.

## API

`GET /api/platform/growth/revenue-attribution/recommendations`

Same query params as the dashboard API.

## Rollups

`GrowthAttributionClosedLoopRollups` — personalization, sequence, channel, sender, industry feeds for future systems. Not wired to automation.

## Tests

`pnpm test:growth-revenue-attribution-recommendations`
