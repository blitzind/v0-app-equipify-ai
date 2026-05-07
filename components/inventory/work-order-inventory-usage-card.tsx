"use client"

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Read-only "what's been allocated vs consumed" rollup for a single work
 * order. Surfaces inside the parts tab toolbar so technicians and dispatch
 * can see the inventory side of a job without leaving the work order.
 *
 * Data flow:
 *   GET /api/organizations/{org}/inventory/transactions?work_order_id={wo}
 *   ↓
 *   summarizeWorkOrderUsage(rows)  // pure helper in lib/inventory/format
 *   ↓
 *   read-only chips per (catalog_item × location)
 *
 * No mutations — that path stays on the existing allocate / consume routes.
 */

import { useEffect, useState } from "react"
import { Boxes, Loader2, MapPin } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { summarizeWorkOrderUsage } from "@/lib/inventory/format"

type RawTxn = {
  id: string
  transaction_type: string
  quantity: number
  delta_on_hand: number
  delta_allocated: number
  catalog_item_id: string
  location_id: string
}

type CatalogLookup = { id: string; name: string; part_number: string | null }
type LocationLookup = { id: string; name: string; location_type: string | null }

export type WorkOrderInventoryUsageCardProps = {
  organizationId: string
  workOrderId: string
  /** Optional CSS class to merge into the wrapper. */
  className?: string
}

export function WorkOrderInventoryUsageCard({
  organizationId,
  workOrderId,
  className,
}: WorkOrderInventoryUsageCardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RawTxn[]>([])
  const [parts, setParts] = useState<Record<string, CatalogLookup>>({})
  const [locations, setLocations] = useState<Record<string, LocationLookup>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!organizationId || !workOrderId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const url = `/api/organizations/${encodeURIComponent(organizationId)}/inventory/transactions?work_order_id=${encodeURIComponent(workOrderId)}&limit=100`
        const res = await fetch(url, { cache: "no-store" })
        const j = (await res.json().catch(() => ({}))) as { transactions?: RawTxn[]; message?: string }
        if (!res.ok) throw new Error(j.message ?? "Could not load inventory usage.")
        if (cancelled) return
        const list = j.transactions ?? []
        setRows(list)

        // Resolve labels via Supabase RLS — same client/components pattern the
        // rest of the dashboard uses. We restrict to the IDs we actually need.
        const catIds = Array.from(new Set(list.map((r) => r.catalog_item_id).filter(Boolean)))
        const locIds = Array.from(new Set(list.map((r) => r.location_id).filter(Boolean)))
        const supabase = createBrowserSupabaseClient()
        const [{ data: catRows }, { data: locRows }] = await Promise.all([
          catIds.length > 0
            ? supabase
                .from("catalog_items")
                .select("id, name, part_number")
                .eq("organization_id", organizationId)
                .in("id", catIds)
            : Promise.resolve({ data: [] as CatalogLookup[] }),
          locIds.length > 0
            ? supabase
                .from("inventory_locations")
                .select("id, name, location_type")
                .eq("organization_id", organizationId)
                .in("id", locIds)
            : Promise.resolve({ data: [] as LocationLookup[] }),
        ])

        if (cancelled) return

        const catMap: Record<string, CatalogLookup> = {}
        for (const c of (catRows ?? []) as CatalogLookup[]) catMap[c.id] = c
        const locMap: Record<string, LocationLookup> = {}
        for (const l of (locRows ?? []) as LocationLookup[]) locMap[l.id] = l
        setParts(catMap)
        setLocations(locMap)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load inventory usage.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, workOrderId])

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading inventory usage…
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300",
          className,
        )}
      >
        {error}
      </div>
    )
  }

  const summary = summarizeWorkOrderUsage(rows)
  if (summary.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground",
          className,
        )}
      >
        No inventory transactions yet for this work order. Allocate or consume parts from the
        Inventory page to track usage here.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/60 px-3 py-2.5 space-y-1.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
        Inventory usage
        <span className="text-[11px] font-normal text-muted-foreground">
          allocated vs consumed
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {summary.map((entry) => {
          const part = parts[entry.catalog_item_id]
          const loc = locations[entry.location_id]
          return (
            <li
              key={`${entry.catalog_item_id}-${entry.location_id}`}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {part?.name ?? "Catalog item"}
                  {part?.part_number ? (
                    <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                      {part.part_number}
                    </span>
                  ) : null}
                </p>
                {loc ? (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />
                    {loc.name}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-700 dark:text-blue-300 tabular-nums">
                  {entry.allocated} allocated
                </span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {entry.consumed} consumed
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
