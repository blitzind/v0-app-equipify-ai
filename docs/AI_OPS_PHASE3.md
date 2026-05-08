# AI Operational Assistant — Phase 3

> **Phase 4 follow-up:** Slack/Teams delivery and outcome-aware ranking
> are documented in [`AI_OPS_PHASE4.md`](./AI_OPS_PHASE4.md).

Phase 3 turns AI Ops into a recurring operational command layer. A
daily internal email digest summarises the highest-priority
recommendations from the deterministic engine, and a "Mark as
handled" outcome lets managers close the loop on items they've worked.
**No automation in Phase 3 mutates records or sends customer-facing
messages.**

## What shipped

| Capability | Source |
| --- | --- |
| Daily digest payload builder | `lib/ai-ops/digest.ts` |
| Digest runner (email send + run history row) | `lib/ai-ops/digest-runner.ts` |
| Internal HTML email template | `lib/email/ai-ops-digest-template.ts` |
| Per-org digest schedule + recipients API | `app/api/.../ai-ops/digest/settings` |
| Read-only digest preview API | `app/api/.../ai-ops/digest/preview` |
| Manual "Send digest now" API | `app/api/.../ai-ops/digest/send` |
| Recent digest history API | `app/api/.../ai-ops/digest/runs` |
| Hourly cron worker | `app/api/cron/ai-ops-digest/route.ts` |
| Vercel cron registration | `vercel.json` |
| Settings UI card (recipients, time, threshold, categories, preview, history, send-now) | `components/ai-ops/digest-settings-card.tsx` (anchor `#ai-ops-digest` on `/settings/notifications`) |
| "Mark as handled" outcome with optional note | `components/ai-ops/mark-handled-button.tsx` |
| Activity recap inside the email | `lib/ai-ops/digest.ts → recentActivity` |

## Architecture

```
                       ┌──────────────────────────┐
                       │ ai_ops_digest_settings    │  per-org schedule
                       │  enabled, recipients[],  │  RLS: select=member,
                       │  send_hour, threshold,   │       write=owner/admin/manager
                       │  categories[],           │
                       │  slack/teams webhook[*]  │  reserved for Phase 4
                       └────────────┬─────────────┘
                                    │
   ┌────────────────────┐    runDigestForOrganization()    ┌──────────────────────┐
   │ /api/cron/ai-ops-  │──┐                              ┌─│ /api/.../digest/send │
   │ digest (hourly)    │  │                              │ │ (manual, manager+)   │
   └────────────────────┘  │                              │ └──────────────────────┘
                           ▼                              ▼
                ┌──────────────────────────────────────────┐
                │  buildDigestPayload                      │
                │   ├─ generateRecommendations             │
                │   ├─ filter (priority + categories)      │
                │   ├─ groupByCategory                     │
                │   └─ recentActivity (7d outcomes)        │
                └────────────┬─────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │ renderAiOpsDigestEmail │   internal HTML + plaintext
                └────────────┬───────────┘
                             ▼
                ┌────────────────────┐         ┌─────────────────────┐
                │  sendEmail (Resend) │ ─────► │ ai_ops_digest_runs  │  audit row
                └────────────────────┘         └─────────────────────┘
                             │
                             ▼
                ┌─────────────────────────────────┐
                │ communication_events            │  audit-only,
                │   event_type=ai_ops_digest_sent │  channel=system
                └─────────────────────────────────┘
```

[*] Slack/Teams webhook fields are stored but not yet dispatched. See
"Future phases" below.

### Why an hourly cron, not daily

Each org configures `send_hour` in **its own timezone**. The cron
runs hourly at `:00`, then for every enabled org compares the org's
local hour to `send_hour`. This avoids:

- A daily cron that fires at fixed UTC and forces a single global
  send time.
- A per-org scheduler service.
- Re-saving digest settings whenever the org timezone changes
  (`organizations.timezone` is re-read live on every cron tick).

A 1-hour cool-down (`last_sent_at` check) prevents accidental
double-sends if a cron tick is retried by the platform.

### Why we keep a separate runs table

`ai_ops_digest_runs` is an append-only audit and operational debug
trail:
- Surfaces "last 5 sends" in the settings UI without scanning
  `communication_events`.
