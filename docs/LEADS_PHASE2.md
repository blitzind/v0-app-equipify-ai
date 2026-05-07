# Leads + Follow-Up — Phase 2

Adds practical follow-up automation foundations and AI-assisted outreach
on top of the lightweight Prospects pipeline shipped in Phase 1. Strictly
additive — no schema migrations, no rewrites of customers, communications,
AI assistants, or workflow automations.

## Goals

1. Sharper follow-up visibility (overdue / today / **this week** / no
   follow-up / upcoming).
2. Surface prospect status changes on the timeline using existing
   `communication_events` plumbing.
3. AI-assisted follow-up email drafts that **never auto-send** — humans
   stay in control.
4. Email draft action with copy + `mailto:` open + "save as note".
5. Status-change automation hook foundation: every status delta now
   emits a workflow trigger so future builder UI rules can plug in
   without further plumbing.
6. Lightweight prospect follow-up widget on the main dashboard for
   managers, hidden for read-only roles to avoid clutter.

## Files added

| Path | Purpose |
|---|---|
| `lib/prospects/status-events.ts` | `recordProspectStatusChange()` — server-side helper that logs a `prospect_status_changed` event and dispatches the new workflow trigger. Wrapped in best-effort try/catch so a logging glitch never rolls back a user mutation. |
| `lib/prospects/ai-followup-prompt.ts` | Prospect-specific system prompt + user-prompt builder for the AI draft. Lives outside the central registry so we can iterate without touching the global prompt catalog. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/draft-followup/route.ts` | `POST` AI follow-up draft. Reuses the `customer_email` AI task (model selection, plan/budget gates, usage logging). Returns `{ subject, body }`. Logs a `prospect_ai_draft_generated` audit row. |
| `components/prospects/ai-draft-followup-dialog.tsx` | UI dialog: generate → review → copy / open in mail / save-as-note. Edits to the body are local; nothing is sent automatically. |
| `components/dashboard/prospect-follow-up-widget.tsx` | Compact dashboard card with overdue / today / this-week / no-follow-up tiles + top-priority list. Rendered only when the active member has `canManageProspects`. |

## Files modified

| Path | Change |
|---|---|
| `lib/prospects/types.ts` | Added `"this_week"` to `FollowUpBucket`. |
| `lib/prospects/format.ts` | `followUpBucketFor` now returns `"this_week"` for tomorrow → end-of-week (browser local timezone); `formatFollowUpBucket("this_week")` → `"This week"`. |
| `lib/workflows/types.ts` | Added `"prospect_status_changed"` to `WorkflowTriggerType` and a `prospect?` slot to `WorkflowEventContext`. Purely additive. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/route.ts` | PATCH handler now snapshots the previous `status` before update and calls `recordProspectStatusChange` on a delta. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/follow-up/route.ts` | When a follow-up advances pipeline status, calls `recordProspectStatusChange` with `reason: "follow_up"` and metadata pointing at the originating communication event. |
| `app/api/organizations/[organizationId]/prospects/[prospectId]/convert/route.ts` | Conversion now emits a status-change event (… → `won`) ahead of the customer-timeline conversion event so the prospect timeline reads correctly. |
| `components/prospects/prospect-drawer.tsx` | New "AI draft" action (only visible when `canViewInsights` + AI plan feature are both true), plus updated Growth roadmap copy. |
| `app/(dashboard)/prospects/page.tsx` | Reads `?followup=` from the URL on first render so dashboard-widget links land pre-filtered, adds the **This week** KPI tile, and includes a `"this_week"` option in the follow-up filter Select. Wraps `useSearchParams` in `<Suspense>` to satisfy static export. |
| `app/(dashboard)/page.tsx` | Mounts `ProspectFollowUpWidget` between the maintenance automation stats and the AI insights widget. |
| `lib/admin/master-context.generated.ts` | Auto-regenerated to include the new `draft-followup` route. |

## Migrations

**None.** Phase 2 is pure code on top of the Phase 1 schema. The
`prospect_status_changed` automation trigger and the new event types
(`prospect_status_changed`, `prospect_ai_draft_generated`) reuse the
existing `communication_events` table widened in Phase 1
(`related_entity_type='prospect'`).

## Architectural decisions

1. **Status changes flow through one helper.**
   `recordProspectStatusChange` is the single funnel — every prospect
   mutation that touches `status` (PATCH, follow-up advance, convert)
   calls it. This avoids duplicate logging and guarantees the workflow
   trigger fires consistently. Errors inside the helper are swallowed
   because the user's mutation has already committed; broken automation
   must never roll back a manager's intentional edit.

2. **Workflow trigger added but no rule UI yet.**
   `prospect_status_changed` slots into `WorkflowTriggerType` and
   `WorkflowEventContext.prospect`, so admins who already have access to
   the workflow builder can wire automations the moment a builder UI
   adds the trigger to its dropdown. We didn't add the dropdown entry in
   this phase to keep the change additive — see TODOs.

3. **Reuse `customer_email` AI task with a tailored prompt.** The
   existing task already has plan gating, monthly budget enforcement,
   usage logging, and provider routing. We provide a prospect-specific
   system + user prompt directly to `runAiTask` (bypassing the prompt
   registry's `getPromptForTask`) so prospect tone can iterate without
   churning the central registry. If/when we want versioned prompt
   history for prospect drafts, we can register a second active prompt
   with its own `promptId` and resolve it by id.

4. **Audit, don't archive, AI drafts.** The draft-followup route logs a
   `prospect_ai_draft_generated` audit row but **does not store the
   subject or body** in `communication_events`. This keeps PII out of
   the org timeline for un-sent drafts while still giving an auditable
   "AI used here" record. If the user explicitly clicks "Save as note",
   the existing `/follow-up` route logs the body as a normal follow-up
   (intentional, user-initiated).

5. **No auto-send.** All Phase 2 surfaces (AI draft dialog, status
   changes) keep the "humans send messages" rule intact. The dialog
   exposes copy + mailto + save-as-note; we never call a mail provider
   on the user's behalf.

6. **Dashboard widget is opt-in by role.**
   `ProspectFollowUpWidget` returns `null` for users without
   `canManageProspects`. Read-only members can already see the pipeline
   at `/prospects`; the dashboard stays focused on field-service ops for
   them.

7. **Follow-up bucket cutoffs are computed in the browser's local
   timezone.** This matches Phase 1 and reflects the user's actual
   working week (the same prospect can be "today" for one user and
   "tomorrow" for another across timezones — that's correct).

## Permission summary

| Role     | View pipeline | Create / edit / log | Status change → log + trigger | AI draft | Dashboard widget |
|----------|---------------|---------------------|-------------------------------|----------|------------------|
| owner    | ✅            | ✅                  | ✅                            | ✅ (plan) | ✅              |
| admin    | ✅            | ✅                  | ✅                            | ✅ (plan) | ✅              |
| manager  | ✅            | ✅                  | ✅                            | ✅ (plan) | ✅              |
| tech     | ✅ (read-only)| ❌                  | n/a                           | ❌        | ❌              |
| viewer   | ✅ (read-only)| ❌                  | n/a                           | ❌        | ❌              |

- AI draft requires `canManageProspects` **and** `canViewInsights` **and**
  a plan that includes the `ai` feature (Growth or Scale, or any active
  trial). Plan denial returns HTTP 402.
- The drawer's "AI draft" button hides itself when the AI plan/feature
  is not granted, so users without access don't see a dead button.

## Verification

- `pnpm build` ✅
- `pnpm update:master-context` ✅ (`140 API routes, 100 migrations`)
- `ReadLints` ✅ on every touched file

Manual smoke (recommended after deploy):

1. Open `/prospects` as an owner — confirm five KPI tiles
   (Overdue / Today / This week / Upcoming / Won).
2. Click the "This week" tile → list filters to the new bucket.
3. Open a prospect → drawer shows "AI draft" button if the org has the
   AI plan / `canViewInsights`.
4. Click "AI draft" → dialog opens, "Generate draft" returns a
   prospect-tailored subject + body; toggle Copy, Open in email, Save as
   note. The "Save as note" path also writes a follow-up timeline entry.
5. Move pipeline status (drawer → Edit, or change via "Log follow-up
   advance"). Reopen the timeline → a new
   `Status: <prev> → <next>` entry appears.
6. Visit `/dashboard` as a manager — `ProspectFollowUpWidget` renders
   with bucket counts and "Top priority" list. Widget tiles deep-link to
   `/prospects?followup=...`.
7. Visit `/dashboard` as a viewer — widget is absent (verified hidden).
8. Without `OPENAI_API_KEY` configured: AI draft returns a graceful
   `not_configured` message in the dialog.

## TODOs / future Growth roadmap hooks

- **Workflow builder dropdown entry for `prospect_status_changed`.** The
  trigger fires today; the builder UI just doesn't let admins author
  rules against it yet. Add it to the builder's trigger select +
  conditions schema.
- **Bulk-action follow-up reminders.** Send a digest "you have N overdue
  follow-ups" email to managers via the existing reminder cron. Reuses
  `lib/notifications/sync-reminders.ts`.
- **AI-driven nurture campaigns.** Combine `prospect_status_changed` with
  the existing `lib/workflows/execute-actions.ts` `create_ai_task` action
  to generate per-prospect nurture sequences.
- **Review & referral asks.** Post-conversion (status `won`), enqueue a
  templated review/referral request on the *customer* timeline; the
  existing `prospect_converted` event type is already a perfect anchor.
- **Per-prospect contact preferences.** Phase 1 stores email/phone but
  not channel preferences. A small `prefer_channel text` column would
  let the AI pick the right opening for SMS vs email.
- **Versioned AI prompts in the central registry.** When prospect tone
  stabilizes, promote `lib/prospects/ai-followup-prompt.ts` into a
  `equipify.email.prospect_followup_draft` entry in
  `lib/ai/prompts/registry.ts` with `task: "customer_email"` (or a new
  `prospect_followup_email` task) so prompt versioning + telemetry are
  centralized.
- **Prospect detail page** at `/prospects/[id]`: useful for Growth
  campaigns and permalinks; the drawer is enough for everyday use.
- **Inbox-style "Today's follow-ups" page** (Growth → Follow-ups). Can
  reuse `ProspectFollowUpWidget` building blocks.

## Deploy notes

- No database migrations.
- No env vars or feature flags required for the non-AI parts.
- AI draft drafts require the existing AI configuration (`OPENAI_API_KEY`
  and friends, `AI_ENABLED_PROVIDERS`). When unconfigured, the dialog
  surfaces a graceful "AI providers aren't configured" message instead
  of erroring.
- No QuickBooks, portal, or email-provider changes.
