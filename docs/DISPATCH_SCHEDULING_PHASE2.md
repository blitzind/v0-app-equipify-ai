# Dispatch + Scheduling Workflow Refinement — Phase 2

Phase 2 builds on the additive Phase 1 dispatch tooling
(`docs/DISPATCH_SCHEDULING_PHASE1.md`) without rewriting the dispatch board,
service-schedule page, work order, or maintenance-plan systems. Every change is
opt-in: removing/disabling Phase 2 code returns the surfaces to their Phase 1
behavior.

## Goals

- Make day-to-day dispatcher state durable (filter chips survive reload + org
  switch).
- Surface forward-looking workload (Tomorrow / Next 7 days) without leaving the
  dispatch view.
- Catch obvious double-bookings during Quick Add and drag/drop without blocking
  the action.
- Bring the service schedule into closer parity with dispatch (status
  persistence, week overview, KPI tiles).
- Lay a small, additive foundation for operator scheduling notes / audit
  trails.
- Keep mobile dispatch UX clean and compact.

## Files changed

### New

- `lib/dispatch/persisted-prefs.ts` — per-organization `localStorage`
  hook (`usePersistedDispatchPref`) with SSR safety, namespaced keys
  (`equipify:dispatch:v1:<scope>:<key>:<orgId>`), and an optional schema guard
  to discard stale shapes.
- `lib/dispatch/scheduling-conflicts.ts` — pure helpers
  (`findSlotConflicts`, `describeConflicts`) that scan already-loaded dispatch
  rows for tech + date + slot collisions. No network calls; reused by Quick Add
  and the dispatch page drag handler.
- `lib/dispatch/scheduling-events.ts` — server-only helpers
  (`recordSchedulingEvent`, `listSchedulingEventsForWorkOrder`) over the new
  `work_order_scheduling_events` table.
- `app/api/work-orders/scheduling-events/route.ts` — `GET`/`POST` route for
  reading + writing operator notes/actions on a work order. RLS-enforced via
  the caller's Supabase session (no service-role bypass).
- `supabase/migrations/20260507120000_work_order_scheduling_events.sql` — new
  audit table with org RLS (`is_org_member` for read, `has_org_role` for
  insert).
- `docs/DISPATCH_SCHEDULING_PHASE2.md` — this file.

### Modified

- `lib/dispatch/operational-badges.ts` — adds `due-tomorrow` badge,
  `due_tomorrow` + `due_next_7` flags, `due_tomorrow` / `due_next_7` filter ids,
  and toolbar entries. `due_next_7` is a strict forward window (excludes
  today; includes day +7) so Tomorrow + Today + Next 7 are non-overlapping in
  the KPI strip.
- `lib/dispatch/build-dispatch-wos.ts` — extends `filterDispatchRows` with the
  two new ids.
- `components/dispatch/quick-appointment-dialog.tsx` — accepts
  `existingWorkOrders?: DispatchWo[]`. When the chosen tech + date + slot
  overlaps loaded jobs the dialog renders an inline informational warning
  (with up to 3 conflicting WO chips). Submit is **never blocked**.
- `components/dispatch/dispatch-board.tsx` — softer empty-state copy on the
  Unassigned pool ("Inbox is clear" + guidance).
- `components/dispatch/dispatch-mobile-list.tsx` — empty-state copy for
  Unassigned and per-tech sections; per-tech copy mentions Quick Add.
- `app/(dashboard)/dispatch/page.tsx`
  - Status filter chips + "Include invoiced" persisted per organization via
    `usePersistedDispatchPref` (still falls back to Phase 1 defaults).
  - KPI snapshot grew from 9 to **11 tiles** with new "Tomorrow" and
    "Next 7 days" focus filters; grid bumps to `xl:grid-cols-11`.
  - `handleMoveWo` runs `findSlotConflicts` *before* persisting and surfaces a
    `destructive` toast after the save when a conflict is detected. The move is
    still saved — toast is informational and matches existing post-load
    `AlertTriangle` overlap chip on cards.
  - `QuickAppointmentDialog` is now passed the already-loaded `workOrders` so
    the inline conflict warning works for Quick Add too.
- `app/(dashboard)/service-schedule/page.tsx`
  - Status filter chips + "Include invoiced" persisted per organization
    (separate `schedule` scope from dispatch so each surface remembers its own
    state).
  - New "Scheduling snapshot" KPI strip (Due today / Tomorrow / Next 7 days /
    Overdue / Unassigned 48h+) — clickable, drives `scheduleOpsFilter`.
  - Embeds `DispatchWeekOverview` (Phase 1) using technicians and rows already
    loaded for the scheduled work-orders section. Clicking a day sets the
    overview anchor + jumps the calendar to the same day in `day` sub-view.
  - Scheduled-work-order section gets a richer empty-state with
    `ClipboardList` icon + filter-tweak guidance.

