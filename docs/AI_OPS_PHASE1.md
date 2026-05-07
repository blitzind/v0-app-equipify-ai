# AI Operational Assistant — Phase 1

A practical "next actions" layer that surfaces operational
recommendations derived from existing Equipify data. Phase 1 is
**deterministic and read-only**: every recommendation is produced
by a transparent rule, no records are mutated, and no customer
messages are sent automatically.

## What shipped

### 1. Recommendation engine (`lib/ai-ops/`)

- `types.ts` — shared `Recommendation`, `RecommendationCategory`,
  `RecommendationPriority`, response shapes.
- `rules.ts` — pure rule set, one `RuleDescriptor` per category:

  | Rule | Category | Permission gate | Source |
  | --- | --- | --- | --- |
  | `stale_prospect` | prospect | `canManageProspects` | `prospects` |
  | `overdue_invoice` | financial | `canViewFinancials` | `org_invoices` |
  | `unscheduled_priority_wo` | dispatch | (operational) | `work_orders` |
  | `repeat_repair_risk` | equipment | (operational) | `work_orders` + `equipment` |
  | `certificate_release_pending` | certificate | `canReleaseCertificatesToPortal` | `calibration_records` |
  | `low_stock` | inventory | `canManageInventory` | `inventory_stock` + `catalog_items` |
  | `failed_communication` | communications | `canManageCommunications` | `communication_events` |
  | `automation_failure_burst` | automation | `canManageAutomations` | `workflow_runs` + `workflow_automations` |
  | `maintenance_due_soon` | maintenance | (operational) | `equipment` |

- `engine.ts` — orchestrates rule execution in parallel, applies
  per-category permission gating, removes/snoozes dismissed items
  via `ai_ops_dismissals`, sorts by priority + anchor, and returns
  a `RecommendationsResponse` with summary KPIs.

Rules are intentionally cheap: every query has a date / status
filter and a small `limit` (25 per rule, 50 in the response by
default, capped at 100). One bad rule cannot blank the dashboard
— failures are caught and logged.

### 2. API

- `GET /api/organizations/{orgId}/ai-ops/recommendations`
  — query params: `category`, `priority`, `search`, `limit`,
  `includeDismissed`. Returns the engine response with `role` and
  `canDismiss`.
- `POST /api/organizations/{orgId}/ai-ops/dismissals`
  — manager-only. Body: `{ key, category, snoozeHours?, reason? }`.
  `snoozeHours=0` dismisses indefinitely. Idempotent upsert keyed
  by `(organization_id, recommendation_key)`.
- `DELETE /api/organizations/{orgId}/ai-ops/dismissals?key=…`
  — manager-only. Re-shows a dismissed recommendation.

### 3. UI

- `/ai-ops` page — hero, KPI strip (total / high / medium / low),
  search + category + priority filters, by-category badges, grid
  of `RecommendationCard`s.
- `RecommendationCard` — priority ribbon, category icon + label,
  title, explanation, entity quick-link, metric pill, primary +
  secondary actions, manager-only snooze menu (1d / 3d / 1w / 30d
  / dismiss indefinitely).
- `AiOpsSummaryWidget` — compact dashboard widget showing the top
  4 high/medium recommendations with a "View all" link to `/ai-ops`.
  Embedded on the main `/` dashboard alongside the existing
  prospect follow-up widget.
- Sidebar entry under **Automation & Intelligence** between
  Insights and Communications. Gated by `canViewInsights`
  (no `requireAiPlan` — Phase 1 is rule-based, not LLM-backed).

### 4. Permissions

The dashboard route requires `canViewInsights`. Within the rule
engine, **per-category permission gates** silently drop rules the
caller can't see (no 403 at the page level):

- Financial → `canViewFinancials`
- Prospect → `canManageProspects`
- Communications → `canManageCommunications`
- Inventory → `canManageInventory`
- Certificate → `canReleaseCertificatesToPortal`
- Automation → `canManageAutomations`
- Operational (dispatch / equipment / maintenance) → any member.

Tech-safe operational visibility is preserved — techs see
unscheduled high-priority work orders, repeat-repair risks, and
upcoming PMs without ever seeing financial or prospect cards.

Dismiss / snooze writes require `canManageWorkspaceSettings`
(owner / admin / manager) and are enforced at the API + RLS
layer.

### 5. Persistence

One additive table:

