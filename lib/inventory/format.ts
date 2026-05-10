/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Pure formatting helpers shared between the inventory dashboard, the
 * work-order parts toolbar, and the technician mobile panel. Keeping these
 * server-and-client safe (no React, no Supabase) means we can reuse them
 * from anywhere — including Server Components — without dragging extra
 * runtime dependencies along.
 *
 * No raw UUIDs are emitted by anything in this module by design.
 */

const TXN_TYPE_LABELS: Record<string, string> = {
  adjustment: "Stock adjustment",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  consume: "Consumed on work order",
  receive: "Received",
  allocate: "Allocated",
  deallocate: "Deallocated",
  reorder_recorded: "Restock / reorder note (no stock change)",
}

/** Friendly label for an inventory transaction type. */
export function formatTransactionType(type: string | null | undefined): string {
  if (!type) return "—"
  return TXN_TYPE_LABELS[type] ?? type.replace(/_/g, " ")
}

/** Compact `Apr 30 · 3:42 PM` formatting that survives older browsers. */
export function formatTransactionTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return "—"
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return "—"
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${date} · ${time}`
}

export type LowStockLike = {
  quantity_available: number
  reorder_point: number | null
}

/** True when the available quantity is at or below the configured reorder point. */
export function isLowStock(row: LowStockLike): boolean {
  if (row.reorder_point == null) return false
  return Number(row.quantity_available) <= Number(row.reorder_point)
}

/** True when on-hand has dropped to zero — used for hard "out of stock" badges. */
export function isOutOfStock(row: { quantity_on_hand: number }): boolean {
  return Number(row.quantity_on_hand) <= 0
}

/** Friendly badge tone for stock levels. */
export function stockTone(
  row: { quantity_on_hand: number; quantity_available: number; reorder_point: number | null },
): "ok" | "low" | "out" {
  if (isOutOfStock(row)) return "out"
  if (isLowStock(row)) return "low"
  return "ok"
}

/** Friendly label for an inventory location type. Falls back to the raw value. */
export function formatLocationType(type: string | null | undefined): string {
  switch (type) {
    case "warehouse":
      return "Warehouse"
    case "vehicle":
      return "Vehicle"
    case "job_site":
      return "Job site"
    case "staging":
      return "Staging"
    case "other":
      return "Other"
    default:
      return type ?? "—"
  }
}

export type WorkOrderTxnLike = {
  transaction_type: string
  quantity: number
  delta_on_hand: number
  delta_allocated: number
  catalog_item_id: string
  location_id: string
}

/**
 * Roll up `inventory_transactions` rows for a single work order into a
 * compact `{ allocated, consumed }` summary keyed by catalog item + location.
 *
 * `quantity_allocated` deltas are summed for `allocate` / `deallocate`, while
 * `consume` contributes both to consumed totals and decreases the open
 * allocation. This mirrors the math `inventory-mutations.ts` performs at
 * write-time, but avoids round-tripping the DB.
 */
export function summarizeWorkOrderUsage(rows: WorkOrderTxnLike[]) {
  const byKey = new Map<
    string,
    { catalog_item_id: string; location_id: string; allocated: number; consumed: number }
  >()
  for (const r of rows) {
    const key = `${r.catalog_item_id}::${r.location_id}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = { catalog_item_id: r.catalog_item_id, location_id: r.location_id, allocated: 0, consumed: 0 }
      byKey.set(key, entry)
    }
    if (r.transaction_type === "allocate") entry.allocated += Math.abs(Number(r.delta_allocated) || 0)
    if (r.transaction_type === "deallocate") entry.allocated -= Math.abs(Number(r.delta_allocated) || 0)
    if (r.transaction_type === "consume") {
      entry.consumed += Math.abs(Number(r.delta_on_hand) || Number(r.quantity) || 0)
      // Consumption releases allocation up to the consumed amount; we mirror
      // that here so a fully consumed allocation shows `allocated: 0`.
      entry.allocated -= Math.abs(Number(r.delta_allocated) || 0)
    }
  }
  return Array.from(byKey.values()).map((e) => ({
    ...e,
    // `allocated` should never read negative even if the ledger has odd ordering.
    allocated: Math.max(0, e.allocated),
  }))
}
