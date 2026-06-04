# Growth Revenue Attribution Dashboard (Phase 6.32B-2)

First unified reporting UI over the 6.32B-1 touch ledger.

QA marker: `growth-revenue-attribution-dashboard-v2` (multi-touch: linear, time_decay)

## Route

`/admin/growth/revenue-attribution`

## API

`GET /api/platform/growth/revenue-attribution/dashboard`

Query: `attribution_model` (`first_touch` | `last_touch` | `linear` | `time_decay`), `channel`, `rep_user_id`, `sequence_id`, optional `date_from` / `date_to`.

See also `docs/GROWTH_MULTI_TOUCH_ATTRIBUTION.md`.

## Data sources

- `growth.attribution_touches` (primary)
- `growth.attribution_paths` (first/last credit)
- `growth.opportunities` (amounts, pipeline)
- `growth.leads` (industry, source)

## Tests

`pnpm test:growth-revenue-attribution-dashboard`
