"use client"

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Technician-friendly mobile inventory card. Surfaces:
 *   • the technician's assigned vehicle bin (if any)
 *   • the parts they currently carry, with low-stock highlighting
 *   • a "Consume" action for the active work order
 *   • a "Request restock" action that fires `inventory/restock-request`
 *
 * The card is intentionally compact (large tap targets, no dense tables)
 * because field techs land here from the Today view on a phone. All writes
 * go through existing org-scoped APIs guarded by `canConsumePartsOnWorkOrders`.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Boxes,
  CheckCircle2,
  Loader2,
  PackageMinus,
  PackagePlus,
  Truck,
} from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { isLowStock, isOutOfStock } from "@/lib/inventory/format"

type StockRow = {
  id: string
  catalog_item_id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
  part_number: string | null
  item_name: string | null
}

type LocationRow = {
  id: string
  name: string
  location_type: string
}

type AssignmentRow = {
  inventory_location_id: string
  location_name: string | null
}

export type TechnicianInventoryMobileCardProps = {
  /**
   * Optional active work order context — when provided, the "Consume" action
   * is enabled. Otherwise the card surfaces the bin contents and restock
   * action only.
   */
  activeWorkOrder?: {
    id: string
    display: string
    title?: string
  } | null
  className?: string
}

