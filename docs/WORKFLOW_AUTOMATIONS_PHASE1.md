# Workflow Automations Phase 1 — Prospect + Operational Triggers

Surface the existing workflow engine to managers in a way that's
practical and customer-service oriented. Strictly additive — no engine,
table, or RLS rewrites; no new migrations.

## Goals

1. Make `prospect_status_changed` (added in Leads Phase 2) authorable
   from the workflow builder UI.
2. Give every trigger a plain-English description so non-developers can
   pick the right one.
3. Surface the field paths usable in conditions for each trigger so
   managers don't have to read code.
4. Improve list visibility: trigger label, last run timestamp, run
   result, recent failures, enabled state.
5. Replace the "free-form actions hint" with a click-to-insert action
   helper that explains every action and flags ones that send messages
   to customers.
6. Document upcoming Growth hooks for campaigns, reviews, referrals, and
   AI nurture.

## Files added

| Path | Purpose |
|---|---|
| `lib/workflows/trigger-catalog.ts` | Single source of truth for trigger label, description, group, availability flag, sample condition snippet, and the field paths usable in condition rules. Keep aligned with `WorkflowTriggerType` and the dispatch sites. |
| `lib/workflows/action-catalog.ts` | Mirror catalog for actions: label, description, runtime status (`live` / `logged` / `coming_soon`), `autoSafe` flag for actions that reach customers, and the trigger groups each action makes sense with. |
| `docs/WORKFLOW_AUTOMATIONS_PHASE1.md` | This file. |

## Files modified

| Path | Change |
|---|---|
| `app/api/organizations/[organizationId]/workflow-automations/route.ts` | Added `prospect_status_changed` to the `TRIGGER_TYPES` allowlist; enriched the GET response with `recent_runs_count`, `recent_failure_count`, and `recent_window_days` (last 14 days). The query is bounded by 800 rows over 14 days so the additional aggregation stays cheap. |
| `app/api/organizations/[organizationId]/workflow-automations/[automationId]/route.ts` | Added `prospect_status_changed` to the validator. |
| `components/settings/workflow-automations-section.tsx` | Rewrote the dropdown to render the trigger catalog (with `<optgroup>`-style grouping), added the description / field-paths cheat-sheet panel under the trigger select, replaced the "actions hint" with a clickable action picker driven by the action catalog, added a "Last 14 days" column with run count + failure badge, surfaced last-run error tooltip, and warned at the top of the list when any automation is failing. Tooltips, badges, and tone classes match the rest of the workspace (dark-mode safe, mobile-friendly). |
| `lib/admin/master-context.generated.ts` | Auto-regenerated. |

## Migrations

**None.** All Phase 1 visibility uses existing `workflow_automations` and
`workflow_runs` columns. The new server-side `recent_*` fields are
computed from the standard columns on the read path.

## Architectural decisions

1. **Catalog files, not inline maps.**
   Having `trigger-catalog.ts` and `action-catalog.ts` as separate
   modules means future tools (a server-side trigger introspection API,
   an AI assistant, or the planned grouped builder) can import the same
   metadata. The builder UI is the first consumer; we expect more.

2. **`prospect_status_changed` is `availability: "new"`.**
   The dispatch path was wired in Leads Phase 2; the trigger table
   accepts new authorable rules now. Marking it `"new"` puts a small
   "NEW" pill next to the option in the dropdown so managers know
   they're not on the road to nowhere.

3. **Action picker doesn't auto-replace the JSON.**
   Click-to-insert appends to the existing `actions` array (or seeds a
   fresh one when the JSON is broken). This keeps power users who edit
   the JSON directly happy while still giving managers a guided path.

4. **No engine changes for `send_email` semantics.**
   `send_email` already enqueues a row in `communication_events` with
   `delivery_status: "queued"`. Phase 1 does *not* wire a delivery
   provider; instead the action catalog flags `autoSafe: false` so the
   UI shows a "Sends to customers — review before enabling" badge.
   That's the conservative behaviour the user asked for.

