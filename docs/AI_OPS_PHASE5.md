# AI Operational Assistant — Phase 5 (Closed-loop operational automation)

Phase 5 turns AI Ops into an **operational command center**: lifecycle states,
an append-only audit trail, a slide-over **command drawer** with context,
and **approval-only** actions that reuse existing permissions and APIs.

The deterministic rule engine remains the **only** source of what appears on the
list — lifecycle and scores **never hide** a surfaced recommendation by
themselves (operators still use dismiss/snooze for that).

See prior phases: [`AI_OPS_PHASE4.md`](./AI_OPS_PHASE4.md) (Slack/Teams + ranking).

---

## Data model

### `ai_ops_recommendation_lifecycle`

One row per `(organization_id, recommendation_key)`:

| Column | Notes |
| --- | --- |
| `state` | `pending`, `acknowledged`, `in_progress`, `completed`, `ignored`, `escalated` |
| `notes` | Optional operator notes (future UI hook) |
| `updated_by`, `updated_at` | Last editor |

RLS: members **select**, managers **write** (aligned with dismissals).

### `ai_ops_recommendation_events` (append-only)

Append-only event rows for timeline / audits:

| Column | Notes |
| --- | --- |
| `event_type` | e.g. `lifecycle_updated`, `communication_sent`, `action_executed`, `workflow_triggered` |
| `outcome` | Short machine-readable outcome label |
| `metadata` | Small JSON — **never** webhook URLs, secrets, or signed URLs |

RLS: members **select**, managers **insert**. No update/delete policies for
`authenticated` (tamper resistance).

---

## Deterministic command scoring

[`lib/ai-ops/command-score.ts`](../lib/ai-ops/command-score.ts) adds an explainable
numeric score for ordering inside priority bands:

1. **Priority band** — high / medium / low base points.
2. **Lifecycle** — light boosts for `in_progress` / `escalated`, mild penalty
   for `ignored` / `completed` (sort-only).
3. **Staleness** — up to **+21** points when `anchorIso` is in the past (capped
   by days).

Sorting is **strict priority first**, then score within the band (`sortRecommendationsForCommandCenter`).

---

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/organizations/[organizationId]/ai-ops/recommendations` | GET | Engine output + lifecycle merge + scoring + `canCommand` |
| `.../recommendations/[recommendationKey]/lifecycle` | PATCH | Update lifecycle state (manager+) |
| `.../recommendations/[recommendationKey]/timeline` | GET | Events + optional synthetic `recommendation_surfaced` via `?surfacedAt=` |
| `.../recommendations/[recommendationKey]/execute-action` | POST | Approval-gated operational action |

`recommendationKey` must be URL-encoded when it contains characters outside the
safe path alphabet.

---

## Operational actions (explicit confirmation only)

All actions are executed server-side only after `confirm: true` in the POST body.
The server **re-derives** the recommendation via `generateRecommendations({
filter: { recommendationKey, includeDismissed: true }})` — same pattern as AI narration.

| Action ID | Permission sketch | Behavior |
| --- | --- | --- |
| `send_invoice_reminder` | `canEditInvoices` | Customer-facing email via Resend; updates invoice status like `/api/invoices/send-email` |
| `create_follow_up_task` | Billing gate (`org_task`) | Inserts `org_tasks` with `source_type = ai_ops` |
| `create_workflow_automation` | `canManageAutomations` | Redirect-only — automation still manually saved |
| `assign_technician` | `canEditWorkOrders` | Sets `work_orders.assigned_user_id` |
| `restock_inventory` | `canConsumePartsOnWorkOrders` | Zero-delta ledger row (`reorder_recorded`) |
| `release_certificate` | `canReleaseCertificatesToPortal` | Sets `portal_released_at` |
| `schedule_maintenance` | Dispatch / WO edit | Redirect to `/maintenance-plans?new=1&…` |
| `draft_prospect_followup` | `canManageProspects` | Opens existing draft dialog — **no auto-send** |

---

## UI

- **`AiOpsCommandCenterDrawer`** — Sheet with lifecycle controls, related entity,
  communications excerpt (when entity maps to `communications/feed`), workflow
  suggestion link, AI explanation, operational actions with **AlertDialog**
  confirmation, and timeline.
- **`RecommendationCard`** — **Command center** button + lifecycle/score chips.

---

## Safety guarantees

1. **No autonomous customer email** — invoice reminders send only after explicit
   confirmation in the drawer dialog (plus server-side permission checks).
2. **No silent mutations** — every mutation logs `ai_ops_recommendation_events`.
3. **Webhook secrets never stored** in Phase 5 tables (digest Phase 4 unchanged).
4. **Tenant isolation** — all queries scoped by `organization_id` + existing RLS.

---

## TODOs / follow-ups

- Surface operator notes on lifecycle PATCH in the drawer textarea.
- Auto-refresh recommendation list after successful mutations from the drawer.
- Optional linkage from `ai_ops_outcomes` → timeline rows for parity with Phase 2 telemetry.
- Narrow technician picker to dispatch-eligible roles only (today: filtered tech-capable members).

---

## Migration

`supabase/migrations/20260811100000_ai_ops_phase5_closed_loop.sql`

---

## Verification

```bash
pnpm update:master-context
pnpm build
```
