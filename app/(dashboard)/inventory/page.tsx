"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Package, Truck, Warehouse } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

const MANAGER_ROLES = new Set(["owner", "admin", "manager"])

type LocationRow = {
  id: string
  name: string
  code: string | null
  location_type: string
  technician_name: string | null
  is_active: boolean
}

type StockRow = {
  id: string
  catalog_item_id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
  part_number: string | null
  item_name: string | null
  unit: string | null
  location_name: string | null
}

type TxRow = {
  id: string
  transaction_type: string
  quantity: number
  delta_on_hand: number
  delta_allocated: number
  catalog_item_id: string
  location_id: string
  work_order_id: string | null
  purchase_order_id: string | null
  notes: string | null
  created_at: string
}

type CatalogOpt = { id: string; name: string; part_number: string }

/**
 * Recent work order option used by the Consume picker.
 *
 * `display` already passes through `getWorkOrderDisplay`, which formats the
 * stored work order number (or falls back to a short readable hint). This
 * keeps raw UUIDs out of the UI while still supporting workspaces that have
 * yet to backfill `work_order_number`.
 */
type RecentWorkOrderOpt = {
  id: string
  display: string
  title: string
  customerName: string
}

/**
 * Shared layout primitives for inventory operation cards.
 *
 * The overarching goal is "compact operational workflow row" — fields are
 * **kept visually grouped near the start of the row**, the CTA sits next to
 * the last input rather than being shoved to the far right with `ml-auto`,
 * and the whole row is **clamped to `max-w-5xl`** so ultra-wide monitors
 * don't stretch a 5-input form across 2,500 px.
 *
 * Field widths are expressed via `sm:basis-[Xrem]` per cell (no `flex-1`),
 * which gives each input a deliberate target size while still wrapping
 * cleanly onto a second row on tablet and stacking full-width on mobile.
 */
const INV_CARD_CLASS = "gap-2 py-4"
/** `CardContent` wrapper for inventory forms: clamps width + tight padding. */
const INV_FORM_GROUP = "pt-0 max-w-5xl"
/** Inline workflow row — flex-wrap with bottom-aligned inputs. */
const INV_FORM_ROW = "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
/** Base field cell — `min-w-0` so long select labels can truncate. */
const INV_FIELD = "space-y-1.5 min-w-0"
/** CTA: no `ml-auto` — sits next to the last input on desktop, full-width on mobile. */
const INV_SUBMIT_CLASS = "h-9 w-full sm:w-auto"

