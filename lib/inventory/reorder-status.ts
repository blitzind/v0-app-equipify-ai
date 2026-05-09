/**
 * Phase 29 — Reorder / restock classification (pure helpers).
 *
 * Maps stock levels + location type to operational statuses without touching
 * persistence or permissions.
 */

import { isLowStock, isOutOfStock, stockTone } from "@/lib/inventory/format"

export type ReorderUiStatus =
  | "ok"
  | "low"
  | "out"
  | "reorder_recommended"
  | "restock_truck_recommended"

export type NormalizedLocationKind = "warehouse" | "staging" | "vehicle" | "other"

export function normalizeInventoryLocationKind(
  locationType: string | null | undefined,
): NormalizedLocationKind {
  const t = (locationType ?? "").toLowerCase()
  if (t === "warehouse") return "warehouse"
  if (t === "staging") return "staging"
  if (t === "vehicle") return "vehicle"
  return "other"
}

export type ReorderClassifyInput = {
  quantity_on_hand: number
  quantity_available: number
  reorder_point: number | null
  location_type: string | null | undefined
}

export type ReorderClassifyResult = {
  tone: "ok" | "low" | "out"
  ui_status: ReorderUiStatus
  /** True when this row should appear in “set reorder point” lists (positive stock, no threshold). */
  needs_threshold: boolean
}

/**
 * Derives UI status for reorder center tables and badges.
 *
 * - Warehouse / staging: low or out (with reorder point configured) → `reorder_recommended`.
 * - Vehicle: out, or at/below reorder point → `restock_truck_recommended`.
 * - Other location types keep neutral low/out labels when applicable.
 */
export function classifyReorderRow(input: ReorderClassifyInput): ReorderClassifyResult {
  const tone = stockTone(input)
  const loc = normalizeInventoryLocationKind(input.location_type)
  const missingRp = input.reorder_point == null

  const atOrBelowRp =
    !missingRp &&
    isLowStock({
      quantity_available: input.quantity_available,
      reorder_point: input.reorder_point,
    })
  const out = isOutOfStock(input)

  let ui_status: ReorderUiStatus = "ok"

  if (loc === "warehouse" || loc === "staging") {
    if (!missingRp && (out || atOrBelowRp)) ui_status = "reorder_recommended"
    else if (out) ui_status = "out"
    else if (atOrBelowRp) ui_status = "low"
    else ui_status = "ok"
  } else if (loc === "vehicle") {
    if (out || (!missingRp && atOrBelowRp)) ui_status = "restock_truck_recommended"
    else if (atOrBelowRp) ui_status = "low"
    else ui_status = "ok"
  } else {
    if (out) ui_status = "out"
    else if (atOrBelowRp) ui_status = "low"
    else ui_status = "ok"
  }

  const needs_threshold =
    missingRp &&
    (loc === "warehouse" || loc === "staging" || loc === "vehicle") &&
    Number(input.quantity_on_hand) > 0

  return { tone, ui_status, needs_threshold }
}

/** Default suggested transfer / PO line quantity when coverage drops below the reorder point. */
export function suggestedReorderLineQuantity(input: {
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
}): number {
  const rp = input.reorder_point
  const avail = Number(input.quantity_available)
  const roq = input.reorder_quantity != null ? Number(input.reorder_quantity) : NaN
  if (Number.isFinite(roq) && roq > 0) return Math.round(roq)
  if (rp != null && Number.isFinite(Number(rp))) {
    const gap = Math.max(0, Number(rp) - avail)
    return Math.max(1, Math.round(gap > 0 ? gap : Number(rp)))
  }
  return 1
}
