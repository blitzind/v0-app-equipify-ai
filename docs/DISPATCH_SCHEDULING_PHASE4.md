# Dispatch + Scheduling Workflow Refinement — Phase 4

Date: 2026-05-07

> **Naming note.** The user's "Dispatch + Scheduling Phase 3" prompt continued
> from the work in `DISPATCH_SCHEDULING_PHASE2.md`. Because
> `DISPATCH_SCHEDULING_PHASE3.md` already documented the density / hierarchy
> refactor (collapsible KPIs, opt-in week overview, "More filters", lane-header
> pill counts), this round is filed as **Phase 4** to keep the doc numbering
> monotonic. The user-facing changes still match what the prompt called Phase
> 3.

Phase 4 turns the **scheduling events table** that has been quietly waiting in
the database (since `20260507120000_work_order_scheduling_events.sql`) into a
visible operator activity trail. Drag/drop reschedules, technician
reassignments, quick-add appointments, and acknowledged conflicts are all
captured and rendered as a lightweight timeline inside the work-order drawer.

## Goals

- **Operators can see scheduling history per work order** without navigating
  away from the dispatch board.
- **Mutations stay non-blocking** — event logging is fire-and-forget; if the
  insert fails the dispatch action still succeeds.
- **No raw UUIDs in user-rendered messages** — everything is composed from
  human labels (technician name, scheduled date/time). IDs are kept in
  `metadata` only.
- **Sort preference persists** across reloads (per organization).
- **Conflict UX matures** — adjacent (±1 slot) warnings now surface as
  informational toasts/inline notes; exact-slot conflicts remain destructive
  warnings.

## What changed

### 1. Scheduling activity timeline in the work-order drawer

`components/dispatch/scheduling-events-card.tsx` (new)
`components/drawers/work-order-drawer.tsx`

- New `<SchedulingEventsCard>` component renders the work order's recent
  scheduling activity in a compact card (`bg-card/40`, severity-driven left
  border, "show N more" toggle).
- Uses the existing `/api/work-orders/scheduling-events` endpoint via the new
  browser helper (`fetchSchedulingEvents`); RLS already restricts reads to
  organization members.
- Mounted inside the drawer below "Operational signals" so it appears for
  every work order with at least one event, but never expands the drawer when
  there is nothing to show (returns `null` on empty result).
- Empty / loading / error states all degrade gracefully — never throws,
  never floods the console.

### 2. Auto-emit scheduling events

`lib/dispatch/scheduling-events-client.ts` (new)

A small browser helper exposes `emitSchedulingEvent(...)` (fire-and-forget
POST) and pre-built message composers (`composeRescheduleMessage`,
`composeReassignMessage`, `composeUnassignMessage`, `composeQuickAddMessage`,
`composeConflictAcknowledgedMessage`). All composers expect human labels and
never embed IDs in the rendered message.

Auto-emit wired in:

- **`/dispatch` → drag/drop reschedule** (`app/(dashboard)/dispatch/page.tsx`):
  - `reassign` / `unassign` when the technician changes.
  - `reschedule` when date/time changes (and assignment exists).
  - `conflict_acknowledged` (severity `warning`) on exact-slot conflicts.
  - `conflict_acknowledged` (severity `info`) on ±1 slot conflicts.
- **Quick add appointment** (`components/dispatch/quick-appointment-dialog.tsx`):
  - `quick_add` after the new work order is inserted.
  - `conflict_acknowledged` if the user submits over a known conflict.
- **Work order drawer**:
  - Reassign dialog (`persistTechnicianAssignment`) emits `reassign` /
    `unassign`.
  - `Save Changes` from edit mode emits `reassign` / `unassign` and/or
    `reschedule` when the relevant fields differ from the saved record.

All emits run after the underlying `work_orders` mutation has succeeded; they
are intentionally not awaited and do not surface their own toasts (the
mutation already does so). Failures are silently dropped in production and
warned in development.

### 3. Persisted dispatch sort preference

`lib/dispatch/persisted-prefs.ts`
`app/(dashboard)/dispatch/page.tsx`

- Added `"sort"` to `DispatchPrefKey` (default `"schedule"`, validated by a
  type guard).
- Replaced the `useState` for `dispatchSort` with `usePersistedDispatchPref`
  so the choice survives reloads and is per-organization.

### 4. ±1 neighboring slot conflict detection

`lib/dispatch/scheduling-conflicts.ts`

- New `findNeighborSlotConflicts(...)` returns rows on the same technician +
  same day in adjacent (±1) slots, excluding the exact slot (already covered
  by `findSlotConflicts`).
- New `describeNeighborConflicts(...)` formats a soft inline summary — e.g.
  `"Sandra has an adjacent job — leave travel time."`
- Quick add dialog and dispatch board both consume the new helper; they only
  show the neighbor warning when there is no exact-slot conflict to keep the
  inline UI to one row.

### 5. Mobile / touch scheduling usability

`components/dispatch/dispatch-board.tsx`

- Added a dedicated `TouchSensor` next to the existing `PointerSensor`
  (`@dnd-kit/core`). Touch uses `delay: 180ms` + `tolerance: 6px` so list
  scrolling on a phone is not hijacked into a drag.
