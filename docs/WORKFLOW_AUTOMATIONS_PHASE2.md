# Workflow Automations Phase 2 — Visual Builder + Operational UX

Phase 2 turns the JSON-heavy Phase 1 editor into a manager-friendly
visual builder while preserving the underlying engine, JSON shapes, and
APIs verbatim. JSON is still authoritative on disk; the visual surface
is a lossless adapter on top of it.

## Goals

1. Visual trigger picker grouped by category, with descriptions and a
   sample-payload preview panel.
2. No-code condition builder (AND/OR groups, 1-level nesting, eight
   operators including `exists` / `changed_to`).
3. Visual action stack with drag-reorder, duplicate, delete, and
   inline configuration for the most common fields.
4. Human-readable summary for every automation row.
5. Operational UX: KPIs, search + trigger + status filters, last-run +
   recent-failure indicators, quick enable toggle, duplicate, delete,
   "Run test", and a run-history drawer.
6. Preserve advanced JSON editing under a single collapsible.

## Architectural decisions

1. **JSON stays authoritative.** Engine, dispatcher, and existing APIs
   keep reading the same shapes (`condition_config: { operator,
   rules[] }`, `action_config: { actions[] }`). The visual layer is a
   lossless adapter (`lib/workflows/visual-model.ts`) — every change
   round-trips through `parse* → serialize*`.
2. **Lossless / lossy boundary surfaced clearly.** When parsing a
   user's stored JSON cannot be represented visually (unknown action
   type, deep nesting, custom shape) the visual builder is *disabled*
   for that section, the original JSON is preserved byte-for-byte, and
   the user sees a yellow notice pointing to "Advanced JSON".
3. **Synthetic operators map onto engine operators.** `exists` saves as
   `neq null` and `changed_to` saves as `eq` so the engine — which is
   not modified — keeps working. The builder reads them back through a
   stable mapping table.
4. **Run test is a true simulator.** A new `/test` endpoint inserts a
   `workflow_runs` row with `status='simulated'`, evaluates conditions
   against the trigger's sample payload, and writes
   `workflow_run_logs` describing what *would* have happened. It
   never calls `executeWorkflowActions`, so no side effects (email
   queues, work order creation, AI jobs) are produced.
5. **Simulated runs share the existing tables.** Adding a new status
   (`simulated`) is the smallest possible schema change. The dispatcher
   never writes this status; the visual run-history drawer renders a
   distinct violet "Simulated" badge so simulator activity is easy to
   distinguish at a glance.
6. **No new permissions.** Mutations remain owner / admin / manager
   gated (existing `workflow_automations_*` RLS + the explicit role
   checks in the routes). The new `/test`, `/duplicate`, and `/runs`
   endpoints reuse the same role check used by `POST` /
   `PATCH` / `DELETE` (and member-scoped read for `/runs`).
7. **Phase 3 is documented, not built.** Webhooks, schedule reminders,
   conditional branches, retries, and templates are surfaced as
   "Coming soon" cards in the action picker so the roadmap is
   discoverable without shipping unfinished engine code.

## Files added

| Path | Purpose |
|---|---|
| `lib/workflows/human-summary.ts` | Pure summary engine — turns `{trigger_type, condition_config, action_config}` into a single sentence ("When prospect status changed and next status is one of quoted/won, notify the team and create a follow-up task in 2 days."). Used by list rows + the builder header. |
| `lib/workflows/visual-model.ts` | Visual ⇄ JSON adapter (`parseConditionConfig`, `serializeConditionTree`, `parseActionConfig`, `serializeActions`) plus visual operator catalog (`VISUAL_OPERATORS`) and tree types. |
| `lib/workflows/sample-payloads.ts` | Per-trigger sample payloads for the "Preview payload" panel and the `/test` simulator. |
| `app/api/organizations/[organizationId]/workflow-automations/[automationId]/test/route.ts` | `POST` simulator. Inserts `workflow_runs (status='simulated')`, evaluates conditions, writes per-action log lines without side effects. |
| `app/api/organizations/[organizationId]/workflow-automations/[automationId]/duplicate/route.ts` | `POST` duplicate. Clones the rule with a "(copy)" suffix, **disabled by default** so it can't accidentally double a customer-facing effect. |
| `app/api/organizations/[organizationId]/workflow-automations/[automationId]/runs/route.ts` | `GET` last 25 runs + their step logs for the run history drawer. Bounded payload. |
| `components/settings/workflow-automations/types.ts` | Shared client row types. |
| `components/settings/workflow-automations/condition-builder.tsx` | No-code condition builder (AND/OR top-level, sub-groups, eight operators, enum-aware value picker). |
| `components/settings/workflow-automations/action-stack.tsx` | Visual stack with drag-reorder, duplicate, delete, inline config. |
| `components/settings/workflow-automations/action-picker-dialog.tsx` | Grouped picker with internal / operational / customer-facing tiers and a "Coming soon — Phase 3" section. |
| `components/settings/workflow-automations/automation-builder-dialog.tsx` | Three-step builder dialog (Trigger → Conditions → Actions) with a single "Advanced JSON" collapsible. Includes "Validate against sample payload" shortcut and "Run test" / "Run history" entry points. |
| `components/settings/workflow-automations/automation-row.tsx` | List row card with trigger group badge, summary, enable switch, last-run + recent-failures stats, and per-row actions. |
| `components/settings/workflow-automations/run-history-drawer.tsx` | Right-side sheet with the last 25 runs and their step logs. Distinct badge for simulated runs. |
| `supabase/migrations/20260805100000_workflow_automation_phase2.sql` | Idempotent migration: widens `workflow_automations.trigger_type` check to include `prospect_status_changed` and widens `workflow_runs.status` to include `simulated`. |
| `docs/WORKFLOW_AUTOMATIONS_PHASE2.md` | This file. |