```
ai_ops_dismissals
  id                  uuid pk
  organization_id     uuid (fk organizations, cascade)
  recommendation_key  text  -- e.g. "overdue_invoice:<uuid>"
  category            text
  snoozed_until       timestamptz null  -- null = indefinite
  dismissed_by        uuid null (fk auth.users)
  reason              text null
  created_at          timestamptz
  unique (organization_id, recommendation_key)
```

RLS:
- `select` for any org member.
- `all` (insert/update/delete) for owner/admin/manager only.

Migration: `supabase/migrations/20260807100000_ai_ops_dismissals_phase1.sql`.

### 6. Hybrid AI hook (Phase 2 prep)

The engine emits `confidence: "deterministic"` today. Phase 2 can:

1. Add an optional `narrate` step that calls `runAiTask` with a
   short JSON serialization of a single recommendation and asks
   the LLM to rewrite the `explanation` and add a longer
   suggested-message draft.
2. Gate AI narration behind plan/billing access (`useBillingAccess`,
   `aiFeatureUpgradeMessage`) and the per-org AI budget so we never
   trigger LLM costs from a passive dashboard load.
3. Cache narrations by `recommendation_key` in `ai_cache`.
4. Distinguish AI-narrated cards in the UI with the existing
   `Bot` badge pattern from `RecentCommunicationsCard`.

## Files changed

```
supabase/migrations/20260807100000_ai_ops_dismissals_phase1.sql              (new)
lib/ai-ops/types.ts                                                          (new)
lib/ai-ops/rules.ts                                                          (new)
lib/ai-ops/engine.ts                                                         (new)
app/api/organizations/[organizationId]/ai-ops/recommendations/route.ts       (new)
app/api/organizations/[organizationId]/ai-ops/dismissals/route.ts            (new)
components/ai-ops/category-meta.ts                                           (new)
components/ai-ops/recommendation-card.tsx                                    (new)
components/ai-ops/ai-ops-page.tsx                                            (new)
components/ai-ops/ai-ops-summary-widget.tsx                                  (new)
app/(dashboard)/ai-ops/page.tsx                                              (new — route entry)
app/(dashboard)/page.tsx                                                     (embed AiOpsSummaryWidget)
components/app-sidebar.tsx                                                   (sidebar entry)
components/page-shell.tsx                                                    (suppress global hero on /ai-ops)
docs/AI_OPS_PHASE1.md                                                        (new — this file)
```

## Migrations

- `20260807100000_ai_ops_dismissals_phase1.sql` — additive,
  idempotent, RLS-hardened. No changes to existing tables.

## TODO roadmap

- [ ] Optional AI narration of `explanation` (Phase 2 hook above).
- [ ] Daily digest email — surface yesterday's high-priority items
      to managers via the existing notification scheduler.
- [ ] Slack / Teams forwarding for new high-priority recommendations.
- [ ] Convert "Draft follow-up" action on prospect cards into a
      direct call to `/api/.../prospects/{id}/draft-followup` so
      managers don't need to bounce through the prospect drawer.
- [ ] "Create automation suggestion" action — pre-fills the
      Workflow Automations builder with a sensible template based on
      the recommendation category.
- [ ] Predictive maintenance insights (e.g. equipment with
      accelerating failure cadence) once equipment intelligence
      rollups land.
- [ ] Per-user (vs per-org) snooze for personal triage queues.
- [ ] Aggregated `ai_ops_outcomes` table for measuring whether
      acted-on recommendations actually closed the loop (invoice
      paid, prospect won, work order scheduled).

## Architectural decisions

- **Derived, not stored.** Recommendations are recomputed on
  every request from existing source tables. This guarantees the
  dashboard reflects current state and removes any sync surface.
  The only persistence layer is `ai_ops_dismissals`, which is a
  UI hint — not a workflow.
- **Per-rule permission gating.** The engine drops entire rules
  when the caller lacks the permission, rather than 403-ing the
  whole page or post-filtering individual rows. This keeps
  techs/viewers usefully informed without exposing financial or
  prospect data they shouldn't see.
- **Stable recommendation keys.** Every recommendation has a
  `<rule_id>:<entity_id>` key so dismissals dedupe across reloads
  and the UI can do optimistic removal without a refetch.
- **No new AI plumbing.** Phase 1 ships zero LLM calls so it
  works on every plan including free tiers. The hybrid AI hook
  is documented but deferred to Phase 2.
- **Future-prep without lock-in.** The action `type` enum lives
  in `types.ts`; adding new actions (e.g. `mark_invoice_paid`) is
  one entry plus a UI handler. The category enum is open in the
  same way.
