"use client"

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Compact "what just changed in inventory" card. Renders the most recent N
 * ledger events with friendly labels, signed deltas, and human references
 * (work order display number / "Purchase order") so managers can scan the
 * day's inventory activity without scrolling the full ledger.
 */

import { History } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatLocationType,
  formatTransactionTimestamp,
  formatTransactionType,
} from "@/lib/inventory/format"

type Txn = {
  id: string
  transaction_type: string
  quantity: number
  delta_on_hand: number
  delta_allocated: number
  catalog_item_id: string
  location_id: string
  work_order_id: string | null
  purchase_order_id: string | null
  created_at: string
}

type CatalogPart = { id: string; name: string }
type LocationRow = { id: string; name: string; location_type: string }
type WorkOrderOpt = { id: string; display: string }

export type InventoryRecentActivityCardProps = {
  transactions: Txn[]
  catalogParts: CatalogPart[]
  locations: LocationRow[]
  workOrders: WorkOrderOpt[]
  /** Maximum number of rows to display. Defaults to 8. */
  limit?: number
  className?: string
}

export function InventoryRecentActivityCard({
  transactions,
  catalogParts,
  locations,
  workOrders,
  limit = 8,
  className,
}: InventoryRecentActivityCardProps) {
  const partMap = new Map(catalogParts.map((c) => [c.id, c.name]))
  const locMap = new Map(locations.map((l) => [l.id, l]))
  const woMap = new Map(workOrders.map((w) => [w.id, w.display]))

  const visible = transactions.slice(0, limit)

  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4" /> Recent activity
        </CardTitle>
        <CardDescription className="text-xs">
          Latest stock movements across the workspace. See <strong>Consumption &amp; history</strong>{" "}
          for the full ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {visible.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground space-y-2 px-2">
            <p className="font-medium text-foreground">No recent movements</p>
            <p className="text-xs leading-relaxed max-w-sm mx-auto">
              After you <strong className="text-foreground">receive</strong>, <strong className="text-foreground">transfer</strong>,{" "}
              <strong className="text-foreground">adjust</strong>, or <strong className="text-foreground">consume</strong> stock, the latest
              lines will show here. Open <strong className="text-foreground">Consume parts &amp; history</strong> for the full ledger.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) => {
              const partName = partMap.get(t.catalog_item_id) ?? "Catalog item"
              const loc = locMap.get(t.location_id)
              const woRef = t.work_order_id ? woMap.get(t.work_order_id) ?? "Work order" : null
              const poRef = t.purchase_order_id ? "Purchase order" : null
              const onHandDelta = Number(t.delta_on_hand || 0)
              const tone =
                onHandDelta > 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : onHandDelta < 0
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-muted-foreground"
              return (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{partName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTransactionType(t.transaction_type)}
                      {loc ? (
                        <>
                          {" · "}
                          <span>
                            {loc.name}{" "}
                            <span className="text-muted-foreground/70">
                              ({formatLocationType(loc.location_type)})
                            </span>
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      {formatTransactionTimestamp(t.created_at)}
                      {woRef ? <span> · {woRef}</span> : null}
                      {poRef ? <span> · {poRef}</span> : null}
                    </p>
                  </div>
                  <div className={cn("text-right tabular-nums shrink-0", tone)}>
                    <span className="text-sm font-semibold">
                      {onHandDelta > 0 ? "+" : ""}
                      {onHandDelta}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">on hand</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
