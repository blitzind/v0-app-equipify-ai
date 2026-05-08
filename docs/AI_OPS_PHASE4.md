# AI Operational Assistant — Phase 4

Phase 4 turns the daily digest into a multi-channel internal alerting
loop and adds outcome-aware ranking on top of the deterministic
recommendation engine. Both surfaces are strictly additive: the
deterministic engine remains the source of truth, no recommendation
is ever hidden, and no source record is mutated.

> Earlier phases:
> - Phase 1 ([docs/AI_OPS_PHASE1.md](./AI_OPS_PHASE1.md)) — deterministic engine.
> - Phase 2 ([docs/AI_OPS_PHASE2.md](./AI_OPS_PHASE2.md)) — AI explain, draft follow-ups, automation suggestions.
> - Phase 3 ([docs/AI_OPS_PHASE3.md](./AI_OPS_PHASE3.md)) — daily digest + mark-as-handled.

---

## What's new

### 1. Slack delivery adapter — `lib/ai-ops/slack-adapter.ts`

- POSTs a Block Kit message to a configured Slack Incoming Webhook.
- Validates the URL against the `https://hooks.slack.com/services/.../.../...` shape before any network call.
- Renders a compact summary: header, totals, top focus items (max 5), 7-day activity strip, and a deep-link to `/ai-ops`.
- 8s timeout, AbortController-bound, structured failure result with `errorCode` + `errorMessage`.
- `asTest: true` swaps the body for a one-line "your webhook is wired correctly" message.
- Internal-only — no customer-facing data, no signed URLs, no AI-generated drafts.

### 2. Teams delivery adapter — `lib/ai-ops/teams-adapter.ts`

- POSTs a `MessageCard` (Office 365 connector format Teams Incoming Webhooks accept) to the configured Teams URL.
- Validates against `outlook.office.com`, `outlook.office365.com`, and `*.webhook.office.com` hosts.
- Same compact summary shape as Slack with "Open in Equipify" / "Manage digest settings" actions.
- Same timeout + structured error contract.

### 3. Outcome-aware ranking — `lib/ai-ops/ranking.ts`

- Reads the last **30 days** of `ai_ops_outcomes` (already populated by Phases 2 and 3).
- Computes a per-category score:
  ```
  actedRatio    = actedOn / (actedOn + dismissed + snoozed)
  dismissRatio  = (dismissed + snoozed*0.5) / (actedOn + dismissed + snoozed)
  adjustment    = clamp(actedRatio - dismissRatio, -0.4, +0.4)
  ```
- Hard guarantees:
  1. **Priority is sacred.** Items are sorted by priority first; ranking only nudges within a priority bucket. No "high" item is ever pushed below a "medium" item, regardless of past dismissals.
  2. **Bounded.** Adjustments are clamped to ±0.4 so a single streak can't override priority.
  3. **Sparse-data no-op.** Below 10 outcome rows in the lookback window the helper returns no adjustments — premature ranking on noise is worse than no ranking.
  4. **Never hides items.** This module only reorders.
- Wired into `engine.ts` via the new `outcomeAwareRanking` arg (defaults to `true`). Failures fall through to the deterministic baseline and log a warning.
- `categoryAdjustments` is exposed on the engine's response for transparency in admin tooling. UI consumes only the rank order.

### 4. Multi-destination digest runner — `lib/ai-ops/digest-runner.ts`

- Dispatches **email**, **Slack**, and **Teams** in parallel (`Promise.all`); a failure in one path never blocks the others.
- Records a per-destination result on the run row:
  ```jsonc
  {
    "email":  { "status": "sent",     "messageId": "...", "recipientCount": 4 },
    "slack":  { "status": "failed",   "errorCode": "non_2xx",   "errorMessage": "..." },
    "teams":  { "status": "disabled", "errorCode": null }
  }
  ```
- Aggregates the row's top-level `status` to one of: `sent`, `partial` (some destinations succeeded, some failed), `failed`, `no_items`, `no_recipients`, `skipped`.
- Email branch keeps the existing `communication_events` audit (`channel: "system"`); Slack/Teams branches are captured in `destinations_result` only — no duplicate audit row.

### 5. Settings UI — `components/ai-ops/digest-settings-card.tsx`

- New "Slack & Teams delivery" disclosure (separate from the email recipient block).
- Per-destination row with:
  - **Add / Replace webhook** button (the URL is write-only — once saved, the UI only shows host + last 4 chars, e.g. `hooks.slack.com/…/****abcd`).
  - **Send test** button (manager+) which calls `/digest/test-destination` and posts a one-line acknowledgement card. Works both before saving (with a draft URL) and after saving (using the persisted URL).
  - **Toggle** that controls `slack_enabled` / `teams_enabled` (only enabled when a webhook is saved).
  - **Remove** which clears both the URL and the enabled flag in one PATCH.
- Run history surface gained per-destination chips so an operator can spot "email sent, Slack failed".
- Strong inline copy: "Internal channels only. AI Ops will never post customer-facing messages to Slack or Teams."

