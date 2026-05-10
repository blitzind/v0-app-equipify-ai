"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Package, Plus, Truck, Warehouse } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useAdmin } from "@/lib/admin-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { RestrictedNotice } from "@/components/permissions/restricted-notice"
import { InventoryOverviewKpis } from "@/components/inventory/inventory-overview-kpis"
import { InventoryReorderCenter } from "@/components/inventory/inventory-reorder-center"
import { InventoryVehicleStockSummary } from "@/components/inventory/inventory-vehicle-stock-summary"
import { InventoryRecentActivityCard } from "@/components/inventory/inventory-recent-activity-card"
import { formatTransactionType, isLowStock, stockTone } from "@/lib/inventory/format"

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
  last_restocked_at?: string | null
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
  counterparty_location_id: string | null
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
  const orgPerms = useOrgPermissions()
  // `canManageInventory` matches `requireOrgInventoryWrite` (receive, transfer,
  // locations, thresholds, vehicle assignment). Adjust also requires
  // `canAdjustInventoryStock` on the server — mirror both on the client.
  const canAdjust = Boolean(orgPerms.permissions.canAdjustInventoryStock || isPlatformAdmin)
  const canConsumeOnWorkOrder = Boolean(
    orgPerms.permissions.canConsumePartsOnWorkOrders || isPlatformAdmin,
  )
  const canManageInventoryPerm = Boolean(orgPerms.permissions.canManageInventory || isPlatformAdmin)
  const canPostStockAdjustment = canManageInventoryPerm && canAdjust

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
      setTransactions((txj.transactions ?? []) as TxRow[])
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
  const [adjConfirmOpen, setAdjConfirmOpen] = useState(false)

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

  const [stockTableFilter, setStockTableFilter] = useState<
    "all" | "vehicle_only" | "vehicle_needs_restock"
  >("all")
  const [myVehicleLocId, setMyVehicleLocId] = useState<string | null>(null)

  const [retCatalog, setRetCatalog] = useState("")
  const [retWarehouse, setRetWarehouse] = useState("")
  const [retQty, setRetQty] = useState("1")

  async function submitThresholds() {
    if (!canManageInventoryPerm || !baseUrl) return
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

  async function submitAdjustment() {
    if (!canPostStockAdjustment || !baseUrl) return
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
  }

  async function submitVanAssign() {
    if (!canManageInventoryPerm || !baseUrl) return
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

  const warehouseStagingLocations = useMemo(
    () =>
      locations.filter(
        (l) => l.is_active && (l.location_type === "warehouse" || l.location_type === "staging"),
      ),
    [locations],
  )

  const filteredStockRows = useMemo(() => {
    return stock.filter((r) => {
      const loc = locations.find((l) => l.id === r.location_id)
      const isVehicle = loc?.location_type === "vehicle"
      if (stockTableFilter === "vehicle_only") return Boolean(isVehicle)
      if (stockTableFilter === "vehicle_needs_restock") {
        if (!isVehicle) return false
        const tone = stockTone({
          quantity_on_hand: Number(r.quantity_on_hand),
          quantity_available: Number(r.quantity_available),
          reorder_point: r.reorder_point,
        })
        return tone !== "ok"
      }
      return true
    })
  }, [stock, locations, stockTableFilter])

  useEffect(() => {
    if (!organizationId || status !== "ready" || !baseUrl) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/inventory/my-vehicle-location`, { cache: "no-store" })
        const body = (await res.json().catch(() => ({}))) as { inventory_location_id?: string | null }
        if (!cancelled) setMyVehicleLocId(body.inventory_location_id ?? null)
      } catch {
        if (!cancelled) setMyVehicleLocId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, status, baseUrl])

  useEffect(() => {
    if (!myVehicleLocId) return
    setConLoc((prev) => (prev.trim() ? prev : myVehicleLocId))
  }, [myVehicleLocId])

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
      <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
        <p className="leading-relaxed">
          <span className="font-medium text-foreground">Parts live in Catalog.</span>{" "}
          <Link href="/catalog" className="text-primary underline-offset-4 hover:underline">
            Add or edit items
          </Link>{" "}
          there, then use the tabs below to <strong className="text-foreground">receive</strong>,{" "}
          <strong className="text-foreground">transfer</strong>, <strong className="text-foreground">adjust</strong>, or{" "}
          <strong className="text-foreground">consume</strong> stock. To hide a SKU from default lists,{" "}
          <strong className="text-foreground">archive the catalog item</strong> from its drawer — nothing is hard-deleted.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        {/* Tabs + primary CTA on one row (desktop); stack/wrap cleanly on narrow viewports */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 justify-start sm:min-w-0 sm:flex-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="adjust">Adjust / receive</TabsTrigger>
            <TabsTrigger value="transfer">Transfer stock</TabsTrigger>
            <TabsTrigger value="history">Consume parts &amp; history</TabsTrigger>
            <TabsTrigger value="vans">Van &amp; truck stock</TabsTrigger>
            <TabsTrigger value="reorder">Reorder</TabsTrigger>
          </TabsList>
          {canManageInventoryPerm ? (
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button type="button" size="sm" variant="outline" className="gap-2 w-full sm:w-auto" asChild>
                <Link href="/catalog">
                  <Plus className="size-4 shrink-0" />
                  Add catalog item
                </Link>
              </Button>
              <Button type="button" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setLocOpen(true)}>
                <Warehouse className="size-4 shrink-0" />
                <span className="hidden sm:inline">Add location</span>
                <span className="sm:hidden">Location</span>
              </Button>
            </div>
          ) : null}
        </div>

        <TabsContent value="overview" className="space-y-4">
          <InventoryOverviewKpis
            lowStockCount={lowStock.length}
            vehicleCount={locations.filter((l) => l.is_active && l.location_type === "vehicle").length}
            vehiclesLowStock={
              new Set(
                stock
                  .filter((s) =>
                    isLowStock({
                      quantity_available: Number(s.quantity_available),
                      reorder_point: s.reorder_point,
                    }),
                  )
                  .filter((s) => {
                    const loc = locations.find((l) => l.id === s.location_id)
                    return loc?.location_type === "vehicle"
                  })
                  .map((s) => s.location_id),
              ).size
            }
            recentTxnCount={transactions.length}
            recentConsumedCount={transactions.filter((t) => t.transaction_type === "consume").length}
            reorderNeededCount={
              stock.filter(
                (s) =>
                  s.reorder_point != null &&
                  Number(s.quantity_available) <= Number(s.reorder_point),
              ).length
            }
          />

          {!canManageInventoryPerm ? (
            <RestrictedNotice
              capability="canManageInventory"
              title="Inventory edits are restricted for your account"
              body="You can view stock balances, low-stock alerts, and recent activity when your role allows. Ask someone with inventory management access to receive, transfer, or adjust stock for you."
            />
          ) : null}

          <InventoryVehicleStockSummary
            stock={stock}
            locations={locations}
            vehicleAssignments={vehicleAssignments}
          />

          <Card
            className={cn(
              INV_CARD_CLASS,
              lowStock.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-dashed border-border/80 bg-muted/10",
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Low stock alerts</CardTitle>
              <CardDescription className="text-xs">
                {lowStock.length > 0
                  ? "Available quantity is at or below the reorder point for these SKU / location pairs."
                  : "Nothing is below its reorder point right now. Set reorder thresholds in Overview (below) or jump to the Reorder tab for purchasing-style workflows."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  When a part hits its threshold, it will appear here and in the{" "}
                  <strong className="text-foreground">Reorder</strong> tab.
                </p>
              ) : (
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
              )}
            </CardContent>
          </Card>

          <InventoryRecentActivityCard
            transactions={transactions}
            catalogParts={catalogParts.map((c) => ({ id: c.id, name: c.name }))}
            locations={locations.map((l) => ({
              id: l.id,
              name: l.name,
              location_type: l.location_type,
            }))}
            workOrders={recentWorkOrders.map((w) => ({ id: w.id, display: w.display }))}
          />

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2 gap-3 flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" /> On-hand by location
                </CardTitle>
                <CardDescription className="text-xs">
                  Parts linked to catalog items. Available = on hand − allocated. Filter to truck stock or vans that
                  need restock.
                </CardDescription>
              </div>
              <Select
                value={stockTableFilter}
                onValueChange={(v) =>
                  setStockTableFilter(v as "all" | "vehicle_only" | "vehicle_needs_restock")
                }
              >
                <SelectTrigger className="h-9 w-full sm:w-[220px] text-xs shrink-0">
                  <SelectValue placeholder="Filter…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  <SelectItem value="vehicle_only">Vehicle / truck stock only</SelectItem>
                  <SelectItem value="vehicle_needs_restock">Truck — low or out</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Last inbound</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStockRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        {stock.length === 0 ? (
                          <span className="block max-w-md mx-auto space-y-2">
                            <span className="block text-foreground font-medium">No on-hand balances yet</span>
                            <span className="block text-xs leading-relaxed">
                              Add parts in{" "}
                              <Link href="/catalog" className="text-primary underline-offset-4 hover:underline">
                                Catalog
                              </Link>
                              , then open <strong className="text-foreground">Adjust / receive</strong> to{" "}
                              <strong className="text-foreground">Receive stock</strong> or{" "}
                              <strong className="text-foreground">Adjust stock</strong> at a location.
                            </span>
                          </span>
                        ) : (
                          "No rows match this filter."
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredStockRows.map((r) => {
                    const loc = locations.find((l) => l.id === r.location_id)
                    const isVehicle = loc?.location_type === "vehicle"
                    const techName = isVehicle
                      ? vehicleAssignments.find((a) => a.inventory_location_id === r.location_id)
                          ?.technician_name ?? null
                      : null
                    const tone = stockTone({
                      quantity_on_hand: Number(r.quantity_on_hand),
                      quantity_available: Number(r.quantity_available),
                      reorder_point: r.reorder_point,
                    })
                    const toneLabel = tone === "out" ? "Out" : tone === "low" ? "Low" : "OK"
                    const toneClass =
                      tone === "out"
                        ? "border-rose-500/50 text-rose-700 dark:text-rose-300"
                        : tone === "low"
                          ? "border-amber-500/50 text-amber-700 dark:text-amber-300"
                          : "border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          <span className="font-medium">{r.item_name ?? "—"}</span>
                          {r.part_number ? (
                            <span className="block text-[11px] text-muted-foreground">{r.part_number}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{r.location_name}</span>
                            {isVehicle ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-blue-500/40 text-blue-700 dark:text-blue-300"
                              >
                                <Truck className="w-2.5 h-2.5 mr-1" />
                                {techName ?? "Vehicle"}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn("text-[10px] tabular-nums", toneClass)}>
                            {toneLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity_on_hand}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity_allocated}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity_available}</TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground whitespace-nowrap">
                          {r.last_restocked_at
                            ? new Date(r.last_restocked_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canManageInventoryPerm && (
            <Card className={INV_CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reorder alerts (thresholds)</CardTitle>
                <CardDescription className="text-xs">
                  Set when to flag low stock per SKU and location (needs an existing on-hand row).
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
                    Save thresholds
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="adjust" className="space-y-4">
          {canManageInventoryPerm && !canAdjust ? (
            <p className="text-xs text-amber-900 dark:text-amber-100 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2">
              Your permissions allow receiving and transferring stock, but not count adjustments. Ask someone with{" "}
              <strong className="font-semibold">adjust inventory</strong> access if you need cycle-count corrections.
            </p>
          ) : null}
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Adjust stock</CardTitle>
              <CardDescription className="text-xs">
                Increase or decrease on-hand at a location (cycle counts, corrections, write-offs).
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={adjCatalog} onValueChange={setAdjCatalog} disabled={!canPostStockAdjustment}>
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
                  <Select value={adjLoc} onValueChange={setAdjLoc} disabled={!canPostStockAdjustment}>
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
                  <Select
                    value={adjDir}
                    onValueChange={(v) => setAdjDir(v as "in" | "out")}
                    disabled={!canPostStockAdjustment}
                  >
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
                    disabled={!canPostStockAdjustment}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={
                    !canPostStockAdjustment ||
                    !adjCatalog ||
                    !adjLoc ||
                    !Number.isFinite(Number(adjQty)) ||
                    Number(adjQty) <= 0
                  }
                  onClick={() => {
                    // Decreases are destructive (cycle counts that drop on-hand,
                    // write-offs). We always confirm those; increases apply
                    // immediately so manager workflow stays fast.
                    if (adjDir === "out") {
                      setAdjConfirmOpen(true)
                      return
                    }
                    void submitAdjustment()
                  }}
                >
                  Apply stock adjustment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Receive stock</CardTitle>
              <CardDescription className="text-xs">
                Increase on-hand when shipment arrives. Optionally link an internal purchase order reference.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={rcvCatalog} onValueChange={setRcvCatalog} disabled={!canManageInventoryPerm}>
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
                  <Select value={rcvLoc} onValueChange={setRcvLoc} disabled={!canManageInventoryPerm}>
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
                    disabled={!canManageInventoryPerm}
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
                    disabled={!canManageInventoryPerm}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManageInventoryPerm}
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
                  Receive stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transfer stock</CardTitle>
              <CardDescription className="text-xs">
                Move quantity between bins (warehouse, vehicle, job site, staging). Destination rows are created at
                zero if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={xfCatalog} onValueChange={setXfCatalog} disabled={!canManageInventoryPerm}>
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
                  <Label className="text-xs">Source location</Label>
                  <Select value={xfFrom} onValueChange={setXfFrom} disabled={!canManageInventoryPerm}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Where the parts are now…" />
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
                <div className={cn(INV_FIELD, "sm:basis-[12rem]")}>
                  <Label className="text-xs">Destination location</Label>
                  <Select value={xfTo} onValueChange={setXfTo} disabled={!canManageInventoryPerm}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Where they're going…" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.is_active && l.id !== xfFrom)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.location_type})
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
                    disabled={!canManageInventoryPerm}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canManageInventoryPerm}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/transfer`, {
                        catalog_item_id: xfCatalog,
                        from_location_id: xfFrom,
                        to_location_id: xfTo,
                        quantity: Number(xfQty),
                      })
                      toast({ title: "Stock transferred" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Transfer stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className={INV_CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stock movement history</CardTitle>
              <CardDescription className="text-xs">
                Immutable ledger of receives, transfers, adjustments, and parts consumed on work orders. Use{" "}
                <strong className="text-foreground">Consume part</strong> below to record usage against a job.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Part</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Δ on-hand</TableHead>
                    <TableHead className="text-right">Δ alloc</TableHead>
                    <TableHead>Other bin</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        <span className="block max-w-md mx-auto space-y-2">
                          <span className="block text-foreground font-medium">No stock movements yet</span>
                          <span className="block text-xs leading-relaxed">
                            Record a <strong className="text-foreground">Receive stock</strong> or{" "}
                            <strong className="text-foreground">Adjust stock</strong> action under{" "}
                            <strong className="text-foreground">Adjust / receive</strong>, or{" "}
                            <strong className="text-foreground">Transfer stock</strong> between locations.
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {transactions.map((t) => {
                    const partLabel =
                      catalogParts.find((c) => c.id === t.catalog_item_id)?.name ??
                      stock.find((s) => s.catalog_item_id === t.catalog_item_id)?.item_name ??
                      "Part"
                    const locLabel = locations.find((l) => l.id === t.location_id)?.name ?? "This bin"
                    const counterpartyLabel = t.counterparty_location_id
                      ? (locations.find((l) => l.id === t.counterparty_location_id)?.name ?? "Other location")
                      : null
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
                        <TableCell className="text-xs max-w-[140px]">
                          <span className="font-medium text-foreground line-clamp-2">{partLabel}</span>
                          <span className="block text-[10px] text-muted-foreground line-clamp-1">{locLabel}</span>
                        </TableCell>
                        <TableCell className="text-xs">{formatTransactionType(t.transaction_type)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.delta_on_hand}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{t.delta_allocated}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {counterpartyLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {woRef ? <span>{woRef}</span> : null}
                          {woRef && poRef ? <span className="mx-1 text-muted-foreground">·</span> : null}
                          {poRef ? <span className="text-muted-foreground">{poRef}</span> : null}
                          {!woRef && !poRef && t.notes ? (
                            <span className="text-muted-foreground line-clamp-2">{t.notes}</span>
                          ) : null}
                          {!woRef && !poRef && !t.notes ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
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
              <CardTitle className="text-sm">Consume part on work order</CardTitle>
              <CardDescription className="text-xs">
                Reduce on-hand for a job: pick the work order and the source bin. Allocations are released when
                applicable.
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
                  <Select value={conWo} onValueChange={setConWo} disabled={!canConsumeOnWorkOrder || recentWorkOrders.length === 0}>
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
                  <Label className="text-xs">Catalog item</Label>
                  <Select value={conCatalog} onValueChange={setConCatalog} disabled={!canConsumeOnWorkOrder}>
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
                  <Label className="text-xs">Source location</Label>
                  <Select value={conLoc} onValueChange={setConLoc} disabled={!canConsumeOnWorkOrder}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Where it came from…" />
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
                <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    value={conQty}
                    onChange={(e) => setConQty(e.target.value)}
                    className="h-9 text-xs"
                    inputMode="numeric"
                    disabled={!canConsumeOnWorkOrder}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={INV_SUBMIT_CLASS}
                  disabled={!canConsumeOnWorkOrder || !conWo}
                  onClick={async () => {
                    if (!baseUrl) return
                    try {
                      await postJson(`${baseUrl}/inventory/consume`, {
                        work_order_id: conWo.trim(),
                        catalog_item_id: conCatalog,
                        location_id: conLoc,
                        quantity: Number(conQty),
                      })
                      toast({ title: "Part consumption recorded" })
                      void load()
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" })
                    }
                  }}
                >
                  Consume part
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
                Link each technician to the vehicle bin that holds their truck stock. Balances show on{" "}
                <strong className="text-foreground">Overview</strong> and in transfers.
              </CardDescription>
            </CardHeader>
            <CardContent className={INV_FORM_GROUP}>
              <div className={INV_FORM_ROW}>
                <div className={cn(INV_FIELD, "sm:basis-[14rem]")}>
                  <Label className="text-xs">Technician</Label>
                  <Select value={vanTech} onValueChange={setVanTech} disabled={!canManageInventoryPerm}>
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
                  <Select value={vanLoc} onValueChange={setVanLoc} disabled={!canManageInventoryPerm}>
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
                  disabled={!canManageInventoryPerm}
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
                      <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                        <span className="block max-w-md mx-auto space-y-1.5">
                          <span className="block text-foreground font-medium">No technician ↔ van links yet</span>
                          <span className="block text-xs leading-relaxed">
                            Add a <strong className="text-foreground">vehicle</strong> location with{" "}
                            <strong className="text-foreground">Add location</strong>, then choose the technician and bin
                            above.
                          </span>
                        </span>
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

          {canConsumeOnWorkOrder && !canManageInventoryPerm && myVehicleLocId ? (
            <Card className={INV_CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Return parts to warehouse</CardTitle>
                <CardDescription className="text-xs">
                  <strong className="text-foreground">Transfer stock</strong> from your assigned van bin to a storeroom
                  or staging shelf (same API as Transfer stock). Managers can move between any locations from the{" "}
                  <strong className="text-foreground">Transfer stock</strong> tab.
                </CardDescription>
              </CardHeader>
              <CardContent className={INV_FORM_GROUP}>
                <div className={INV_FORM_ROW}>
                  <div className={cn(INV_FIELD, "sm:basis-[15rem]")}>
                    <Label className="text-xs">Catalog item</Label>
                    <Select value={retCatalog} onValueChange={setRetCatalog}>
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="Select stocked line…" />
                      </SelectTrigger>
                      <SelectContent>
                        {stock
                          .filter(
                            (s) =>
                              s.location_id === myVehicleLocId && Number(s.quantity_on_hand) > 0,
                          )
                          .map((s) => (
                            <SelectItem key={s.catalog_item_id} value={s.catalog_item_id}>
                              {(s.item_name ?? s.part_number ?? "—").slice(0, 48)} ({Number(s.quantity_on_hand)}{" "}
                              on hand)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn(INV_FIELD, "sm:basis-[14rem]")}>
                    <Label className="text-xs">Destination</Label>
                    <Select value={retWarehouse} onValueChange={setRetWarehouse}>
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="Warehouse / staging…" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseStagingLocations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.location_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn(INV_FIELD, "sm:basis-[6rem]")}>
                    <Label className="text-xs">Qty</Label>
                    <Input
                      value={retQty}
                      onChange={(e) => setRetQty(e.target.value)}
                      className="h-9 text-xs"
                      inputMode="decimal"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className={INV_SUBMIT_CLASS}
                    disabled={
                      !retCatalog ||
                      !retWarehouse ||
                      !Number.isFinite(Number(retQty)) ||
                      Number(retQty) <= 0
                    }
                    onClick={async () => {
                      if (!baseUrl || !myVehicleLocId) return
                      try {
                        await postJson(`${baseUrl}/inventory/truck-transfer`, {
                          catalog_item_id: retCatalog,
                          from_location_id: myVehicleLocId,
                          to_location_id: retWarehouse,
                          quantity: Number(retQty),
                          notes: "Technician return to warehouse",
                        })
                        toast({ title: "Stock transferred", description: "Moved from your van bin to the warehouse." })
                        setRetQty("1")
                        void load()
                      } catch (e) {
                        toast({
                          title: e instanceof Error ? e.message : "Failed",
                          variant: "destructive",
                        })
                      }
                    }}
                  >
                    Transfer stock
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="reorder" className="space-y-4">
          <InventoryReorderCenter organizationId={organizationId} onInventoryMutated={() => void load()} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={adjConfirmOpen} onOpenChange={setAdjConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm adjust stock (decrease)</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                On-hand will drop by <span className="font-semibold tabular-nums">{adjQty}</span> at the selected
                location.
              </span>
              <span className="block text-xs text-muted-foreground">
                Adjustments are written to the ledger and cannot be edited in place — use another stock adjustment if
                you need to correct a mistake.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitAdjustment()}>Apply stock adjustment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={locOpen} onOpenChange={setLocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add inventory location</DialogTitle>
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
