# Inventory + Parts Operational Polish — Phase 1

Practical operational polish for the existing inventory + parts system.
Strictly additive: no rewrite of stock, ledger, vehicle assignment, transfer,
receive, allocate/deallocate, consume, threshold, reorder, work order parts,
or permissions.

## Goals

1. Improve the inventory **overview** so managers can see what needs
   attention before scrolling tables.
2. Make **vehicle stock** scan-friendly with technician context and low-stock
   highlighting per vehicle.
3. Surface **allocated vs consumed** parts on a work order without leaving
   the work order drawer.
4. Tighten **transfer / receive / adjust** copy and gate destructive actions
   behind a confirmation.
5. Provide a **technician-friendly mobile inventory panel** so field techs
   can consume parts and request restocks from the Today page.

## Files changed

### New files

- `lib/inventory/format.ts`
  - Pure helpers shared between dashboard, drawer, and mobile card.
  - `formatTransactionType`, `formatTransactionTimestamp`, `formatLocationType`
  - `isLowStock`, `isOutOfStock`, `stockTone`
  - `summarizeWorkOrderUsage(rows)` — rolls up an `inventory_transactions`
    list for a single work order into `{ allocated, consumed }` keyed by
    `(catalog_item_id, location_id)`.
- `components/inventory/inventory-overview-kpis.tsx`
  - 4-tile compact KPI row (low stock, vehicles, reorder needed, recent
    activity).
- `components/inventory/inventory-vehicle-stock-summary.tsx`
  - Per-vehicle summary card with technician context, SKU count, on-hand,
    and low-stock count. Sorted "needs restock first".
- `components/inventory/inventory-recent-activity-card.tsx`
  - Last N ledger events with friendly type labels and signed deltas.
- `components/inventory/work-order-inventory-usage-card.tsx`
  - Read-only "allocated vs consumed" rollup for the parts tab toolbar.
  - Calls `GET /api/organizations/{org}/inventory/transactions?work_order_id=…`.
- `components/inventory/technician-inventory-mobile-card.tsx`
  - Technician's assigned vehicle bin, with **Use** and **Restock** actions
    per row. Resolves the bin via
    `organization_members → membership_id → technicians → technician_vehicle_stock`.
  - **Use** posts to `/inventory/consume` for the active work order.
  - **Restock** posts to `/inventory/restock-request` (new route, see below).
- `app/api/organizations/[organizationId]/inventory/restock-request/route.ts`
  - New POST route. Adds a `reorder_recorded` ledger event with
    `metadata.restock_request = true`. Zero stock delta — pure signal for
    dispatch to act on.
  - Permission: `canConsumePartsOnWorkOrders` (owner/admin/manager/tech).

### Modified files

- `app/(dashboard)/inventory/page.tsx`
  - New imports: KPI / vehicle / activity components, `useOrgPermissions`,
    `RestrictedNotice`, AlertDialog primitives, `Badge`.
  - Adds `canAdjust` (`canAdjustInventoryStock`) and `canConsumeOnWorkOrder`
    (`canConsumePartsOnWorkOrders`) derived from the central permission map
    on top of the existing `canManage` membership check.
  - Overview tab now renders, in order:
    1. KPI tile row (low stock / vehicles / reorder needed / recent
       activity).
    2. Restricted notice for non-managers (replaces a blank section).
    3. Vehicle stock summary card.
    4. Existing low-stock alerts card.
    5. On-hand-by-location table — now with vehicle/tech badge chips and a
       "Low" badge on each row.
    6. Recent activity card (top 8 events).
    7. Existing reorder thresholds form.
  - Stock decrease ("Adjust on-hand → Decrease") now requires a confirmation
    `<AlertDialog>` before posting; increases apply immediately.
  - Adjust button uses `canAdjust`; transfer / receive / threshold use the
    existing `canManage`; consume picker uses `canConsumeOnWorkOrder` so
    techs can record consumption from the desktop too.
  - Transfer card: clearer "Source location" / "Destination location"
    labels, location type appended in dropdowns, and `xfFrom` filtered out
    of the destination list to prevent same-location moves.
