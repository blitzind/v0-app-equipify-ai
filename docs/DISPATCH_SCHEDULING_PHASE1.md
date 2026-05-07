# Dispatch + Scheduling Workflow Refinement — Phase 1

Additive operational polish on the existing dispatch board and service-schedule
surfaces. **No** scheduling architecture, work-order ownership, maintenance-plan
generation flow, scheduling APIs, or dispatch board foundations were rewritten.

## Goals

Improve the operational speed and usability of the dispatch/service workflow
for real biomedical-equipment field-service usage:

- Faster recognition of "where work is" (status quick filter, week overview)
- Faster appointment creation (Quick Add dialog from any slot or technician)
- Clearer "Unassigned" queue + drag/drop polish
- Lightweight operational badges (overdue, due today, waiting on parts,
  certificate pending, invoice pending)
- Equipment count + scheduled time visible on dispatch cards
- Status filtering (open, scheduled, in progress, completed, invoiced)
- Mobile dispatch parity (per-technician day count + Quick Add)

## Files added

| File | Purpose |
| --- | --- |
| `lib/dispatch/status-filter.ts` | Status quick-filter helpers (`DispatchStatusKey`, `filterByStatuses`, `countByStatus`, status-tone classes). |
| `components/dispatch/dispatch-status-filter.tsx` | Multi-select chip strip with per-status counts and `Include invoiced` toggle. |
| `components/dispatch/dispatch-week-overview.tsx` | Compact technician × weekday grid with assignment counts; click to jump day. |
| `components/dispatch/quick-appointment-dialog.tsx` | Speed-optimized appointment dialog (customer + equipment + date/time + tech + priority). |
| `docs/DISPATCH_SCHEDULING_PHASE1.md` | This document. |

## Files modified

| File | Change |
| --- | --- |
| `lib/dispatch/operational-badges.ts` | Added `due-today` badge + `due_today`, `waiting_on_parts`, `invoice_pending` flags + filter ids. Updated labels: `Past schedule` → `Overdue`, `Parts` → `Waiting on parts`, `Not invoiced` → `Invoice pending`. Reordered focus options to surface the user-facing operational states first. |
| `lib/dispatch/build-dispatch-wos.ts` | Added new filter cases (`due_today`, `waiting_on_parts`, `invoice_pending`) and exposed `equipmentCount` on `DispatchWo`. |
| `components/dispatch/dispatch-board.tsx` | Card now shows scheduled time chip + equipment count chip (with tooltip). Added per-technician column "+" Quick Add button. Empty technician slots reveal a hover Quick Add affordance. Unassigned section header gains count + Quick Add button. New `onQuickAdd` callback (optional). |
| `components/dispatch/dispatch-mobile-list.tsx` | Per-section count + Quick Add button. Equipment count chip surfaced. Optional `onQuickAdd` prop. |
| `app/(dashboard)/dispatch/page.tsx` | Wires `DispatchStatusFilter`, `DispatchWeekOverview`, `QuickAppointmentDialog`. KPI snapshot is now click-to-filter and includes "Due today" + "Overdue" tiles. Status filter widens the work-order Supabase `in (...)` query when "Include invoiced" is enabled. |
| `app/(dashboard)/service-schedule/page.tsx` | Adds the same `DispatchStatusFilter` chip strip above the "Scheduled Work Orders" panel for parity (filter is client-side; the page already loads all statuses). |

## Migrations

**None.** This phase is pure UI / client-side filtering / additive query
parameters. No DB schema changes were required.

## Architectural decisions

1. **Status filter is client-side.** The dispatch fetch keeps the existing
   four-status `in (...)` clause by default. Toggling the new "Include invoiced"
   chip widens the query to add `invoiced` so dispatchers can see recently
   billed jobs without forcing the heavier query path on everybody. The chip
   strip then drives a client-side filter on top.
2. **`due_today` is derived, not denormalized.** The badge resolves from
   `wo.scheduled_on === today` for active statuses inside `deriveOperationalBadges`,
   so it stays consistent with how every other ops cue is computed (no extra
   queries, no extra columns).
3. **Quick Add is a NEW dialog, not a parallel system.** It writes to
   `work_orders` using the same `workOrderAssignmentColumns()` resolution and
   `repair_log` shape used by the existing `ScheduleServiceDrawer`, so a
   work order created here is indistinguishable downstream from one created
   via the full flow. The full Schedule Service drawer remains untouched and
   continues to handle notifications/locations/repeats.
4. **`onQuickAdd` is optional on the board.** This preserves all current
   callers; only the dispatch page wires it. The mobile list mirrors the
   prop so we can re-use the dialog seamlessly on small screens.
5. **DnD semantics unchanged.** `useDraggable`, `DroppableSlot`,
   `DroppablePool`, `buildSchedulePatch`, lease/assignment columns — all
   untouched. The empty-cell hover button uses a stop-propagation click and
   does not affect the existing drag handle.
6. **Badge label changes are cosmetic only.** The underlying badge `key`s
   (`sched-past`, `parts`, `cni`, `cert`) are unchanged so any existing
   integrations / tests keying on them keep working.

## Operational badges — Phase 1 surface

| User-asked label | Underlying flag/key | Notes |
| --- | --- | --- |
| Overdue | `sched_past_due` (key `sched-past`) | Active WO with `scheduled_on < today`. Tone bumped to `danger`. |
| Due today | `due_today` (key `due-today`) | NEW. Active WO scheduled today. Tone `info`. |
| Waiting on parts | `waiting_on_parts` (key `parts`) | Existing flag (`total_parts_cents > 0` for active statuses), label refreshed. |
| Certificate pending | `cert_pending` (key `cert`) | Existing — calibration template + completed + no record. |
| Invoice pending | `invoice_pending` (key `cni`) | Existing — completed work without linked invoice; aging tier (`cni-14`) still surfaces. |

## TODOs / Phase 2 candidates

- Persist user's status quick-filter and "Include invoiced" toggle in
  `localStorage` per-org so dispatchers don't re-pick on each visit.
- Drag a work order from the calendar/month view (service-schedule) to
  re-target a date — currently DnD is dispatch-only.
- Slot conflict warning when Quick Add drops into a populated slot.
- Promote the week overview into the service-schedule page calendar view.
- Add a "Tomorrow" KPI tile and a "Next 7 days" badge for forward planning.
- Lightweight operator notes log on the work-order drawer (foundation already
  exists in `organization_import_run_operator_events` shape; would mirror).

## Verification

- `pnpm update:master-context` → 125 API routes, 94 migrations regenerated.
- `pnpm build` → compiled successfully (Turbopack 16.2.4), all 117 static
  pages generated, no new lint warnings on touched files.

## Deploy notes

No DB migrations. No env changes. No background jobs. Standard deploy.

## Routes affected (UI surfaces)

- `/dispatch` — dispatch board, mobile list, status filter, week overview, quick add.
- `/service-schedule` — additional status filter chip strip above scheduled WOs.

Both routes preserve their existing data-loading paths, RLS-aware Supabase
queries, drawers (`WorkOrderDrawer`, `MaintenancePlanDrawer`,
`ScheduleServiceDrawer`), and dark-mode/mobile-responsive styling.
