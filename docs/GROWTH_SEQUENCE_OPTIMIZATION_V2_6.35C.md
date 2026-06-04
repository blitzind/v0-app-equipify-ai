# Growth Sequence Optimization V2 (Phase 6.35C)

QA marker: `growth-sequence-optimization-v2-v1`

## Scope

Approval-only sequence optimization recommendations. Operators review, copy, mark reviewed, or dismiss — **no** automatic sequence edits, sends, or changes to transport, inbox, warmup, health, routing, attribution, memory, NBA, or coaching.

## Recommendation types

| Type | Typical signal |
|------|----------------|
| `improve_subject` | Low reply rate by subject category (outreach performance) |
| `improve_opener` | Generic opener underperformance or high objection rate (reply learning) |
| `improve_cta` | CTA category with sends but no positive outcomes |
| `adjust_timing` | Long step delays with weak outcomes; low 30d reply % in snapshots |
| `add_step` | Replies without meeting funnel progression |
| `remove_step` | High-touch step with zero wins |
| `change_channel` | Channel effectiveness gap vs step channel |
| `pause_underperforming_step` | High-touch step with zero wins (stronger advisory) |
| `double_down_on_winning_angle` | Wins on sequence/step; pain themes on closed-won paths |

## Data sources

- `attribution_touches` / `attribution_paths` (via revenue attribution dashboard aggregates)
- `sequence_performance_snapshots` (30d hints)
- `sequence_pattern_steps` (delay, channel metadata)
- `outreach_performance_attributions` (subject, opener, CTA)
- `personalization_evidence` (pain points on won paths)
- `campaign_reply_learning_snapshots` (objection / quality by pattern)
- `channel_effectiveness` analytics

## API

`GET /api/platform/growth/sequences/optimization/recommendations`

Query: `date_from`, `date_to`, `channel`, `rep_user_id`, `sequence_id`, `attribution_model`

## UI

- `/admin/growth/sequences` — full optimization section
- `/admin/growth/sequences/enrollments/[enrollmentId]` — filtered by enrollment pattern id

Lifecycle: `localStorage` key `growth-sequence-optimization-rec-lifecycle-v1`

## Tests

```bash
pnpm test:growth-sequence-optimization-recommendations
```
