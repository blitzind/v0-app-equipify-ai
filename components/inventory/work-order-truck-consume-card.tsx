"use client"

/**
 * Phase 28 — consume catalog parts from the signed-in technician's van bin onto this work order.
 * Does not alter repair-log line items; ledger stays on inventory_transactions (consume).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Truck } from "lucide-react"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

type StockOpt = {
  catalog_item_id: string
  item_name: string | null
  part_number: string | null
  quantity_available: number
}

export function WorkOrderTruckConsumeCard({
  organizationId,
  workOrderId,
}: {
  organizationId: string
  workOrderId: string
}) {
  const { toast } = useToast()
  const { permissions } = useOrgPermissions()
  const canConsume = Boolean(permissions.canConsumePartsOnWorkOrders)
  const mayManageInventory = Boolean(permissions.canManageInventory)

  const baseUrl = `/api/organizations/${encodeURIComponent(organizationId)}`

  const [loadingLoc, setLoadingLoc] = useState(true)
  const [truckLocId, setTruckLocId] = useState<string | null>(null)
  const [truckLabel, setTruckLabel] = useState<string | null>(null)

  const [stockOpts, setStockOpts] = useState<StockOpt[]>([])
  const [loadingStock, setLoadingStock] = useState(false)

  const [catalogId, setCatalogId] = useState("")
  const [qty, setQty] = useState("1")
  const [busy, setBusy] = useState(false)

  const loadTruck = useCallback(async () => {
    if (!organizationId) return
    setLoadingLoc(true)
    try {
      const res = await fetch(`${baseUrl}/inventory/my-vehicle-location`, { cache: "no-store" })
      const body = (await res.json().catch(() => ({}))) as {
        inventory_location_id?: string | null
        location_name?: string | null
      }
      const lid = body.inventory_location_id ?? null
      setTruckLocId(lid)
      setTruckLabel(body.location_name ?? null)
    } finally {
      setLoadingLoc(false)
    }
  }, [baseUrl, organizationId])

  const loadStock = useCallback(async () => {
    if (!truckLocId || !organizationId) {
      setStockOpts([])
      return
    }
    setLoadingStock(true)
    try {
      const res = await fetch(
        `${baseUrl}/inventory/stock?location_id=${encodeURIComponent(truckLocId)}`,
        { cache: "no-store" },
      )
      const body = (await res.json().catch(() => ({}))) as {
        stock?: Array<{
          catalog_item_id: string
          item_name: string | null
          part_number: string | null
          quantity_available: number
        }>
      }
      const rows = (body.stock ?? []).filter((r) => Number(r.quantity_available) > 0)
      setStockOpts(
        rows.map((r) => ({
          catalog_item_id: r.catalog_item_id,
          item_name: r.item_name,
          part_number: r.part_number,
          quantity_available: Number(r.quantity_available),
        })),
      )
      setCatalogId((prev) => {
        if (prev && rows.some((r) => r.catalog_item_id === prev)) return prev
        return rows[0]?.catalog_item_id ?? ""
      })
    } finally {
      setLoadingStock(false)
    }
  }, [baseUrl, organizationId, truckLocId])

  useEffect(() => {
    void loadTruck()
  }, [loadTruck])

  useEffect(() => {
    void loadStock()
  }, [loadStock])

  const selected = useMemo(
    () => stockOpts.find((s) => s.catalog_item_id === catalogId),
    [stockOpts, catalogId],
  )

  if (!canConsume) return null

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Truck stock consumption
        </CardTitle>
        <CardDescription className="text-xs">
          Records inventory usage against this work order from {mayManageInventory ? "a location you select on the Inventory page" : "your assigned van bin"}. Repair log line items stay independent — add parts there for customer-facing totals if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingLoc ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Resolving your vehicle bin…
          </div>
        ) : !truckLocId ? (
          <p className="text-sm text-muted-foreground">
            No van stock bin is assigned to your technician profile. Ask a manager to link one under{" "}
            <span className="font-medium text-foreground">Inventory → Van inventory</span>.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Source: <span className="font-medium text-foreground">{truckLabel ?? "Vehicle bin"}</span>
            </p>
            {loadingStock ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading van stock…
              </div>
            ) : stockOpts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available quantity on your truck for stocked catalog SKUs.</p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="space-y-1.5 min-w-0 sm:min-w-[14rem] flex-1">
                  <Label className="text-xs">Catalog part</Label>
                  <Select value={catalogId} onValueChange={setCatalogId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select part…" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockOpts.map((s) => (
                        <SelectItem key={s.catalog_item_id} value={s.catalog_item_id}>
                          <span className="font-medium">{s.item_name ?? s.part_number ?? "Part"}</span>
                          <span className="ml-2 text-muted-foreground tabular-nums">
                            (avail {s.quantity_available})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-full sm:w-24">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    className="h-9 text-xs"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  disabled={
                    busy ||
                    !catalogId ||
                    !Number.isFinite(Number(qty)) ||
                    Number(qty) <= 0 ||
                    (selected != null && Number(qty) > selected.quantity_available)
                  }
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const res = await fetch(`${baseUrl}/inventory/consume`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          work_order_id: workOrderId,
                          catalog_item_id: catalogId,
                          location_id: truckLocId,
                          quantity: Number(qty),
                        }),
                      })
                      const j = (await res.json().catch(() => ({}))) as { message?: string }
                      if (!res.ok) throw new Error(j.message ?? "Consumption failed.")
                      toast({ title: "Consumption recorded", description: "Truck stock updated for this work order." })
                      void loadStock()
                    } catch (e) {
                      toast({
                        title: "Could not consume",
                        description: e instanceof Error ? e.message : "Unknown error",
                        variant: "destructive",
                      })
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Consume from truck"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
