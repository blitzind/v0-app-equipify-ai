# Multi-Touch Attribution (Phase 6.33A)

Extends 6.32B reporting with **linear** and **time-decay** models alongside first/last touch.

## Models

| Model | Credit rule |
|-------|-------------|
| `first_touch` | 100% to first touch in path |
| `last_touch` | 100% to last touch in path |
| `linear` | Equal split across all path touches |
| `time_decay` | Half-life 14 days from closed-won anchor; recent touches weighted higher |

Weights are normalized to sum to 1. Per-touch `attribution_confidence` combines touch confidence with path depth factor.

## Storage

Credits are stored in `attribution_paths.path_summary.touch_credits_by_model` on path rebuild (no new tables).

Ledger fields reused: `attribution_touches.attribution_confidence`.

## API

`?attribution_model=first_touch|last_touch|linear|time_decay` on dashboard and recommendations endpoints.

## Tests

`pnpm test:growth-attribution-credit-model`
