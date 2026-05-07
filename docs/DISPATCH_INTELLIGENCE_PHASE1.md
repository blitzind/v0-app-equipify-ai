# Dispatch operational intelligence — Phase 1

## Summary

Phase 1 adds an **operational status layer** on the dispatch board and mobile list without replacing scheduling: batch enrichment from `work_orders`, `work_order_equipment`, `equipment`, and `calibration_records`, a shared **`deriveOperationalBadges`** ruleset, **toolbar filters** (billing, cert/PM, aging, warranty), **sort** (by time vs priority), **technician day workload counts**, **slot overlap warnings**, and the same signals plus **`ServiceLifecycleTimeline`** in the **work order drawer**. **`billing_state`** is included in work order list/detail selects and mapped on `WorkOrder` as **`billingState`**.

## Migrations

No new migration in this phase. Uses existing columns:

- `work_orders.billing_state` (Phase 1 lifecycle migration)
- `equipment.next_due_at`, `equipment.next_calibration_due_at` (equipment intelligence migration)

## Affected files (primary)

| Area | Path |
|------|------|
| Badge rules | `lib/dispatch/operational-badges.ts` |
| Batch enrichment + filter/sort helpers | `lib/dispatch/build-dispatch-wos.ts` |
| WO selects | `lib/work-orders/supabase-select.ts` |
| Detail mapping + equipment dates on assets | `lib/work-orders/detail-load.ts` |
| Work order type | `lib/mock-data.ts` |
| Dispatch page load + filters | `app/(dashboard)/dispatch/page.tsx` |
| Board / drag grid | `components/dispatch/dispatch-board.tsx` |
| Mobile list | `components/dispatch/dispatch-mobile-list.tsx` |
| Badge UI | `components/dispatch/operational-badge-row.tsx` |
| Drawer signals + timeline | `components/drawers/work-order-drawer.tsx` |

## TODOs (later phases)

1. **Invoice overdue / paid at a glance** — needs batched `org_invoices` (due dates, status) for dispatch IDs without N+1.
2. **Communications indicators** — surface appointment/invoice comms state using existing communications APIs.
3. **Parent / enterprise customer badges** — requires a stable parent-account model in schema + customer load on dispatch.
4. **Multi-asset PM/cal aggregation** — enrichment already walks `work_order_equipment`; extend rules if PM plans attach to secondary assets differently.
5. **Service schedule week/month** — align filters with `/service-schedule` using the same badge helpers (this phase focused on `/dispatch`).
6. **AI / route optimization** — keep enrich payloads stable; add recommendation fields behind feature flags when ready.

## Build

`npm run build` (passes).