## Files modified

| Path | Change |
|---|---|
| `components/settings/workflow-automations-section.tsx` | Replaced the JSON-heavy Phase 1 editor with the new shell: KPIs (active / failures / runs / needs-attention), filters (search + trigger + status), automation row cards delegating to `AutomationListRow`, `AutomationBuilderDialog`, and `RunHistoryDrawer`. |
| `lib/admin/master-context.generated.ts` | Auto-regenerated (143 routes, 101 migrations). |

## Migration

Single migration: `supabase/migrations/20260805100000_workflow_automation_phase2.sql`.

- Drops + recreates `workflow_automations_trigger_type_check` to add
  `prospect_status_changed` (the API allowlist already accepted it,
  but the DB constraint hadn't been widened).
- Drops + recreates `workflow_runs_status_check` to add `simulated`.
- Idempotent (`drop constraint if exists` + `add constraint`).
- No data is rewritten.

## API surface

All routes use the existing `nodejs` runtime, RLS, and plan gating.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/organizations/{orgId}/workflow-automations` | (existing) List + last-run + 14-day stats. |
| `POST` | `/api/organizations/{orgId}/workflow-automations` | (existing) Create. |
| `PATCH` | `/api/organizations/{orgId}/workflow-automations/{id}` | (existing) Update / toggle. |
| `DELETE` | `/api/organizations/{orgId}/workflow-automations/{id}` | (existing) Delete. |
| `POST` | `/api/organizations/{orgId}/workflow-automations/{id}/test` | **NEW** Simulate the rule against the sample payload. Writes `status='simulated'`. |
| `POST` | `/api/organizations/{orgId}/workflow-automations/{id}/duplicate` | **NEW** Clone (disabled). |
| `GET` | `/api/organizations/{orgId}/workflow-automations/{id}/runs` | **NEW** Last 25 runs + per-run logs. |

Permissions:

- `POST /test`, `POST /duplicate`, `PATCH`, `DELETE` → owner / admin /
  manager (same as create today).
- `GET /runs` → any active org member, mirroring the list `GET`.

## Testing tools

- **Validate against sample payload**: a quick in-browser dry-run on the
  Conditions tab. Pure JS; uses the same operator semantics as
  `lib/workflows/conditions.ts` so results match the engine.
- **Run test (server)**: persists a `simulated` run + per-action log
  lines so the run history drawer shows what would have happened
  without firing real actions.

Both tools deliberately never call `send_email` / `send_sms` /
`create_work_order` / `assign_technician` / `update_status` /
`create_ai_task`.

## Permission summary (unchanged)

| Role     | View list | Create / edit / delete | Run test | Duplicate | Run history |
|----------|-----------|------------------------|----------|-----------|-------------|
| owner    | ✅        | ✅                     | ✅       | ✅        | ✅          |
| admin    | ✅        | ✅                     | ✅       | ✅        | ✅          |
| manager  | ✅        | ✅                     | ✅       | ✅        | ✅          |
| tech     | n/a       | ❌                     | ❌       | ❌        | n/a         |
| viewer   | n/a       | ❌                     | ❌       | ❌        | n/a         |

Plan gating (`canUseFeature("automation")`) still requires Growth /
Scale (or active trial) for any mutation, including `/test` and
`/duplicate`.

## Verification

- `pnpm update:master-context` ✅ (143 API routes, 101 migrations).
- `pnpm build` ✅ (no errors, no new warnings introduced).
- `ReadLints` ✅ across every touched file (engine + APIs + UI).

Manual smoke (after deploy):

1. Open `/settings/automations` as an owner / admin / manager on a
   Growth/Scale workspace.
2. KPIs render across the top (active / failures / runs / attention).
3. Search and filter on a trigger or status (failing). Confirm the
   counts at the bottom of the list update.
4. Click **New automation**:
   - Step 1: pick a trigger, expand "Preview payload", confirm the
     sample renders.
   - Step 2: add an `equals` rule, click "Validate against sample
     payload", confirm the green/yellow badge.
   - Step 3: open the action picker; add **Notify staff** → see it
     drop into the visual stack with drag handles.
   - Open **Advanced JSON** and confirm the JSON tracks every change.
   - Save.
5. From the list, hit **Run test** → confirm a "simulated" run appears
   in **Run history**.
6. **Duplicate** the rule → confirm a `(copy)` row appears, disabled by
   default.
7. Toggle the original off → confirm the badge flips.
8. Delete the duplicate → confirm it's removed.

Dark-mode + mobile checks:

- Hero / KPIs / row cards / dialogs / drawer all use semantic Tailwind
  tokens (`bg-card`, `text-foreground`, `border-border`,
  `bg-muted/20`) and `dark:` variants where colour pops are used
  (rose / emerald / amber / violet badges).
- Filters wrap on `< sm`; row cards reflow vertically; builder dialog
  scrolls within `max-h-[92vh]`; run history sheet uses the existing
  shadcn sheet primitive.

## Future-prep TODO roadmap

Documented for transparency — Phase 3+ candidates that the current
architecture supports without rewrites:

- **Workflow templates** (one-click bundles): seed `name`,
  `condition_config`, `action_config` from a server-side catalog. The
  saved row is identical to a hand-built rule.
- **AI-generated automations**: pipe a manager prompt through an AI
  job → return a JSON automation row → user reviews in the builder.
- **Automation marketplace**: bundle templates + share-import via a
  signed JSON blob.
- **Execution queues / delayed actions / wait timers**: introduce a
  `workflow_steps` table later; today the engine treats `actions[]` as
  a synchronous chain.
- **Retry policies**: add `retry_policy` to `automations` and a
  `attempt_count` column on `workflow_runs`.
- **Conditional branches**: extend the engine to support nested
  action groups; the visual stack already accepts grouped sub-trees,
  so the builder layer is forward-compatible.
- **Campaign sequences / referral / review automations**: scheduled
  follow-ups built on the same row shape; the action catalog has
  reserved entries.
- **Webhook action**: add a `send_webhook` action type, sign requests
  with the org's secret, log the response status to
  `workflow_run_logs`.
- **Trigger introspection API**: server-rendered trigger / action
  catalogs (already pure modules) so external tools can author rules.

## Deploy notes

1. **Run the migration first** (`20260805100000_workflow_automation_phase2.sql`).
   Without it, attempts to insert a `prospect_status_changed`
   automation, or to call `/test`, will fail the constraint check.
2. **No env vars added.**
3. **No QuickBooks / portal / certificate changes.**
4. **No engine behaviour change.** Live automations continue to
   execute identically to Phase 1; the `simulated` status is
   write-only from the new `/test` endpoint.
5. **`send_email` continues to enqueue (status `queued`)** — Phase 2
   does **not** wire a delivery provider. The action stack flags
   customer-facing actions with a "Sends to customers — review before
   enabling" badge.

## Commit / push live

```bash
cd /Users/blitz/Projects/equipify/equipify-app
git add lib/workflows/human-summary.ts \
        lib/workflows/visual-model.ts \
        lib/workflows/sample-payloads.ts \
        app/api/organizations/\[organizationId\]/workflow-automations/\[automationId\]/test/route.ts \
        app/api/organizations/\[organizationId\]/workflow-automations/\[automationId\]/duplicate/route.ts \
        app/api/organizations/\[organizationId\]/workflow-automations/\[automationId\]/runs/route.ts \
        components/settings/workflow-automations-section.tsx \
        components/settings/workflow-automations/ \
        supabase/migrations/20260805100000_workflow_automation_phase2.sql \
        lib/admin/master-context.generated.ts \
        docs/WORKFLOW_AUTOMATIONS_PHASE2.md
git commit -m "$(cat <<'EOF'
Workflow Automations Phase 2: visual builder + operational UX

- Three-step visual builder (Trigger → Conditions → Actions) with
  grouped trigger picker, sample-payload preview, no-code condition
  cards (AND/OR + 1-level nesting + eight operators), drag-reorderable
  visual action stack, and click-to-insert action picker. Advanced
  JSON stays available under a single collapsible.
- Pure helpers: human-summary engine, visual ⇄ JSON adapter, and
  per-trigger sample payloads.
- New endpoints: /test (server-side simulator that writes
  status='simulated' run + per-action log lines, never side-effects),
  /duplicate (clone disabled by default), /runs (last 25 runs +
  step logs for the new run history drawer).
- New Settings shell with KPIs (active / failures / runs / needs
  attention), search + trigger + status filters, row cards with quick
  enable toggle, duplicate, delete, run test, and run history.
- Migration widens trigger_type check to include
  prospect_status_changed and workflow_runs.status to include
  simulated.
- Engine, dispatcher, and existing APIs unchanged.
EOF
)"
git push
```