5. **Recent-failures aggregation lives on the existing GET endpoint.**
   We avoid creating a new `/workflow-automations/stats` route by
   inlining the 14-day rollup in the existing list response (bounded
   800 rows). Front-end consumers stay on a single fetch.

6. **Last-run error message is exposed via tooltip, not inline text.**
   Keeps the list compact. Users hover the "Failed" pill to see the
   error string. We never expose raw UUIDs — only status, timestamps,
   and human strings.

7. **Field-path cheat sheet renders inline.**
   Managers see exactly which fields they can use in `condition.rules`
   for the currently selected trigger. The same panel mentions the
   supported operators (`eq`, `neq`, `in`, `gte`, `lte`, `contains`)
   and how to combine with `operator: "and" | "or"`. No external docs
   trip required.

8. **Handles JSON-power-user habits.**
   When the user changes triggers we only re-seed the conditions JSON
   if it still matches a known sample. Custom JSON they paste is
   preserved.

## Permission summary

| Role     | View list | Create / edit / delete |
|----------|-----------|------------------------|
| owner    | ✅        | ✅                     |
| admin    | ✅        | ✅                     |
| manager  | ✅        | ✅                     |
| tech     | n/a       | ❌                     |
| viewer   | n/a       | ❌                     |

Plan-gating (`canUseFeature("automation")`) continues to require the
Growth or Scale plan (or active trial). Tech / viewer roles never reach
this Settings page in the existing layout.

## Verification

- `pnpm update:master-context` ✅ (`140 API routes, 100 migrations`)
- `pnpm build` ✅
- `ReadLints` ✅ on every touched file

Manual smoke (after deploy):

1. Open `/settings/automations` as an owner / admin / manager on a
   Growth/Scale workspace.
2. Click **New automation** → trigger dropdown shows all triggers with
   the new "Prospects & follow-ups" group at the top, and
   `Prospect status changed · NEW` selected by default.
3. Confirm the description card and field-path cheat sheet update when
   the trigger changes.
4. Insert a `Notify staff` action via the picker → JSON updates.
5. Save → list shows the new row with `recent_runs_count = 0` and no
   failure badge.
6. Trigger a real prospect status change (e.g. change a prospect's
   pipeline status); confirm the list refresh shows the run count
   incrementing in the "Last 14 days" column.
7. If any rule hits a failure, the row's "Last 14 days" cell shows
   `1 failed`, and the top of the section warns that automations are
   failing.

## TODOs / future Growth roadmap hooks

Documented for transparency — none of these are required for Phase 1 to
ship usefully:

- **Grouped condition builder UI**, replacing the JSON textarea with a
  rule-row editor driven by `TRIGGER_CATALOG[*].fieldRefs`.
- **Action card editor** matching the rule-row treatment so managers
  never need to edit JSON.
- **`prospect_status_changed` filter shortcuts**: a one-click "When a
  prospect moves to Quoted" preset that pre-fills name, conditions, and
  a `notify_internal_user` action.
- **Email delivery provider**: wire Resend/SES so `send_email`
  actually delivers. Keep the `autoSafe: false` warning until a
  provider is configured.
- **Run history drawer**: `recent_runs_count` already lives on the row;
  click to open the per-rule run log (uses existing `workflow_runs` /
  `workflow_run_logs` data).
- **Templated Growth automations**: review &amp; referral asks on
  `prospect_status_changed → won`, AI nurture sequences for
  `prospect_status_changed → follow_up`, win-back for `quote_accepted`
  + 14-day silence, etc.
- **Plan-gated bulk-clone presets**: starter rules organizations can
  enable in one click ("Notify managers when a prospect quotes",
  "Send invoice reminder at 7 days overdue", etc).
- **Trigger introspection API**: `/workflow-automations/triggers`
  (server-rendered from `trigger-catalog.ts`) so external tooling and
  the planned AI assistant can author rules.

## Deploy notes

- No database migrations.
- No env vars.
- No QuickBooks / portal / certificate behavior changes.
- `send_email` action continues to enqueue (status `queued`) — confirm
  with admins before flipping any rules to enabled if you're in a
  workspace that has just wired a real delivery provider.
