"use client"

/**
 * Phase 28 — compact truck / van stock snapshot inside the technician drawer.
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DRAWER_NESTED_CARD } from "@/components/detail-drawer"
import { stockTone } from "@/lib/inventory/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type StockLine = {
  id: string
  item_name: string | null
  part_number: string | null
  quantity_on_hand: number
  quantity_available: number
  reorder_point: number | null
}

export function TechnicianDrawerTruckStock({
  organizationId,
  profileUserId,
  className,
}: {
  organizationId: string
  profileUserId: string | null
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [locName, setLocName] = useState<string | null>(null)
  const [stock, setStock] = useState<StockLine[]>([])

  const load = useCallback(async () => {
    if (!organizationId || !profileUserId) {
      setStock([])
      setLocName(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/inventory/technician-truck-stock?for_user_id=${encodeURIComponent(profileUserId)}`,
        { cache: "no-store" },
      )
      const body = (await res.json().catch(() => ({}))) as {
        location_name?: string | null
        stock?: StockLine[]
      }
      if (!res.ok) {
        setStock([])
        setLocName(null)
        return
      }
      setLocName(body.location_name ?? null)
      setStock(body.stock ?? [])
    } finally {
      setLoading(false)
    }
  }, [organizationId, profileUserId])

  useEffect(() => {
    void load()
  }, [load])

  if (!profileUserId) return null

  return (
    <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Truck stock</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading inventory…
        </div>
      ) : !locName ? (
        <p className="text-sm text-muted-foreground">
          No vehicle inventory bin is assigned to this technician yet. Managers can link a van location under{" "}
          <span className="font-medium text-foreground">Inventory → Van inventory</span>.
        </p>
      ) : stock.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Van bin <span className="font-medium text-foreground">{locName}</span> has no SKU rows yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Part</TableHead>
                <TableHead className="text-right text-xs">Avail</TableHead>
                <TableHead className="text-right text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.slice(0, 12).map((row) => {
                const tone = stockTone({
                  quantity_on_hand: row.quantity_on_hand,
                  quantity_available: row.quantity_available,
                  reorder_point: row.reorder_point,
                })
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">
                      <span className="font-medium line-clamp-2">{row.item_name ?? row.part_number ?? "—"}</span>
                      {row.part_number ? (
                        <span className="block text-[10px] text-muted-foreground font-mono">{row.part_number}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{row.quantity_available}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          tone === "out" && "border-rose-500/50 text-rose-700 dark:text-rose-300",
                          tone === "low" && "border-amber-500/50 text-amber-700 dark:text-amber-300",
                          tone === "ok" && "border-emerald-500/40 text-emerald-800 dark:text-emerald-200",
                        )}
                      >
                        {tone === "out" ? "Out" : tone === "low" ? "Low" : "OK"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {stock.length > 12 ? (
            <p className="text-[10px] text-muted-foreground mt-2">
              Showing 12 of {stock.length} SKUs — open Inventory for the full list.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
