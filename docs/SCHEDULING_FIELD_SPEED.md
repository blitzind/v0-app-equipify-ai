# Scheduling + Dispatch Field-Speed Polish

> Phase: Scheduling Field-Speed Polish
>
> Goal: shave taps and decisions out of the most common in-vehicle
> dispatch flow — *"a customer just called, schedule a tech, send a
> confirmation, get back on the road"* — without rewriting any of the
> dispatch board, service schedule, work order drawer, or maintenance
> systems that ship today.
>
> All changes are additive. No new database fields. RLS, capability
> gates, and `organization_id` patterns are preserved verbatim.

## Highlights

1. **Faster mobile-friendly appointment creation** in
   `quick-appointment-dialog`:
   - First-equipment auto-pick when a customer has a single asset.
   - Confirmation email recipient prefilled from `customers.billing_email`
     when present (schema-drift safe — falls back to the legacy column
     set if `billing_email` is missing).
   - Bigger sticky footer (≥44 px buttons) tuned for in-vehicle taps.
   - "Save & send" primary action that creates the work order and
     dispatches the customer confirmation email in one tap.

2. **Customer confirmation email** reuses the existing
   `/api/email/work-order-summary` route via a new opt-in
   `variant: "appointment_confirmation"` parameter. No second email
   pipeline; the route still requires `canEditWorkOrders` *or*
   `canManageDispatch`.

3. **Wired `ScheduleServiceDrawer.sendConfirmation` toggle** — the
   toggle has shipped for a while but was previously a UI placeholder.
   It now drives a fire-and-forget POST to the same email route after
   the work order insert succeeds. Recipient prefills from
   `customers.billing_email` and the dispatcher can edit it before
   submitting.

4. **Dispatch / mobile polish**:
   - `DispatchMobileList` empty states swapped from a one-liner to a
     framed card with a clear "Quick add appointment" CTA.
   - Per-card quick action row on mobile: **Schedule similar** and
     **Assign**, both ≥36 px tall.
   - `UnassignedJobsQueue` empty state now uses the same framed-CTA
     pattern with an optional `onQuickAdd` prop. The `DispatchDrawer`
     passes the existing `setScheduleJobOpen` flow so the empty state
     becomes actionable instead of decorative.

5. **Portal continuity**:
   - `/api/portal/work-orders` now surfaces `scheduledTime` (HH:MM)
     in addition to `scheduledOn`.
   - `/portal/work-orders` displays the start time underneath the
     scheduled date so customers see *when* a visit is booked, not
     just *which day*. No new portal data is exposed beyond what the
     work order already carried.

## Architectural decisions

- **No new email infrastructure.** The appointment-confirmation
  template piggybacks on `wrapEquipifyEmail` and ships through the same
  `/api/email/work-order-summary` route, capability gate, communication
  log, and Resend provider as the post-completion summary. Only the
  body and the `eventType` differ
  (`appointment_confirmation_email` vs. `work_order_summary_email`).

- **Non-blocking confirmation send.** Both the
  `QuickAppointmentDialog` and `ScheduleServiceDrawer` flows treat the
  email as fire-and-forget. The work order is the primary artifact;
  email failure surfaces in the audit/communication log but never
  blocks the dispatcher's "scheduled" UI state.

- **No new database fields.** Confirmation status is derivable from
  the existing `communication_events` log (filter by
  `event_type = 'appointment_confirmation_email'` and
  `related_entity_id = <wo.id>`), so we deliberately avoided adding a
  `customer_confirmation_sent_at` column. A future surface that wants
  a badge in the work order drawer can join against
  `communication_events` rather than mutating `work_orders`.

- **Schema-drift safety.** All new server-side reads
  (`scheduled_time`, `customers.billing_email`) use a try/fallback
  pattern so an org without the column gracefully degrades to the
  legacy projection.

- **Permission gates preserved.** The new variant inherits the
  `canEditWorkOrders ∨ canManageDispatch` gate from the existing
  email route. Viewers stay read-only on both the UI (existing
  `<PermissionGate>` wrappers) and the API.

## Files changed

### Email infrastructure
- `lib/email/templates.ts` — new `buildAppointmentConfirmationEmailContent` template + `AppointmentConfirmationEmailArgs` type. Reuses `wrapEquipifyEmail` and `escapeHtml` from the existing module.
- `app/api/email/work-order-summary/route.ts` — accepts optional `variant: "summary" | "appointment_confirmation"`; loads `scheduled_on`, `scheduled_time`, `assigned_user_id`; switches body + `eventType` accordingly. Default behavior (`"summary"`) is unchanged.

### Dispatch + scheduling UI
- `components/dispatch/quick-appointment-dialog.tsx`:
  - Customer query now also pulls `billing_email` (with fallback).
  - Auto-selects single equipment option.
  - Adds `sendConfirmation` toggle + recipient input.
  - Sticky footer with ≥44 px tap targets and a "Save & send" primary action.
- `components/dispatch/dispatch-mobile-list.tsx`:
  - Framed empty states with explicit Quick Add CTAs.
  - Per-card quick action row (`Schedule similar`, `Assign`) on mobile.
- `components/dispatch/unassigned-jobs-queue.tsx`:
  - Optional `onQuickAdd` prop for the empty state.
  - Framed empty state with `Inbox` icon + Quick Add button.
- `components/drawers/dispatch-drawer.tsx` — wires `onQuickAdd` so the queue empty state becomes actionable.
- `components/schedule-service-drawer.tsx`:
  - Adds `confirmationEmail` to `FormState` (in-memory only; no DB columns).
  - Prefills from `customers.billing_email` on customer change.
  - On submit, fire-and-forget call to `/api/email/work-order-summary` with `variant: "appointment_confirmation"` when the toggle is on.
  - Inline recipient editor inside the existing options block.

### Portal
- `app/api/portal/work-orders/route.ts` — also returns `scheduledTime` (HH:MM truncated).
- `app/(portal)/portal/work-orders/page.tsx` — displays the start time beneath the scheduled date.

## Migrations

None.

## Verification

- `pnpm update:master-context` — run after the API/route-level changes
  so `lib/admin/master-context.generated.ts` reflects the new email
  variant + portal payload.
- `pnpm build` — green.

## TODOs / follow-ups

- Optional polish: surface the latest
  `appointment_confirmation_email` event in the work order drawer as
  a small "Confirmation sent &lt;date&gt;" pill (data already in
  `communication_events`; requires only a read query).
- Optional polish: add an inline "Resend confirmation" action to the
  work order drawer for scheduled WOs, reusing the same route.
- Reminder cadence (`sendReminder` toggle) is still UI-only; wiring
  it to a scheduled job belongs in a separate phase that owns
  background workers.

## Deploy notes

- No DB migrations.
- No env changes.
- Behavior is fully backward compatible:
  - Old callers of `/api/email/work-order-summary` continue to send
    the post-completion summary (default `variant: "summary"`).
  - Portal clients caching the previous response shape simply ignore
    the new `scheduledTime` field.
