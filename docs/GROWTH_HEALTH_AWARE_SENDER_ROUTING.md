# Growth Health-Aware Sender Routing (Phase 6.31C)

Upgrades sender pool rotation from warmup-aware scoring to **health-aware routing** using Phase 6.31B mailbox health intelligence.

QA marker: `growth-health-aware-routing-v1`

## Selection factors

Mailbox health score/state, reputation trend, warmup status, remaining daily capacity, bounce/complaint rates, delivery success rate, throttle status, route health weights.

## Routing rules

- Prefer highest `routing_score` (strategy `weighted_health` / `warmup_safe`)
- Exclude `critical`, `disabled`, `paused`, and `throttled` mailboxes from pool eligibility
- Best delivery route per sender via `pickBestRouteForSender` (aligned with transport route scoring)
- Warmup and pre-send guards unchanged (enforced at send time)

## Dashboard

`/admin/growth/providers/sender-pools` — Health-aware routing table + route balancing recommendation.

## Tests

`pnpm test:growth-health-aware-routing`
`pnpm test:growth-sender-pools`