export function TechnicianInventoryMobileCard({
  activeWorkOrder,
  className,
}: TechnicianInventoryMobileCardProps) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null)
  const [stock, setStock] = useState<StockRow[]>([])
  const [location, setLocation] = useState<LocationRow | null>(null)

  const [consumeOpen, setConsumeOpen] = useState(false)
  const [consumeRow, setConsumeRow] = useState<StockRow | null>(null)
  const [consumeQty, setConsumeQty] = useState("1")
  const [consumeBusy, setConsumeBusy] = useState(false)

  const [restockOpen, setRestockOpen] = useState(false)
  const [restockRow, setRestockRow] = useState<StockRow | null>(null)
  const [restockQty, setRestockQty] = useState("")
  const [restockNotes, setRestockNotes] = useState("")
  const [restockBusy, setRestockBusy] = useState(false)

  const baseUrl = organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}` : ""

  const canConsume = Boolean(permissions?.canConsumePartsOnWorkOrders)
  const canRequestRestock = canConsume

  const load = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setLoading(false)
        return
      }

      // Step 1 — `technicians` rows are linked to a user via the
      // `organization_members.membership_id` foreign key, not directly to
      // `auth.users`. Walk membership → technician so the bin matches the
      // operational profile dispatch maps to a van. If no link exists (e.g.
      // an admin without a tech record), we render an empty state instead.
      const { data: mem } = await supabase
        .from("organization_members")
        .select("membership_id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      const membershipId = (mem as { membership_id?: string | null } | null)?.membership_id ?? null
      if (!membershipId) {
        setAssignment(null)
        setStock([])
        setLocation(null)
        setLoading(false)
        return
      }

      const { data: tech } = await supabase
        .from("technicians")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("membership_id", membershipId)
        .maybeSingle()

      if (!tech) {
        setAssignment(null)
        setStock([])
        setLocation(null)
        setLoading(false)
        return
      }

      const techId = (tech as { id: string }).id

      // Vehicle assignment + location label.
      const vsRes = await fetch(`${baseUrl}/inventory/vehicle-stock`, { cache: "no-store" })
      const vsJ = (await vsRes.json().catch(() => ({}))) as {
        assignments?: Array<AssignmentRow & { technician_id: string; location_type?: string | null }>
      }
      const mine = (vsJ.assignments ?? []).find((a) => a.technician_id === techId)
      if (!mine) {
        setAssignment(null)
        setStock([])
        setLocation(null)
        setLoading(false)
        return
      }
      setAssignment({
        inventory_location_id: mine.inventory_location_id,
        location_name: mine.location_name ?? null,
      })

      // Resolve location row (we need `location_type` for badging).
      const { data: locRow } = await supabase
        .from("inventory_locations")
        .select("id, name, location_type")
        .eq("organization_id", organizationId)
        .eq("id", mine.inventory_location_id)
        .maybeSingle()
      setLocation(
        locRow
          ? {
              id: (locRow as { id: string }).id,
              name: (locRow as { name: string }).name,
              location_type: (locRow as { location_type: string }).location_type,
            }
          : null,
      )

      // Step 2 — pull stock for that bin only.
      const stockRes = await fetch(
        `${baseUrl}/inventory/stock?location_id=${encodeURIComponent(mine.inventory_location_id)}`,
        { cache: "no-store" },
      )
      const stockJ = (await stockRes.json().catch(() => ({}))) as { stock?: StockRow[] }
      setStock(stockJ.stock ?? [])
    } catch {
      // Soft-fail — the card simply shows an empty state if the bin can't be
      // resolved (offline tablet, dropped session, etc.).
    } finally {
      setLoading(false)
    }
  }, [baseUrl, orgStatus, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const sortedStock = useMemo(() => {
    // Show low-stock items first, then alphabetic.
    return [...stock].sort((a, b) => {
      const aLow = isLowStock({
        quantity_available: Number(a.quantity_available),
        reorder_point: a.reorder_point,
      })
      const bLow = isLowStock({
        quantity_available: Number(b.quantity_available),
        reorder_point: b.reorder_point,
      })
      if (aLow !== bLow) return aLow ? -1 : 1
      return (a.item_name ?? "").localeCompare(b.item_name ?? "")
    })
  }, [stock])

  if (orgStatus !== "ready") return null

  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="w-4 h-4" /> Your van stock
        </CardTitle>
        <CardDescription className="text-xs">
          {assignment?.location_name ? (
            <>Assigned bin: <span className="font-medium">{assignment.location_name}</span></>
          ) : (
            "Ask dispatch to assign a vehicle bin to start tracking your van inventory."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading van stock…
          </div>
        ) : !assignment ? (
          <p className="text-xs text-muted-foreground py-2">
            No van inventory assignment found for your profile yet.
          </p>
        ) : sortedStock.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Your bin is empty. Ask a manager to transfer parts to{" "}
            <span className="font-medium">{assignment.location_name}</span>.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sortedStock.map((row) => {
              const low = isLowStock({
                quantity_available: Number(row.quantity_available),
                reorder_point: row.reorder_point,
              })
              const out = isOutOfStock({ quantity_on_hand: Number(row.quantity_on_hand) })
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2.5 min-h-[3rem]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{row.item_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.part_number ? (
                        <span className="font-mono">{row.part_number}</span>
                      ) : null}
                      {row.part_number ? " · " : null}
                      <span className="tabular-nums">{row.quantity_available} available</span>
                      {row.reorder_point != null ? (
                        <span className="text-muted-foreground/70">
                          {" / reorder at "}
                          {row.reorder_point}
                        </span>
                      ) : null}
                      {out ? (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-rose-500/50 text-rose-700 dark:text-rose-300 text-[10px]"
                        >
                          Out
                        </Badge>
                      ) : low ? (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-amber-500/50 text-amber-700 dark:text-amber-300 text-[10px]"
                        >
                          Low
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeWorkOrder && canConsume ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 px-2 gap-1 text-xs"
                        disabled={out}
                        onClick={() => {
                          setConsumeRow(row)
                          setConsumeQty("1")
                          setConsumeOpen(true)
                        }}
                      >
                        <PackageMinus className="w-3.5 h-3.5" />
                        Use
                      </Button>
                    ) : null}
                    {canRequestRestock ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 px-2 gap-1 text-xs"
                        onClick={() => {
                          setRestockRow(row)
                          setRestockQty("")
                          setRestockNotes("")
                          setRestockOpen(true)
                        }}
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        Restock
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!canConsume && assignment ? (
          <p className="text-[11px] text-muted-foreground">
            Your role can view van inventory but not record consumption. Ask an admin if you need
            access.
          </p>
        ) : null}
        {assignment && location?.location_type === "vehicle" ? (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Boxes className="w-3 h-3" />
            Restock requests are recorded on the inventory ledger so dispatch can reorder parts
            during the next purchasing run.
          </p>
        ) : null}
      </CardContent>

      <Dialog open={consumeOpen} onOpenChange={setConsumeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Use part on this work order</DialogTitle>
            <DialogDescription className="text-xs">
              {activeWorkOrder ? (
                <>
                  Recording consumption on{" "}
                  <span className="font-semibold">{activeWorkOrder.display}</span>
                  {activeWorkOrder.title ? ` — ${activeWorkOrder.title}` : null}.
                </>
              ) : (
                <>Select a work order in the dispatcher first.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              <span className="font-medium">{consumeRow?.item_name ?? "—"}</span>
              {consumeRow?.part_number ? (
                <span className="ml-1.5 text-xs font-mono text-muted-foreground">
                  {consumeRow.part_number}
                </span>
              ) : null}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                value={consumeQty}
                onChange={(e) => setConsumeQty(e.target.value)}
                inputMode="numeric"
                className="h-10 text-sm"
                placeholder="1"
              />
              {consumeRow ? (
                <p className="text-[11px] text-muted-foreground">
                  {consumeRow.quantity_available} available in this bin.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setConsumeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!activeWorkOrder || !consumeRow || consumeBusy}
              onClick={async () => {
                if (!activeWorkOrder || !consumeRow || !baseUrl) return
                setConsumeBusy(true)
                try {
                  const qty = Number(consumeQty)
                  if (!Number.isFinite(qty) || qty <= 0) {
                    toast({ title: "Quantity must be positive.", variant: "destructive" })
                    return
                  }
                  const res = await fetch(`${baseUrl}/inventory/consume`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      work_order_id: activeWorkOrder.id,
                      catalog_item_id: consumeRow.catalog_item_id,
                      location_id: consumeRow.location_id,
                      quantity: qty,
                    }),
                  })
                  const j = (await res.json().catch(() => ({}))) as { message?: string }
                  if (!res.ok) throw new Error(j.message ?? "Consumption failed.")
                  toast({
                    title: "Part recorded",
                    description: `Used ${qty} on ${activeWorkOrder.display}.`,
                  })
                  setConsumeOpen(false)
                  void load()
                } catch (e) {
                  toast({
                    title: e instanceof Error ? e.message : "Failed",
                    variant: "destructive",
                  })
                } finally {
                  setConsumeBusy(false)
                }
              }}
            >
              {consumeBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Recording…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Record consumption
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Request restock</DialogTitle>
            <DialogDescription className="text-xs">
              We&apos;ll log a request on the inventory ledger so dispatch can reorder during the next
              purchasing run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              <span className="font-medium">{restockRow?.item_name ?? "—"}</span>
              {restockRow?.part_number ? (
                <span className="ml-1.5 text-xs font-mono text-muted-foreground">
                  {restockRow.part_number}
                </span>
              ) : null}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity needed (optional)</Label>
              <Input
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                inputMode="numeric"
                className="h-10 text-sm"
                placeholder={restockRow?.reorder_point ? String(restockRow.reorder_point) : "e.g. 5"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note for dispatch (optional)</Label>
              <Input
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                className="h-10 text-sm"
                placeholder="Used last one on emergency call."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setRestockOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!restockRow || restockBusy}
              onClick={async () => {
                if (!restockRow || !baseUrl) return
                setRestockBusy(true)
                try {
                  const qty = restockQty.trim() ? Number(restockQty) : null
                  if (qty != null && (!Number.isFinite(qty) || qty <= 0)) {
                    toast({ title: "Quantity must be positive.", variant: "destructive" })
                    return
                  }
                  const res = await fetch(`${baseUrl}/inventory/restock-request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      catalog_item_id: restockRow.catalog_item_id,
                      location_id: restockRow.location_id,
                      quantity: qty,
                      notes: restockNotes.trim() || null,
                    }),
                  })
                  const j = (await res.json().catch(() => ({}))) as { message?: string }
                  if (!res.ok) throw new Error(j.message ?? "Restock request failed.")
                  toast({
                    title: "Restock request sent",
                    description: "Dispatch will see this on the inventory ledger.",
                  })
                  setRestockOpen(false)
                } catch (e) {
                  toast({
                    title: e instanceof Error ? e.message : "Failed",
                    variant: "destructive",
                  })
                } finally {
                  setRestockBusy(false)
                }
              }}
            >
              {restockBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Sending…
                </>
              ) : (
                <>Send request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