- `components/drawers/work-order-drawer.tsx`
  - Imports `WorkOrderInventoryUsageCard`.
  - `partsTabToolbar` now wraps the existing unsaved-changes banner in a
    flex column and renders the usage card beneath it (visible whenever an
    organization is loaded — no permission gate, it's read-only).
- `app/(dashboard)/technicians/today/page.tsx`
  - Imports `TechnicianInventoryMobileCard` and `getWorkOrderDisplay`.
  - Renders the mobile inventory card beneath the Today/Open lists; passes
    the first scheduled (or first open) work order as `activeWorkOrder` so
    the **Use** button posts consumption against that job.

### API additive enhancements

- `app/api/organizations/[organizationId]/inventory/transactions/route.ts`
  - Added optional `work_order_id`, `location_id`, and `catalog_item_id`
    query parameters. UUID-validated; ignored when missing/invalid. Read-only.
- `app/api/organizations/[organizationId]/inventory/consume/route.ts`
  - Capability override changed from default (`canManageInventory`) to
    `canConsumePartsOnWorkOrders`. The capability map already grants this
    to owner/admin/manager/tech, so manager workflow is unchanged while
    technicians gain the field-team consume action that the central
    permission map already promised.
- `app/api/organizations/[organizationId]/inventory/restock-request/route.ts`
  *(new)* — see above.

## Migrations

**None.** This phase is purely additive at the application layer. Every new
feature reuses existing tables and columns:
- `inventory_locations`, `inventory_stock`, `inventory_transactions`
- `technician_vehicle_stock`, `organization_members.membership_id`,
  `technicians.membership_id`
- `work_order_line_items.catalog_item_id`

A future phase that wants to add `restock_request_status` (queued / ordered /
received) should ship as a separate idempotent migration with a nullable
default.

## Architectural decisions

- **No new tables.** Restock requests reuse `inventory_transactions` with a
  `metadata.restock_request = true` flag so reporting can scan one ledger
  for any stock signal. Quantities deliberately default to zero so it never
  affects on-hand or allocated counts.
- **Permission alignment.** The central permission map already grants
  `canConsumePartsOnWorkOrders` to techs; the consume route now honours
  that. Manager-only inventory writes (receive, transfer, thresholds, van
  assignment, adjust) keep their existing capability gates.
- **Service-role client preserved.** Both consume and restock-request
  routes still flow through `requireOrgInventoryWrite` so RLS-bypass write
  patterns are unchanged.
- **Read-only WO usage card.** Allocated/consumed visualization reads from
  `inventory_transactions` only — there is no second source of truth and no
  duplicate state. Existing allocate/deallocate/consume routes remain the
  only mutation paths.
- **No raw UUIDs in UI.** All new components label vehicles, locations, and
  work orders by their human display fields; the consumption picker on the
  inventory page already uses the shared `getWorkOrderDisplay` helper.

## Permissions summary

| Surface                                            | Capability                          |
| -------------------------------------------------- | ----------------------------------- |
| Inventory page — view stock / KPIs / activity      | Member of org (existing)            |
| Receive / Transfer / Thresholds / Van assignment   | `canManageInventory` (existing)     |
| Adjust on-hand                                     | `canAdjustInventoryStock` (existing) |
| Consume on work order (desktop & mobile)           | `canConsumePartsOnWorkOrders`        |
| Request restock (mobile tech card)                 | `canConsumePartsOnWorkOrders`        |
| Work order parts usage rollup (read-only)          | Member of org (existing)            |

## TODOs

- **Restock request lifecycle.** The current implementation only records the
  request. A future Phase 2 should add a `restock_request_status` column or
  derive state from companion `reorder_recorded` events.
- **Searchable work order picker.** `inventory/page.tsx` still uses a
  Select bounded at 150 most-recent active work orders. Swap for a shared
  `<WorkOrderPicker>` combobox when org volume warrants it (existing TODO,
  preserved).
- **Vehicle telemetry.** Vehicle stock summary currently uses
  `technician_vehicle_stock` for tech assignment. Adding GPS / route
  context would require a new table and is intentionally out of scope.
- **Bulk transfer UX.** Single-line transfers are sufficient for Phase 1;
  bulk transfer (multiple SKUs, one destination) is a Phase 2 candidate.
- **Allocate from work order drawer.** The usage card is read-only by
  design. Adding allocate/deallocate buttons in the drawer would be the
  natural next step but requires the searchable location picker first.

## Verification

- `pnpm update:master-context` — run after API route additions.
- `pnpm build` — must pass.
- Manual:
  - Inventory overview shows KPI tiles, vehicle summary, and recent activity
    cards even with empty data.
  - Decrease adjustment opens the confirmation `AlertDialog`.
  - Non-manager (tech) sees `RestrictedNotice` on Overview tab.
  - Tech opens Today page and sees their van bin with Use / Restock buttons.
  - Work order drawer Parts tab shows the usage rollup beneath the unsaved
    changes banner (or alone when there are no unsaved changes).
- Local dev: use `http://localhost:3001` (per workspace convention).

## Deploy notes

No migrations or env changes. Deployable as a standard Next.js build. The
new API routes (`restock-request`, broadened `consume`) are additive and
can roll out before any UI consumers if desired.