export default function InventoryPage() {
  const { toast } = useToast()
  const { isPlatformAdmin } = useAdmin()
  const { organizationId, status } = useActiveOrganization()
  const [canManage, setCanManage] = useState(false)

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [lowStock, setLowStock] = useState<
    Array<{
      stock_id: string
      catalog_item_id: string
      location_id: string
      quantity_available: number
      reorder_point: number | null
      item_name: string | null
      location_name: string | null
    }>
  >([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [vehicleAssignments, setVehicleAssignments] = useState<
    Array<{ technician_id: string; technician_name: string | null; inventory_location_id: string; location_name: string | null }>
  >([])
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string }>>([])
  const [catalogParts, setCatalogParts] = useState<CatalogOpt[]>([])
  const [recentWorkOrders, setRecentWorkOrders] = useState<RecentWorkOrderOpt[]>([])

  const [loading, setLoading] = useState(true)

  const [locOpen, setLocOpen] = useState(false)
  const [newLocName, setNewLocName] = useState("")
  const [newLocType, setNewLocType] = useState("warehouse")

  const baseUrl = organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}` : ""

  const load = useCallback(async () => {
    if (!organizationId || status !== "ready") {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [lr, sr, ls, tx, vs, catRes] = await Promise.all([
        fetch(`${baseUrl}/inventory/locations`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/low-stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/transactions?limit=200`, { cache: "no-store" }),
        fetch(`${baseUrl}/inventory/vehicle-stock`, { cache: "no-store" }),
        fetch(`${baseUrl}/catalog-items?limit=500`, { cache: "no-store" }),
      ])
      const lj = await lr.json().catch(() => ({}))
      const sj = await sr.json().catch(() => ({}))
      const lowj = await ls.json().catch(() => ({}))
      const txj = await tx.json().catch(() => ({}))
      const vsj = await vs.json().catch(() => ({}))
      const cj = await catRes.json().catch(() => ({}))

      setLocations(lj.locations ?? [])
      setStock(sj.stock ?? [])
      setLowStock(lowj.items ?? [])
      setTransactions(txj.transactions ?? [])
      setVehicleAssignments(vsj.assignments ?? [])
      const items = (cj.items ?? []) as Array<{ id: string; name: string; part_number?: string | null }>
      setCatalogParts(items.map((i) => ({ id: i.id, name: i.name, part_number: i.part_number ?? "" })))

      // Recent active work orders for the Consume-on-work-order picker.
      // We intentionally cap at 150 most-recently-scheduled rows; this is
      // additive to the existing inventory APIs and keeps raw UUIDs out of
      // the UI. TODO(work-order-picker): swap for a server-side searchable
      // combobox once we extract a shared <WorkOrderPicker> component.
      try {
        const supabase = createBrowserSupabaseClient()
        const { data: woRows } = await supabase
          .from("work_orders")
          .select("id, work_order_number, title, customer_id, scheduled_on")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .in("status", [
            "open",
            "scheduled",
            "in_progress",
            "completed_pending_signature",
            "completed",
          ])
          .order("scheduled_on", { ascending: false, nullsFirst: false })
          .limit(150)

        const customerIds = Array.from(
          new Set((woRows ?? []).map((r) => (r as { customer_id?: string | null }).customer_id).filter(Boolean) as string[]),
        )
        const customerNameMap = new Map<string, string>()
        if (customerIds.length > 0) {
          const { data: cRows } = await supabase
            .from("customers")
            .select("id, company_name")
            .eq("organization_id", organizationId)
            .in("id", customerIds)
          for (const c of cRows ?? []) {
            customerNameMap.set(c.id as string, ((c as { company_name?: string | null }).company_name ?? "").trim())
          }
        }

        setRecentWorkOrders(
          (woRows ?? []).map((w) => {
            const row = w as {
              id: string
              work_order_number: number | null
              title: string | null
              customer_id: string | null
            }
            return {
              id: row.id,
              display: getWorkOrderDisplay({ id: row.id, workOrderNumber: row.work_order_number }),
              title: (row.title ?? "").trim(),
              customerName: row.customer_id ? customerNameMap.get(row.customer_id) ?? "" : "",
            }
          }),
        )
      } catch {
        // Non-fatal — the rest of the inventory page still works without the picker.
        setRecentWorkOrders([])
      }
    } catch {
      toast({ title: "Could not load inventory", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [baseUrl, organizationId, status, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!organizationId || status !== "ready") {
      setCanManage(false)
      return
    }
    let cancelled = false
    ;(async () => {
      if (isPlatformAdmin) {
        if (!cancelled) setCanManage(true)
        return
      }
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id || cancelled) return
      const { data: mem } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
      if (!cancelled) setCanManage(MANAGER_ROLES.has((mem?.role as string) ?? ""))
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status, isPlatformAdmin])

  useEffect(() => {
    if (!organizationId || status !== "ready") return
    let cancelled = false
    ;(async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("technicians")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .eq("operational_status", "active")
        .order("full_name", { ascending: true })
      if (!cancelled && data) {
        setTechnicians(data.map((t) => ({ id: t.id as string, full_name: (t.full_name as string) ?? "" })))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status])

  const vehicleLocations = useMemo(
    () => locations.filter((l) => l.location_type === "vehicle" && l.is_active),
    [locations],
  )

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const j = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(j.message ?? "Request failed.")
  }

  const [adjCatalog, setAdjCatalog] = useState("")
  const [adjLoc, setAdjLoc] = useState("")
  const [adjQty, setAdjQty] = useState("1")
  const [adjDir, setAdjDir] = useState<"in" | "out">("in")

  const [xfCatalog, setXfCatalog] = useState("")
  const [xfFrom, setXfFrom] = useState("")
  const [xfTo, setXfTo] = useState("")
  const [xfQty, setXfQty] = useState("1")

  const [rcvCatalog, setRcvCatalog] = useState("")
  const [rcvLoc, setRcvLoc] = useState("")
  const [rcvQty, setRcvQty] = useState("1")
  const [rcvPo, setRcvPo] = useState("")

  const [conWo, setConWo] = useState("")
  const [conCatalog, setConCatalog] = useState("")
  const [conLoc, setConLoc] = useState("")
  const [conQty, setConQty] = useState("1")

  const [thrStock, setThrStock] = useState("")
  const [thrPoint, setThrPoint] = useState("")
  const [thrQty, setThrQty] = useState("")

  const [vanTech, setVanTech] = useState("")
  const [vanLoc, setVanLoc] = useState("")

  async function submitThresholds() {
    if (!canManage || !baseUrl) return
    try {
      await postJson(`${baseUrl}/inventory/thresholds`, {
        stock_id: thrStock,
        reorder_point: thrPoint === "" ? null : Number(thrPoint),
        reorder_quantity: thrQty === "" ? null : Number(thrQty),
      })
      toast({ title: "Reorder thresholds saved" })
      void load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  async function submitVanAssign() {
    if (!canManage || !baseUrl) return
    try {
      await postJson(`${baseUrl}/inventory/vehicle-stock`, {
        technician_id: vanTech,
        inventory_location_id: vanLoc,
      })
      toast({ title: "Van stock location assigned" })
      void load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
    }
  }

  if (!organizationId || status !== "ready") {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading workspace…
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading inventory…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="overview" className="space-y-4">
        {/* Tabs + primary CTA on one row (desktop); stack/wrap cleanly on narrow viewports */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 justify-start sm:min-w-0 sm:flex-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="adjust">Stock adjustments</TabsTrigger>
            <TabsTrigger value="transfer">Transfers</TabsTrigger>
            <TabsTrigger value="history">Consumption &amp; history</TabsTrigger>
            <TabsTrigger value="vans">Van inventory</TabsTrigger>
          </TabsList>
          {canManage ? (
            <div className="flex w-full shrink-0 justify-end sm:w-auto">
              <Button type="button" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setLocOpen(true)}>
                <Warehouse className="size-4 shrink-0" />
                <span className="hidden sm:inline">New location</span>
                <span className="sm:hidden">Location</span>
              </Button>
            </div>
          ) : null}
        </div>

        <TabsContent value="overview" className="space-y-4">
          {lowStock.length > 0 && (
            <Card className={cn(INV_CARD_CLASS, "border-amber-500/30 bg-amber-500/5")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Low stock alerts</CardTitle>
                <CardDescription className="text-xs">
                  Available quantity is at or below the reorder point for these SKU / location pairs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((r) => (
                      <TableRow key={r.stock_id}>
                        <TableCell className="text-sm">{r.item_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.location_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity_available}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.reorder_point ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> On-hand by location
              </CardTitle>
              <CardDescription className="text-xs">
                Parts linked to catalog items. Available = on hand − allocated.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground py-8 text-center">
                        No stock rows yet. Receive or adjust stock to create balances.
                      </TableCell>
                    </TableRow>
                  )}
                  {stock.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <span className="font-medium">{r.item_name ?? "—"}</span>
                        {r.part_number ? (
                          <span className="block text-[11px] text-muted-foreground">{r.part_number}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{r.location_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_on_hand}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_allocated}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity_available}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canManage && (
            <Card className={INV_CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reorder thresholds</CardTitle>
                <CardDescription className="text-xs">
                  Set alerts per stock row (requires existing balance row).
                </CardDescription>
              </CardHeader>
              <CardContent className={INV_FORM_GROUP}>
                <div className={INV_FORM_ROW}>
                  <div className={cn(INV_FIELD, "sm:basis-[18rem] sm:flex-grow")}>
                    <Label className="text-xs">Stock row</Label>
                    <Select value={thrStock} onValueChange={setThrStock}>
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="Choose stocked line…" />
                      </SelectTrigger>
                      <SelectContent>
                        {stock.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {(s.item_name ?? s.part_number ?? "—").slice(0, 42)} @ {s.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn(INV_FIELD, "sm:basis-[7rem]")}>
                    <Label className="text-xs">Reorder at</Label>
                    <Input
                      value={thrPoint}
                      onChange={(e) => setThrPoint(e.target.value)}
                      placeholder="e.g. 5"
                      inputMode="numeric"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className={cn(INV_FIELD, "sm:basis-[7rem]")}>
                    <Label className="text-xs">Order qty</Label>
                    <Input
                      value={thrQty}
                      onChange={(e) => setThrQty(e.target.value)}
                      placeholder="e.g. 10"
                      inputMode="numeric"
                      className="h-9 text-xs"
                    />
                  </div>
                  <Button type="button" size="sm" className={INV_SUBMIT_CLASS} onClick={submitThresholds}>
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="adjust" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Adjust on-hand</CardTitle>
              <CardDescription className="text-xs">
                Increase or decrease counts at a location (cycle counts, corrections).
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={adjCatalog} onValueChange={setAdjCatalog} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Select part…" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogParts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.part_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[12rem]")}>
                  <Label className="text-xs">Location</Label>
                  <Select value={adjLoc} onValueChange={setAdjLoc} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Location…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.location_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[8rem]")}>
                  <Label className="text-xs">Direction</Label>
                  <Select value={adjDir} onValueChange={(v) => setAdjDir(v as "in" | "out")} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Increase</SelectItem>
                      <SelectItem value="out">Decrease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    className="h-9 text-xs"
                    inputMode="numeric"
                    disabled={!canManage}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/adjust`, {
                        catalog_item_id: adjCatalog,
                        location_id: adjLoc,
                        direction: adjDir,
                        quantity: Number(adjQty),
                      })
                      toast({ title: "Stock adjusted" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Apply adjustment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Receive against PO (optional)</CardTitle>
              <CardDescription className="text-xs">
                Increases on-hand; links to purchase order when provided.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={rcvCatalog} onValueChange={setRcvCatalog} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Part…" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogParts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[12rem]")}>
                  <Label className="text-xs">Location</Label>
                  <Select value={rcvLoc} onValueChange={setRcvLoc} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Warehouse…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    value={rcvQty}
                    onChange={(e) => setRcvQty(e.target.value)}
                    className="h-9 text-xs"
                    inputMode="numeric"
                    disabled={!canManage}
                  />
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[10rem]")}>
                  <Label className="text-xs">
                    PO reference <span className="text-muted-foreground/70">(optional)</span>
                  </Label>
                  <Input
                    value={rcvPo}
                    onChange={(e) => setRcvPo(e.target.value)}
                    className="h-9 text-xs font-mono"
                    placeholder="PO id"
                    disabled={!canManage}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/receive`, {
                        catalog_item_id: rcvCatalog,
                        location_id: rcvLoc,
                        quantity: Number(rcvQty),
                        purchase_order_id: rcvPo.trim() || null,
                      })
                      toast({ title: "Receipt recorded" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Receive
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transfer between locations</CardTitle>
              <CardDescription className="text-xs">
                Moves available quantity from warehouse to vehicle or between bins.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={xfCatalog} onValueChange={setXfCatalog} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Part…" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogParts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[10rem]")}>
                  <Label className="text-xs">From</Label>
                  <Select value={xfFrom} onValueChange={setXfFrom} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Source…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[10rem]")}>
                  <Label className="text-xs">To</Label>
                  <Select value={xfTo} onValueChange={setXfTo} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Destination…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    value={xfQty}
                    onChange={(e) => setXfQty(e.target.value)}
                    className="h-9 text-xs"
                    inputMode="numeric"
                    disabled={!canManage}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManage}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/transfer`, {
                        catalog_item_id: xfCatalog,
                        from_location_id: xfFrom,
                        to_location_id: xfTo,
                        quantity: Number(xfQty),
                      })
                      toast({ title: "Transfer completed" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ledger</CardTitle>
              <CardDescription className="text-xs">
                Consumption rows reference work orders. Filter mentally by type &mdash; use{" "}
                <strong>consume</strong> for parts used on jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Δ on-hand</TableHead>
                    <TableHead className="text-right">Δ alloc</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-sm text-muted-foreground py-8 text-center">
                        No inventory transactions yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {transactions.map((t) => {
                    const woMatch = t.work_order_id
                      ? recentWorkOrders.find((w) => w.id === t.work_order_id)
                      : null
                    const woRef = t.work_order_id
                      ? woMatch?.display ?? "Work order"
                      : null
                    const poRef = t.purchase_order_id ? "Purchase order" : null
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(t.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{t.transaction_type}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.delta_on_hand}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.delta_allocated}</TableCell>
                        <TableCell className="text-xs">
                          {woRef ? <span>{woRef}</span> : null}
                          {woRef && poRef ? <span className="mx-1 text-muted-foreground">·</span> : null}
                          {poRef ? <span className="text-muted-foreground">{poRef}</span> : null}
                          {!woRef && !poRef ? <span className="text-muted-foreground">—</span> : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consume on work order</CardTitle>
              <CardDescription className="text-xs">
                Pulls physical stock and releases allocation when applicable. Pick the work order from the list
                — no UUID copy/paste required.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              {/*
                NOTE: This is a foundation picker — Select-based, capped at 150
                most-recently-scheduled active work orders. When org work order
                volume outgrows this, swap for a server-side searchable
                <WorkOrderPicker> combobox without changing the surrounding
                layout. The internal value stays the work order id, so the API
                contract is unchanged.
              */}
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[16rem]")}>
                  <Label className="text-xs">Work order</Label>
                  <Select value={conWo} onValueChange={setConWo} disabled={!canManage || recentWorkOrders.length === 0}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue
                        placeholder={
                          recentWorkOrders.length === 0
                            ? "No active work orders yet"
                            : "Select work order…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {recentWorkOrders.map((w) => {
                        const detail = [w.customerName, w.title].filter(Boolean).join(" · ")
                        return (
                          <SelectItem key={w.id} value={w.id}>
                            <span className="font-medium">{w.display}</span>
                            {detail ? (
                              <span className="ml-1.5 text-muted-foreground">{detail}</span>
                            ) : null}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[12rem]")}>
                  <Label className="text-xs">Part</Label>
                  <Select value={conCatalog} onValueChange={setConCatalog} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Catalog…" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogParts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[10rem]")}>
                  <Label className="text-xs">Location</Label>
                  <Select value={conLoc} onValueChange={setConLoc} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="From…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    value={conQty}
                    onChange={(e) => setConQty(e.target.value)}
                    className="h-9 text-xs"
                    inputMode="numeric"
                    disabled={!canManage}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManage || !conWo}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/consume`, {
                        work_order_id: conWo.trim(),
                        catalog_item_id: conCatalog,
                        location_id: conLoc,
                        quantity: Number(conQty),
                      })
                      toast({ title: "Consumption recorded" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Record consumption
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vans" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" /> Technician vehicle bins
              </CardTitle>
              <CardDescription className="text-xs">
                Assign a technician to the inventory location that represents their van. Stock for that location
                appears in <strong>Overview</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[14rem]")}>
                  <Label className="text-xs">Technician</Label>
                  <Select value={vanTech} onValueChange={setVanTech} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Select technician…" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(INV_FIELD, "sm:basis-[14rem]")}>
                  <Label className="text-xs">Vehicle location</Label>
                  <Select value={vanLoc} onValueChange={setVanLoc} disabled={!canManage}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Van location…" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleLocations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManage}
                  onClick={submitVanAssign}
                >
                  Save assignment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current assignments</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Van location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleAssignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm text-muted-foreground py-6 text-center">
                        No van inventory assignments yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {vehicleAssignments.map((a) => (
                    <TableRow key={a.technician_id}>
                      <TableCell className="text-sm">{a.technician_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.location_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New inventory location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newLocName} onChange={(e) => setNewLocName(e.target.value)} placeholder="Main warehouse" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newLocType} onValueChange={setNewLocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="vehicle">Vehicle / van</SelectItem>
                  <SelectItem value="job_site">Job site</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setLocOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!baseUrl || !newLocName.trim()) return
                try {
                  await postJson(`${baseUrl}/inventory/locations`, {
                    name: newLocName.trim(),
                    location_type: newLocType,
                  })
                  toast({ title: "Location created" })
                  setLocOpen(false)
                  setNewLocName("")
                  void load()
                } catch (e) {
                  toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
