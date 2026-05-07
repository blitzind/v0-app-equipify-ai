"use client"

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Compact KPI tile row for the inventory overview tab. Uses data already
 * loaded by the parent page (low-stock list, transactions ledger, locations,
 * vehicle assignments) so this is a pure presentational component — no new
 * fetches, no new state, no new mutation paths.
 */

import { Boxes, History, Package, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

export type InventoryOverviewKpisProps = {
  /** Number of stock rows currently at or below their reorder point. */
  lowStockCount: number
  /** Number of vehicle locations, regardless of whether stock is loaded. */
  vehicleCount: number
  /** How many vehicles currently carry at least one low-stock SKU. */
  vehiclesLowStock: number
  /** Total recent ledger events (consume / receive / etc.) currently loaded. */
  recentTxnCount: number
  /** Optional: how many of the recent rows are "consume" — used as a sub-stat. */
  recentConsumedCount?: number
  /**
   * Number of stock rows that have a configured reorder point AND are
   * currently below it (i.e. should already be reordered). Distinct from
   * `lowStockCount` only when the reorder threshold === current available.
   */
  reorderNeededCount: number
}

export function InventoryOverviewKpis({
  lowStockCount,
  vehicleCount,
  vehiclesLowStock,
  recentTxnCount,
  recentConsumedCount,
  reorderNeededCount,
}: InventoryOverviewKpisProps) {
  const tiles: Array<{
    key: string
    label: string
    value: number
    sub: string
    icon: typeof Package
    accent: string
    bg: string
  }> = [
    {
      key: "low-stock",
      label: "Low stock SKUs",
      value: lowStockCount,
      sub: lowStockCount === 0 ? "All thresholds healthy" : "At or below reorder point",
      icon: Package,
      accent: lowStockCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      bg: lowStockCount > 0 ? "bg-amber-500/10" : "bg-muted/40",
    },
    {
      key: "vehicles",
      label: "Vehicles tracked",
      value: vehicleCount,
      sub:
        vehicleCount === 0
          ? "No vehicle locations yet"
          : vehiclesLowStock > 0
            ? `${vehiclesLowStock} need restock`
            : "Vehicle stock healthy",
      icon: Truck,
      accent:
        vehiclesLowStock > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-emerald-700 dark:text-emerald-300",
      bg: vehiclesLowStock > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      key: "reorder",
      label: "Need reorder",
      value: reorderNeededCount,
      sub: reorderNeededCount === 0 ? "Up to date" : "Awaiting purchase order",
      icon: Boxes,
      accent:
        reorderNeededCount > 0
          ? "text-rose-700 dark:text-rose-300"
          : "text-muted-foreground",
      bg: reorderNeededCount > 0 ? "bg-rose-500/10" : "bg-muted/40",
    },
    {
      key: "recent",
      label: "Recent activity",
      value: recentTxnCount,
      sub:
        typeof recentConsumedCount === "number" && recentConsumedCount > 0
          ? `${recentConsumedCount} consumed`
          : "Last 200 ledger events",
      icon: History,
      accent: "text-foreground",
      bg: "bg-muted/40",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
      {tiles.map(({ key, label, value, sub, icon: Icon, accent, bg }) => (
        <div
          key={key}
          className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2 justify-between shadow-[0_1px_3px_rgba(0,0,0,0.06)] h-full"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("w-3.5 h-3.5", accent)} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{value}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{sub}</p>
        </div>
      ))}
    </div>
  )
}