### Auto-regenerated

- `lib/admin/master-context.generated.ts` (now **127 API routes**, **95
  migrations**) — picked up the new scheduling-events route + migration via
  `pnpm update:master-context`.
- `lib/admin/master-context.ts` — refreshed `MASTER_CONTEXT_LAST_UPDATED_ISO`.

## Migrations

| Migration | Purpose | Safety |
|---|---|---|
| `20260507120000_work_order_scheduling_events.sql` | Lightweight operator-notes log on work-order scheduling actions. New table only — does not alter `work_orders`, dispatch, or maintenance-plan systems. RLS read = `is_org_member`, RLS insert = `has_org_role(['owner','admin','manager','tech'])`. | Pure additive. Drag/drop / quick-add do **not** write here today; foundation only. |

## Architectural decisions

1. **Persistence lives in `localStorage`**, not the database. Dispatcher
   filters are personal preferences, not workspace policy; storing them in the
   DB would require a new table + write path on every chip toggle. The hook
   namespaces keys per organization so workspace switches don't bleed state.
2. **Conflict detection is client-side only.** Both dispatch and service
   schedule already paginate work orders into the active week / scheduled
   window; reusing those loaded rows means zero new fetches and instant
   feedback. Hard enforcement (if ever required) belongs at the API/DB layer,
   not at the chip level.
3. **Toast over modal for drag/drop conflicts.** A confirm dialog would
   interrupt rapid scheduling flows. The post-save toast (with
   `destructive` variant) plus the existing in-cell `AlertTriangle` chip
   already on overlapping cards gives dispatchers two persistent visual signals
   without slowing the drop.
4. **`due_next_7` is exclusive of today.** This keeps the new KPI tiles
   non-overlapping with "Due today" so dispatchers can't double-count the same
   job across two tiles in the same row.
5. **Service schedule reuses the dispatch week overview component** instead of
   forking a parallel one; the technician roster is derived from already-loaded
   scheduled rows (no new query). Click-to-jump bridges the inline week strip
   into the existing calendar `day` sub-view, so existing maintenance-plan
   filtering / reschedule / map flows are untouched.
6. **Scheduling events table mirrors the import operator events shape**
   (Phase 4 imports). A future unified audit/timeline UI can union both
   sources without schema gymnastics.
7. **No service-role bypass for scheduling events.** The notes API uses the
   caller's Supabase session, so RLS enforces org membership + role. This keeps
   audit attribution honest and avoids a second power surface.

## TODOs / next phase candidates

- Render scheduling events in the work-order drawer / detail page (timeline
  card). Foundation is in place; UI is not wired.
- Auto-emit `reschedule` / `reassign` events from `handleMoveWo` and Quick Add
  success — currently operator-only manual notes via API.
- Extend conflict detection to include the upcoming +1 / -1 slot (light
  "back-to-back" warning) once windowing perf is measured.
- Persist the dispatcher's preferred sort (`schedule` vs `priority`) the same
  way as status chips.
- Mobile drag/drop polish (`@dnd-kit` touch sensors) — out of scope for
  Phase 2 since native scrolling on the mobile list is sufficient for
  reschedules today.

## Verification

- `pnpm update:master-context` ✓ (127 API routes, 95 migrations).
- `pnpm build` ✓ (Next.js production build succeeded; no new TypeScript
  errors).
- Lints checked on all touched files via `ReadLints` — clean.
- No raw UUIDs surfaced in UI (work-order numbers continue to flow through
  `getWorkOrderDisplay`; technician + customer labels resolved via existing
  maps).
- Mobile responsiveness preserved: KPI grid starts at `grid-cols-2`, status
  chips wrap, conflict warning is full-width inside the dialog.
- Dark mode preserved (status colors via `--status-*` tokens, `bg-card`,
  `border-border`).
- Drawer/sheet patterns unchanged: `ScheduleServiceDrawer`,
  `MaintenancePlanDrawer`, `WorkOrderDrawer`, `RescheduleModal`,
  `QuickAppointmentDialog` all retain Phase 1 mounting + scrim behavior.

## Deploy notes

1. Apply the new migration in Supabase before deploying the new API route /
   any UI that exercises it:
   ```bash
   supabase db push
   ```
   The route gracefully no-ops on `403` (missing table / RLS), so a partially
   migrated environment will not crash dispatch.
2. No new env variables are required.
3. `pnpm update:master-context` was run; the regenerated file is in this
   change set. CI may regenerate it again — that's fine, it's deterministic.
4. Filter persistence is per browser + per organization. Existing dispatchers
   will see their Phase 1 defaults until they toggle a chip the first time.
