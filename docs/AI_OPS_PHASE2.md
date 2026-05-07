# AI Operational Assistant — Phase 2

Phase 2 layers practical AI-assisted *actions* on top of the deterministic
recommendation engine shipped in Phase 1. **No AI mutates records or sends
messages automatically.** Everything is review-only. The deterministic
engine remains the source of truth.

## What shipped

| Capability | Source |
| --- | --- |
| AI explanation/narration per recommendation card | `components/ai-ops/ai-explain-panel.tsx` + `app/api/.../ai-ops/recommendations/[key]/narrate` |
| AI-drafted prospect follow-up | `components/ai-ops/draft-followup-dialog.tsx` (reuses existing `prospects/[id]/draft-followup`) |
| "Suggest automation" deep-link to the workflow builder | `components/ai-ops/automation-suggestion.ts` + `WorkflowAutomationsSection` URL prefill |
| Outcome telemetry (acted/dismissed/snoozed/opened/drafted/narrated) | `components/ai-ops/log-outcome.ts` + `app/api/.../ai-ops/outcomes` |
| Dashboard "Today's focus" digest (top 3 urgent) | `components/ai-ops/digest-card.tsx` |
| Cached AI narrations | `ai_ops_narrations` table |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Phase 1 (unchanged)                                                │
│ rules.ts ─► engine.ts ─► /ai-ops/recommendations ─► RecommendationCard │
└────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼─────────────────────────────┐
        ▼                       ▼                             ▼
  /ai-ops/.../narrate     /ai-ops/outcomes        /settings/automations?aiops=1
   (LLM, plan-gated,        (POST log,             (deep-link prefills name +
    cached 24h in            GET 30-day stats)      description + trigger)
    ai_ops_narrations)
```

### Why we re-derive the recommendation server-side for narration

The narrate endpoint refuses to accept a free-form recommendation payload
from the client; it re-runs `generateRecommendations` and looks the request
up by `key`. This means a client cannot:
- Spoof an entity label/metric to leak information into the LLM prompt.
- Force a narration of a recommendation the engine no longer surfaces (e.g.
  the underlying invoice was paid in the meantime).

Cost: one extra rule-set evaluation per narration request, on a system
that already runs cheaply (each rule is a small Supabase query).

### Why we cache narrations

LLM calls are not free. The dashboard digest card fires on every visit, and
managers will routinely click "Explain with AI" multiple times across a
day. A 24-hour cache keyed by `(organization_id, recommendation_key,
schema_version)` covers the realistic re-read pattern without leaking stale
information. The schema_version (`ai_ops_narration_v1`) is the kill-switch
for prompt changes — bump it in `lib/ai-ops/narrate-prompt.ts` and every
cached narration is invalidated automatically.

### Plan/budget gating

Narration uses the `insights_generation` AI task, which already has:
- `requiredPlan: "core"` enforcement via `evaluateAiPlanGate`
- Per-org monthly budget cap via `precheckOrganizationAiBudget`
- Provider fallback chain (OpenAI → Anthropic → escalation)

When the gate denies the call, the API returns the deterministic Phase 1
explanation as a `fallback`, and the panel labels it appropriately. **The
deterministic recommendation is always shown first** — the LLM only
rewrites it.

### Outcome telemetry — what we track and what we don't

The `ai_ops_outcomes` table records seven event types:

| Outcome | Trigger |
| --- | --- |
| `opened_entity` | Manager clicked the primary entity link or "Open record" |
| `drafted_followup` | "Draft AI follow-up" dialog produced text |
| `created_automation_suggestion` | Manager clicked through to the workflow builder via the AI Ops deep-link |
| `narrated` | "Explain with AI" returned a narration (cached or fresh) |
| `dismissed` | Manager dismissed (no snooze) |
| `snoozed` | Manager snoozed for N hours |
| `acted_on` | Reserved for future "I did this" affirmation |

**No PII is logged.** The `context` jsonb is intentionally narrow:
`entityId` (already org-scoped via RLS), `entityType`, `snoozeHours`,
`source`. We never write customer names, contact info, draft contents, or
provider response IDs.

### Workflow builder deep-link — why URL params, not session

Passing the suggestion via URL keeps the flow stateless. Managers can:
- Bookmark a suggestion link.
- Copy it to a colleague.
- Refresh without losing the suggestion (the section pops the dialog on
  mount, then strips the params via `router.replace` so a subsequent
  refresh starts fresh).

The dialog ignores `initialSuggestion` whenever an existing automation is
being edited, so suggestions can never overwrite saved configurations.

## Migrations

`supabase/migrations/20260808100000_ai_ops_phase2.sql` adds:

- `ai_ops_outcomes` (insert-only; org-member RLS read+insert)
- `ai_ops_narrations` (cache; org-member read, owner/admin/manager
  write; unique key on `(organization_id, recommendation_key,
  schema_version)`)

Both tables are additive, nullable-friendly, and idempotent. No existing
table is modified.

## TODO / future phases

- **Phase 3 — Daily digest delivery.** A cron worker that calls
  `GET /ai-ops/recommendations?priority=high,medium&limit=5` per
  organization, formats the result with the same prompt as the inline
  panel, and emails it via the existing Resend pipeline. The schema
  is already in place — only the cron + email template are needed.
- **Phase 3 — Slack/Teams hooks.** Same digest payload, posted to a
  workspace-configured webhook. Wiring lives in the future
  `lib/ai-ops/digest.ts` helper; today the dashboard `AiOpsDigestCard`
  is the manual surface.
- **Phase 3 — `acted_on` affirmation.** A "Mark as handled" CTA on
  recommendation cards that asks the user to confirm what they did
  (e.g. "called customer", "rescheduled work order"). We already
  reserve the outcome enum value.
- **Phase 4 — AI-generated automation drafts.** Today the workflow
  builder receives a *suggestion* (name + description + trigger).
  Phase 4 should extend the deep-link with prefilled actions JSON
  (e.g. "draft email + create_task") so the manager can review and
  enable in one click.
- **Phase 4 — Predictive maintenance signal.** The deterministic
  rules already surface repeat-repair risk; an LLM-assisted ranker
  could suggest equipment retirement vs. continued repair using the
  full work-order history. Plan/budget gated.
- **Phase 4 — Outcome-aware ranking.** Once
  `ai_ops_outcomes.byOutcome` has 30 days of data, the engine can
  promote categories with high `acted_on` rates and demote categories
  consistently `dismissed`.

## Safety guarantees

- No auto-send of customer-facing messages.
- No auto-update of records.
- No auto-creation of automations or work orders.
- LLM prompt never contains raw UUIDs.
- LLM prompt never contains customer email/phone/address.
- Plan/budget gate enforced via the central `runAiTask` router.
- All endpoints require authenticated org-member context.