### 6. Test endpoint — `POST /api/organizations/{orgId}/ai-ops/digest/test-destination`

- Manager / admin / owner only; platform-admin override honoured.
- Body: `{ destination: "slack" | "teams", overrideWebhookUrl?: string }`.
- Validates the webhook URL, builds a real `DigestPayload` via the existing pure builder, and sends an `asTest: true` message via the corresponding adapter.
- Never modifies digest settings, never logs the webhook URL, never writes to `ai_ops_digest_runs`.

---

## Database changes

### `supabase/migrations/20260810100000_ai_ops_digest_phase4.sql`

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `ai_ops_digest_settings` | `slack_enabled` | `boolean` | `false` | New explicit toggle. |
| `ai_ops_digest_settings` | `teams_enabled` | `boolean` | `false` | New explicit toggle. |
| `ai_ops_digest_runs` | `destinations_result` | `jsonb` | `'{}'::jsonb` | Per-destination outcome. Never contains webhook URLs or provider secrets. |

All additive + idempotent (`add column if not exists`). Existing rows default to disabled — a manager has to explicitly opt in to Slack / Teams delivery.

---

## Architectural decisions

### Webhook URLs are write-only in the API surface

Once saved, the GET response only echoes:

```json
{
  "slackWebhookConfigured": true,
  "slackWebhookHint": "hooks.slack.com/…/****abcd",
  "slackEnabled": true
}
```

The full URL is never returned to the client. To rotate the URL the
admin uses **Replace webhook** which sends a new value through PATCH
and triggers a fresh save.

This rules out an entire class of footguns: a server-rendered HTML
page accidentally leaking the URL, the URL ending up in a screenshot
of devtools, etc.

### Slack/Teams audit lives in `destinations_result`, not `communication_events`

`communication_events` is the customer timeline. AI Ops digests are
internal-only — Slack/Teams dispatches in particular have no
customer recipient. Storing per-destination status on the run row
keeps the customer timeline focused on customer-facing comms while
the digest history surface in `/settings/notifications` shows every
destination at a glance.

### Outcome-aware ranking is a tie-breaker, not a filter

The Phase 1 engine is deterministic and complete. Outcome telemetry
should make obvious patterns ("we always act on overdue invoices,
we always dismiss inventory low-stock") slightly nudge the rank,
not change which items appear. We considered a more aggressive
"hide repeatedly dismissed items" heuristic and rejected it: a stale
prospect that's been dismissed three weeks running is still a stale
prospect, and the operator should be able to see it.

### One adapter per channel, no abstraction

Slack and Teams have meaningfully different payload formats (Block
Kit vs. MessageCard) and different validation surfaces. A shared
"WebhookAdapter" interface would either leak the union of both or
force a lossy translation. Two siblings under `lib/ai-ops/` is
clearer.

---

## Safety

- **No customer-facing messages.** Both adapters are internal-only by
  contract; the runner never hands Slack/Teams a customer email
  address or a signed portal URL.
- **No webhook URLs in logs.** The settings serializer masks them,
  the test endpoint refuses to echo them, the run row stores only
  `status` / `errorCode` / `errorMessage`.
- **No provider secrets.** The runner never serialises the raw
  Resend/Slack/Teams response into `destinations_result`.
- **Plan/budget gates preserved.** Phase 4 does not introduce any
  new LLM calls. The optional AI intro hook is intentionally not
  shipped in this phase — any future hook will go through the
  existing `evaluateAiPlanGate` + `precheckOrganizationAiBudget`
  gate before its first token.
- **Deterministic engine preserved.** Outcome-aware ranking failures
  are caught and the engine returns the deterministic baseline.

---

## TODOs (deferred to a future phase)

- Optional AI-narrated digest intro (1–2 sentence hook). Held back
  to keep Phase 4 focused on delivery + ranking. When introduced
  it must respect the existing AI plan/budget gates and degrade to
  the current deterministic header on failure.
- Per-recipient delivery breakdown for the email branch (today we
  only record the recipient count).
- Slack interactive actions (Block Kit "Mark as handled" buttons).
  Deferred — requires the slash-command verifier and shared signing
  secret rotation, both out of scope for an internal alert layer.
- Per-category outcome adjustment surfaced in the admin /ai-ops
  UI so managers can see *why* a particular category bubbled up.

---

## Verification

- `pnpm update:master-context`
- `pnpm build`
- New routes registered:
  - `POST /api/organizations/[organizationId]/ai-ops/digest/test-destination`
- Updated routes:
  - `GET/PATCH /api/organizations/[organizationId]/ai-ops/digest/settings`
  - `GET /api/organizations/[organizationId]/ai-ops/digest/runs`

No regressions in existing AI Ops, Communications, Workflows, Email,
Portal, QuickBooks, Prospects, Invoices, Dispatch, Equipment,
Inventory, or Certificates surfaces.
