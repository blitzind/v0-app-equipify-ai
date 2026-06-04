# Growth Attribution Touch Ledger (Phase 6.32B-1)

Foundational normalized touches + first/last paths for revenue attribution.

QA marker: `growth-attribution-touch-ledger-v1`

## Tables

- `growth.attribution_touches` — one row per funnel touch
- `growth.attribution_paths` — rebuilt lead/opportunity paths (first_touch_id, last_touch_id, touch_ids)

## API

- `recordAttributionTouch` — insert touch + rebuild paths
- `recordAttributionTouchFromRevenueEvent` — mirror `revenue_attribution_events`
- `recordSendAttributionTouchForDeliveryAttempt` — email/SMS on `delivery_attempts.status = sent`

## Wired hooks

- Opportunity create/won (`mutate-opportunity.ts`)
- Legacy revenue events (`revenue-attribution.ts`)
- Lead import commit (`import/pipeline.ts`)
- Research completed (`timeline-emitter.ts`)
- Personalization approved (`personalization/dashboard.ts`)
- Call disposition (`call-events-repository.ts`)
- Delivery sent (`transport-repository.ts` — status hook only)

## Tests

`pnpm test:growth-attribution-touch-ledger`