- Pointer activation distance unchanged (still `6px`) so mouse feel is
  preserved.
- Draggable card wrappers gain `select-none` plus `cursor-grab` /
  `cursor-grabbing` affordance.
- Existing dispatch board / mobile list visual layout is otherwise unchanged.

### 6. User-facing copy without raw UUIDs

All emitted messages are composed by helpers that take labels as inputs and
emit prose. The `metadata` JSON column on `work_order_scheduling_events`
captures structured IDs (previous/next technician id, conflict work-order
ids, source) for audit reconstruction; that JSON is never rendered in the
timeline UI.

## What didn't change

- `work_order_scheduling_events` schema / migration — already in place from
  Phase 2.
- The existing scheduling-events POST route — message clamp and validation
  are unchanged.
- `enrichDispatchWorkOrders`, badge derivation, status filter, and KPI tiles.
- Drag/drop persistence (`buildSchedulePatch`) — events fire **after** the
  patch succeeds.
- `ScheduleServiceDrawer`, `MaintenancePlanDrawer`, `WorkOrderDrawer` mount
  semantics. The drawer just renders one extra small card under the
  operational-signals strip.
- Maintenance-plan generated work order flow.
- Service-schedule lists / portal continuity.

## Files changed

- `app/(dashboard)/dispatch/page.tsx`
- `components/dispatch/dispatch-board.tsx`
- `components/dispatch/quick-appointment-dialog.tsx`
- `components/dispatch/scheduling-events-card.tsx` (new)
- `components/drawers/work-order-drawer.tsx`
- `lib/dispatch/persisted-prefs.ts`
- `lib/dispatch/scheduling-conflicts.ts`
- `lib/dispatch/scheduling-events-client.ts` (new)
- `docs/DISPATCH_SCHEDULING_PHASE4.md` (this file)

## Migrations

None. Phase 4 reuses `work_order_scheduling_events` from Phase 2.

## Architectural decisions

- **Emit from the browser, not the server**, so we keep auth simple
  (`createServerSupabaseClient` in the route handler reads the caller's
  session for RLS) and so the dispatch DB write path stays single-shot.
- **Non-blocking by contract.** The client helper returns `null` instead of
  throwing; dispatch mutations remain unaware of event-log status.
- **One canonical event-type vocabulary.** `note | reschedule | reassign |
  unassign | quick_add | conflict_acknowledged | system_observation` is
  enforced at API + DB. Client composers map each call site to one of those
  values.
- **Severity is meaningful.** `info` for routine actions, `warning` for
  exact-slot conflict acknowledgements, reserved `critical` for future
  system-observation cases.
- **Timeline is read-only.** Operators may add notes via the existing notes
  API (Phase 2) — this phase deliberately does not introduce a new free-text
  entry surface in the drawer to avoid scope creep.

## TODOs

- Add a "Note" composer button to `<SchedulingEventsCard>` so operators can
  drop a freeform note without leaving the drawer (event type already
  supported by API).
- Surface the same timeline inside the technician profile drawer
  (`components/drawers/technician-drawer.tsx`) so reassign history is
  reviewable per operator.
- Consider promoting `scheduling-events-card` to a shared `lifecycle` slot
  alongside `<ServiceLifecycleTimeline>` once both UIs converge.

## Verification

- Lint: `pnpm lint` (clean).
- Build: `pnpm build` (clean).
- Master context: `pnpm update:master-context` (regenerated).

### Manual test plan

1. Open `/dispatch` on a workspace with assigned technicians and at least
   one scheduled work order.
2. Drag a work order onto a different technician at a slot that already has
   another job → red "Scheduling conflict" toast appears.
3. Open the moved work order's drawer → the **Scheduling activity** card
   shows two new entries: `Reassign` (info) and `Conflict ack` (warning).
4. Drag the same work order to an empty slot adjacent to another job → an
   informational "Tight schedule" toast appears.
5. Open the drawer again → a third entry `Conflict ack` (info, neighbor
   proximity) is logged.
6. Quick-add a work order on a slot with an existing job → the dialog warns
   inline, and after submission the new work order's drawer shows
   `Quick add` + `Conflict ack` entries.
7. Quick-add adjacent (without an exact-slot conflict) → dialog shows the
   neutral "Tight schedule" hint; new work order's drawer shows `Quick add`
   + `Conflict ack` (info).
8. Reload `/dispatch` → the **Sort** dropdown remembers your last choice per
   organization.
9. On mobile/touch, long-press (≈180ms) a card to start a drag and drop on
   another lane.

## Deploy notes

- No environment-variable changes.
- No DB migration changes.
- Safe to roll forward / roll back: dropping the new client helper file
  causes no regressions; the dispatch flows fall back to "no-op" emit.

## Commit / push

```bash
cd equipify-app
pnpm update:master-context
pnpm lint
pnpm build
git add -A
git commit -m "Dispatch + Scheduling Phase 4: scheduling-events timeline + auto-emit + sort persistence + ±1 conflicts"
git push
```