- Captures granular delivery failure reasons (`error_code`,
  `error_message`, `provider_message_id`).
- Future Slack/Teams cool-down logic queries this table to honor
  per-destination rate limits without touching email-only history.

### Why we re-emit `communication_events`

The digest is internal, but managers asked to see audit confirmation
inside the existing communications timeline. We log a single
`ai_ops_digest_sent` row per successful send (`channel=system`,
`recipientKind=none`) which:
- Surfaces in the existing org communications timeline.
- Distinguishes from customer-facing sends via `channel=system`.
- Never includes recipient email addresses or the email body.

### Outcome-aware activity recap

The digest body includes a 7-day "Last 7 days" recap powered by
`ai_ops_outcomes` from Phase 2. As the team builds outcome history,
the recap accurately shows handled/dismissed/snoozed/drafted volume,
which feeds the future outcome-aware ranking work outlined below.

## Migrations

`supabase/migrations/20260809100000_ai_ops_digest_phase3.sql` adds:

- `ai_ops_digest_settings` (one row per org; RLS member-read,
  manager-write).
- `ai_ops_digest_runs` (append-only history; RLS member-read,
  service-role / API-only writes).

Both tables are additive, idempotent, and nullable-friendly. No
existing schema is modified.

## Cron registration

`vercel.json` now contains:

```json
{ "path": "/api/cron/ai-ops-digest", "schedule": "0 * * * *" }
```

The route is protected by `CRON_SECRET` (existing env var, shared
with `process-ai-jobs`, `maintenance-due`, `process-import-runs`).

## Permissions

| Action | Required permission |
| --- | --- |
| View digest settings | org member (RLS) |
| Edit digest settings | `canManageWorkspaceSettings` (owner/admin/manager) |
| Trigger manual send | `canManageWorkspaceSettings` |
| View digest runs | org member (RLS) |
| Mark as handled | org member (writes `ai_ops_outcomes`) |

The cron worker uses `createServiceRoleClient()` with
`CRON_SECRET` authentication; it has no end-user session and
respects the same per-org configuration.

## TODOs / future phases

- **Phase 4 — Slack & Teams delivery.** Webhook URLs are already
  persisted (`slack_webhook_url`, `teams_webhook_url`). The runner
  currently sends only via Resend; add `postSlackBlocks` and
  `postTeamsAdaptiveCard` adapters, gated behind feature flags so
  no real webhooks are pinged on first deploy.
- **Phase 4 — Failure self-healing.** When `ai_ops_digest_runs`
  shows N consecutive failures for an org, downgrade the digest to
  weekly until a manager reviews — prevents alert fatigue if the
  email provider is misconfigured.
- **Phase 4 — Outcome-aware ranking.** With 30 days of
  `ai_ops_outcomes`, weight categories that consistently receive
  `acted_on` higher than ones routinely `dismissed`. Implementation
  lives in `lib/ai-ops/engine.ts` post-sort step; data is already
  collected.
- **Phase 4 — Per-recipient digest preferences.** Today, all
  recipients receive the same digest. Future: a recipient can opt
  in to a weekly recap instead of daily, or scope to specific
  categories (e.g. dispatch-only for the dispatcher).
- **Phase 4 — AI-narrated intro paragraph.** The email template
  already accepts an `aiIntro` argument, but the runner currently
  passes `null` to keep Phase 3 deterministic. Wire `runAiTask` for
  optional plan-gated intro generation, with the same plan/budget
  gating as Phase 2.
- **Phase 4 — In-app digest archive.** Surface the rendered HTML
  inside the AI Ops page so managers can re-read yesterday's digest
  without checking email.

## Safety guarantees

- Internal-only delivery — recipients are staff emails; never
  customer-facing.
- "Mark as handled" records an outcome row only; it does not
  modify the source record.
- LLM is **not used** in the Phase 3 hot path; the optional
  `aiIntro` argument exists for Phase 4 and is currently unused.
- All API routes require an authenticated org-member context.
- Cron route is rejected without `CRON_SECRET`.
- Slack/Teams webhook URLs are stored but never invoked in Phase 3.
- No raw UUIDs in any UI surface (settings card, history rows,
  email body).
- No customer email addresses, draft contents, or provider
  payloads ever appear in `ai_ops_digest_runs.metadata`.
